import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

/**
 * WebRTC voice:
 * - STOMP carries signaling metadata only (SDP/ICE/presence).
 * - Audio is always carried by RTCPeerConnection.
 * - A TURN server can be supplied for restrictive NATs.
 *
 * Vite:
 *   VITE_STUN_URL=stun:stun.l.google.com:19302
 *   VITE_TURN_URL=turn:your-turn-host:3478
 *   VITE_TURN_USERNAME=...
 *   VITE_TURN_CREDENTIAL=...
 */
const ICE_SERVERS = [
  {urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302'},
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
      }]
    : [])
];

export function useVoiceChat(
  roomCode,
  playerId,
  players = [],
  enabled = true,
  onError = () => {}
) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState({});

  const localStream = useRef(null);
  const peers = useRef(new Map());
  const audios = useRef(new Map());
  const pendingCandidates = useRef(new Map());
  const subscriptions = useRef([]);
  const clientRef = useRef(null);
  const remoteAnalysers = useRef(new Map());
  const speakingLastSent = useRef(false);
  const speakingTimer = useRef(null);

  const humans = useMemo(
    () => players.filter(
      p => p.id !== playerId && !p.bot && (p.status === 'CONNECTED' || p.status === 'ELIMINATED')
    ),
    [players, playerId]
  );

  const sendSignal = useCallback((payload) => {
    const client = clientRef.current || window.__fourCardsClient;
    if (!client?.connected || !roomCode || !playerId) return;

    client.publish({
      destination: `/app/room/${roomCode}/voice`,
      body: JSON.stringify({
        fromPlayerId: playerId,
        ...payload
      })
    });
  }, [roomCode, playerId]);

  const closePeer = useCallback((remoteId) => {
    const pc = peers.current.get(remoteId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peers.current.delete(remoteId);
    }

    pendingCandidates.current.delete(remoteId);

    const audio = audios.current.get(remoteId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audios.current.delete(remoteId);
    }

    const analyser = remoteAnalysers.current.get(remoteId);
    if (analyser) {
      cancelAnimationFrame(analyser.raf);
      analyser.source?.disconnect?.();
      analyser.context?.close?.();
      remoteAnalysers.current.delete(remoteId);
    }

    setRemoteStatus(current => {
      const next = {...current};
      delete next[remoteId];
      return next;
    });
  }, []);

  const createRemoteAudioAnalyser = useCallback((remoteId, stream) => {
    if (remoteAnalysers.current.has(remoteId)) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const n = (value - 128) / 128;
          sum += n * n;
        }
        const isSpeaking = Math.sqrt(sum / data.length) > 0.045;
        setRemoteStatus(current => {
          if (current[remoteId]?.speaking === isSpeaking) return current;
          return {
            ...current,
            [remoteId]: {...current[remoteId], speaking: isSpeaking}
          };
        });
        const raf = requestAnimationFrame(tick);
        const entry = remoteAnalysers.current.get(remoteId);
        if (entry) entry.raf = raf;
      };

      const entry = {context, analyser, source, raf: 0};
      remoteAnalysers.current.set(remoteId, entry);
      tick();
    } catch {
      // Audio still works without the analyser.
    }
  }, []);

  const flushCandidates = useCallback(async (remoteId, pc) => {
    const queued = pendingCandidates.current.get(remoteId) || [];
    pendingCandidates.current.delete(remoteId);

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore stale ICE candidates; the connection can continue with others.
      }
    }
  }, []);

  const createPeer = useCallback(async (remoteId, initiator) => {
    if (!active || !localStream.current || !remoteId || remoteId === playerId) {
      return null;
    }

    let pc = peers.current.get(remoteId);
    if (pc) return pc;

    pc = new RTCPeerConnection({iceServers: ICE_SERVERS});
    peers.current.set(remoteId, pc);

    localStream.current.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current);
    });

    pc.onicecandidate = event => {
      if (!event.candidate) return;
      sendSignal({
        toPlayerId: remoteId,
        type: 'candidate',
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      });
    };

    pc.ontrack = event => {
      const stream = event.streams?.[0];
      if (!stream) return;

      let audio = audios.current.get(remoteId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        audios.current.set(remoteId, audio);
      }

      audio.srcObject = stream;
      audio.muted = deafened;
      audio.play().catch(() => {
        // Browser may require a user gesture before remote playback.
      });

      createRemoteAudioAnalyser(remoteId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        closePeer(remoteId);
      }
    };

    if (initiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      sendSignal({
        toPlayerId: remoteId,
        type: 'offer',
        sdp: offer.sdp
      });
    }

    return pc;
  }, [
    active,
    closePeer,
    createRemoteAudioAnalyser,
    deafened,
    playerId,
    sendSignal
  ]);

  const handleSignal = useCallback(async signal => {
    if (!active || !signal || (signal.toPlayerId && signal.toPlayerId !== playerId)) return;

    const remoteId = signal.fromPlayerId;
    if (!remoteId || remoteId === playerId) return;

    // Presence is useful even when a peer has not enabled voice yet.
    if (signal.type === 'presence' || signal.type === 'mute') {
      setRemoteStatus(current => ({
        ...current,
        [remoteId]: {
          ...(current[remoteId] || {}),
          micEnabled: signal.micEnabled !== false,
          speaking: Boolean(signal.speaking)
        }
      }));
      return;
    }

    if (signal.type === 'leave') {
      closePeer(remoteId);
      return;
    }

    try {
      let pc = peers.current.get(remoteId);

      if (signal.type === 'hello') {
        // Deterministic initiator: only the lexicographically smaller id
        // creates the offer, preventing offer glare.
        if (playerId < remoteId) {
          await createPeer(remoteId, true);
        }
        return;
      }

      if (signal.type === 'offer') {
        pc = await createPeer(remoteId, false);
        await pc.setRemoteDescription({
          type: 'offer',
          sdp: signal.sdp
        });
        await flushCandidates(remoteId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignal({
          toPlayerId: remoteId,
          type: 'answer',
          sdp: answer.sdp
        });
        return;
      }

      if (signal.type === 'answer') {
        if (!pc) return;
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp
        });
        await flushCandidates(remoteId, pc);
        return;
      }

      if (signal.type === 'candidate') {
        if (!pc || !pc.remoteDescription) {
          const queue = pendingCandidates.current.get(remoteId) || [];
          queue.push({
            candidate: signal.candidate,
            sdpMid: signal.sdpMid,
            sdpMLineIndex: signal.sdpMLineIndex
          });
          pendingCandidates.current.set(remoteId, queue);
          return;
        }

        await pc.addIceCandidate({
          candidate: signal.candidate,
          sdpMid: signal.sdpMid,
          sdpMLineIndex: signal.sdpMLineIndex
        });
      }
    } catch {
      closePeer(remoteId);
      onError('Voice connection could not be established. Check your network or TURN configuration.');
    }
  }, [
    active,
    closePeer,
    createPeer,
    flushCandidates,
    onError,
    playerId,
    sendSignal
  ]);

  // Attach to the existing STOMP client. Reattach after STOMP reconnects.
  useEffect(() => {
    if (!roomCode || !playerId || !enabled) return undefined;

    let cancelled = false;
    let timer;

    const attach = () => {
      if (cancelled) return;

      const client = window.__fourCardsClient;
      if (!client?.connected) {
        timer = window.setTimeout(attach, 250);
        return;
      }

      clientRef.current = client;
      subscriptions.current.forEach(s => s.unsubscribe?.());
      subscriptions.current = [
        client.subscribe(`/topic/rooms/${roomCode}/voice`, message => {
          try {
            handleSignal(JSON.parse(message.body));
          } catch {
            onError('Invalid voice signaling message.');
          }
        })
      ];
    };

    const onConnected = event => {
      if (event.detail?.client === window.__fourCardsClient) attach();
    };

    const onClosed = () => {
      subscriptions.current.forEach(s => s.unsubscribe?.());
      subscriptions.current = [];
      clientRef.current = null;
    };

    window.addEventListener('fourcards:stomp-connected', onConnected);
    window.addEventListener('fourcards:stomp-closed', onClosed);

    attach();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('fourcards:stomp-connected', onConnected);
      window.removeEventListener('fourcards:stomp-closed', onClosed);
      subscriptions.current.forEach(s => s.unsubscribe?.());
      subscriptions.current = [];
      clientRef.current = null;
    };
  }, [enabled, handleSignal, onError, playerId, roomCode]);

  useEffect(() => {
    if (!active) return;

    humans.forEach(remote => {
      if (playerId < remote.id && !peers.current.has(remote.id)) {
        createPeer(remote.id, true).catch(() => {});
      }
    });

    peers.current.forEach((_, remoteId) => {
      if (!humans.some(p => p.id === remoteId)) {
        closePeer(remoteId);
      }
    });
  }, [active, closePeer, createPeer, humans, playerId]);

  const enable = useCallback(async () => {
    if (active) return;

    if (!window.isSecureContext && location.hostname !== 'localhost') {
      onError('Live voice requires HTTPS. Please open the deployed game over HTTPS.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onError('This browser does not provide microphone access.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      localStream.current = stream;
      stream.getAudioTracks().forEach(track => { track.enabled = true; });

      setMuted(false);
      setActive(true);

      window.setTimeout(() => {
        sendSignal({
          type: 'hello'
        });
        sendSignal({
          type: 'presence',
          micEnabled: true,
          speaking: false
        });
      }, 50);
    } catch (error) {
      if (error?.name === 'NotAllowedError') {
        onError('Microphone permission was denied. Allow microphone access and try again.');
      } else {
        onError('Microphone is unavailable. Check browser permissions and your device.');
      }
    }
  }, [active, onError, sendSignal]);

  const disable = useCallback(() => {
    sendSignal({
      type: 'leave',
      toPlayerId: null,
      micEnabled: false,
      speaking: false
    });

    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;

    [...peers.current.keys()].forEach(id => closePeer(id));

    setActive(false);
    setMuted(false);
    setSpeaking(false);
    setRemoteStatus({});
  }, [closePeer, sendSignal]);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;

    const next = !muted;
    localStream.current.getAudioTracks().forEach(track => {
      track.enabled = !next;
    });

    setMuted(next);
    sendSignal({
      type: 'mute',
      micEnabled: !next,
      speaking: false
    });
  }, [muted, sendSignal]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;

    audios.current.forEach(audio => {
      audio.muted = next;
    });

    setDeafened(next);
  }, [deafened]);

  // Local speaking detection. Only state transitions are signaled to peers,
  // avoiding a continuous STOMP stream.
  useEffect(() => {
    if (!active || !localStream.current) return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    let context;
    let analyser;
    let source;
    let raf;

    try {
      context = new AudioContextClass();
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source = context.createMediaStreamSource(localStream.current);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          const n = (value - 128) / 128;
          sum += n * n;
        }

        const next = Math.sqrt(sum / data.length) > 0.045 && !muted;
        setSpeaking(next);

        if (next !== speakingLastSent.current) {
          speakingLastSent.current = next;
          sendSignal({
            type: 'presence',
            micEnabled: !muted,
            speaking: next
          });
        }

        raf = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      // Voice itself remains usable.
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      source?.disconnect?.();
      analyser?.disconnect?.();
      context?.close?.();
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
    };
  }, [active, muted, sendSignal]);

  useEffect(() => () => disable(), [disable]);

  return {
    active,
    muted,
    deafened,
    speaking,
    remoteStatus,
    enable,
    disable,
    toggleMute,
    toggleDeafen
  };
}

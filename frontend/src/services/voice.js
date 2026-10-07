import {useCallback, useEffect, useRef, useState} from 'react';

const ICE_SERVERS = [
  {urls: 'stun:stun.l.google.com:19302'},
  {urls: 'stun:stun1.l.google.com:19302'}
];

export function useVoiceChat(roomCode, playerId, players = [], enabled = true, onError = () => {}) {
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const localStream = useRef(null);
  const peers = useRef(new Map());
  const audios = useRef(new Map());
  const subscription = useRef(null);
  const clientRef = useRef(null);
  const speakingTimer = useRef(null);

  const humans = players.filter(p =>
    p.id !== playerId &&
    !p.bot &&
    p.status === 'CONNECTED'
  );

  const sendSignal = useCallback((payload) => {
    const client = clientRef.current || window.__fourCardsClient;
    if (!client?.connected) return;

    client.publish({
      destination: `/app/room/${roomCode}/voice`,
      body: JSON.stringify({
        fromPlayerId: playerId,
        ...payload
      })
    });
  }, [roomCode, playerId]);

  const closePeer = useCallback((id) => {
    const pc = peers.current.get(id);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
      peers.current.delete(id);
    }

    const audio = audios.current.get(id);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audios.current.delete(id);
    }
  }, []);

  const createPeer = useCallback(async (remoteId, initiator) => {
    if (!active || !localStream.current) return null;

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
      let audio = audios.current.get(remoteId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audios.current.set(remoteId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.muted = deafened;
      audio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
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
  }, [active, closePeer, deafened, sendSignal]);

  const handleSignal = useCallback(async (signal) => {
    if (!active || !signal || signal.toPlayerId !== playerId) return;

    try {
      const remoteId = signal.fromPlayerId;
      let pc = peers.current.get(remoteId);

      if (signal.type === 'hello') {
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

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignal({
          toPlayerId: remoteId,
          type: 'answer',
          sdp: answer.sdp
        });
      }

      if (signal.type === 'answer') {
        if (!pc) return;
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp
        });
      }

      if (signal.type === 'candidate') {
        if (!pc) {
          pc = await createPeer(remoteId, false);
        }

        await pc.addIceCandidate({
          candidate: signal.candidate,
          sdpMid: signal.sdpMid,
          sdpMLineIndex: signal.sdpMLineIndex
        });
      }
    } catch (error) {
      onError('Voice connection could not be established.');
    }
  }, [active, createPeer, onError, playerId, sendSignal]);

  // Wait for the existing STOMP game client and subscribe to voice signaling.
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
      subscription.current?.unsubscribe?.();
      subscription.current = client.subscribe(
        `/topic/rooms/${roomCode}/voice`,
        message => {
          handleSignal(JSON.parse(message.body));
        }
      );
    };

    attach();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      subscription.current?.unsubscribe?.();
      subscription.current = null;
      clientRef.current = null;
    };
  }, [enabled, handleSignal, playerId, roomCode]);

  // Keep peers aligned with the currently connected human players.
  useEffect(() => {
    if (!active) return;

    humans.forEach(remote => {
      if (playerId < remote.id) {
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

    if (!navigator.mediaDevices?.getUserMedia) {
      onError('Live voice requires a secure connection (HTTPS) or localhost.');
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
      setMuted(false);
      setActive(true);
      // Announce presence so peers that enabled voice earlier can renegotiate.
      window.setTimeout(() => sendSignal({type: 'hello'}), 50);
    } catch {
      onError('Microphone permission was denied or is unavailable.');
    }
  }, [active, onError, sendSignal]);

  const disable = useCallback(() => {
    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;

    peers.current.forEach((_, id) => closePeer(id));
    peers.current.clear();

    setActive(false);
    setMuted(false);
    setSpeaking(false);
  }, [closePeer]);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    const next = !muted;
    localStream.current.getAudioTracks().forEach(track => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleDeafen = useCallback(() => {
    const next = !deafened;
    audios.current.forEach(audio => {
      audio.muted = next;
    });
    setDeafened(next);
  }, [deafened]);

  // Small local mic activity indicator.
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
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        setSpeaking(Math.sqrt(sum / data.length) > 0.045 && !muted);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Voice itself still works if the analyser is unavailable.
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      source?.disconnect?.();
      analyser?.disconnect?.();
      context?.close?.();
      if (speakingTimer.current) clearTimeout(speakingTimer.current);
    };
  }, [active, muted]);

  useEffect(() => () => disable(), [disable]);

  return {
    active,
    muted,
    deafened,
    speaking,
    enable,
    disable,
    toggleMute,
    toggleDeafen
  };
}

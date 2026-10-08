import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Sparkles, Clock3, Crown, Mic, MicOff, Volume2, VolumeX,
  PhoneOff, Radio, Eye, LockKeyhole
} from 'lucide-react';
import {Avatar} from './common.jsx';
import {useVoiceChat} from '../services/voice.js';

function GameScreen({room, state, privateState, socket, error, setError}) {
  const [selected, setSelected] = useState([]);
  const [handOrder, setHandOrder] = useState([]);
  const [dragCode, setDragCode] = useState(null);
  const [dealing, setDealing] = useState(false);
  const dealtRoundRef = useRef(0);

  const me = state?.players?.find(p => p.id === room.playerId);
  const myTurn = state?.currentPlayerId === room.playerId;
  const hand = privateState?.hand || [];
  const legal = privateState?.legalActions || [];
  const open = state?.phase === 'OPEN_CONFIRMATION';
  const result = state?.phase === 'ROUND_RESULT';
  const over = state?.phase === 'GAME_OVER';

  const voice = useVoiceChat(
    room.roomCode,
    room.playerId,
    state?.players || [],
    true,
    setError
  );

  const orderedHand = useMemo(() => {
    if (!handOrder.length) return hand;
    const map = new Map(hand.map(c => [c.code, c]));
    return [
      ...handOrder.map(c => map.get(c)).filter(Boolean),
      ...hand.filter(c => !handOrder.includes(c.code))
    ];
  }, [hand, handOrder]);

  useEffect(() => {
    setSelected([]);
    setHandOrder(hand.map(c => c.code));
  }, [state?.message, state?.currentPlayerId, state?.phase, privateState?.hand?.length]);

  useEffect(() => {
    if (state?.phase !== 'PLAYING' || !state?.roundNumber || !hand.length) return;
    if (dealtRoundRef.current === state.roundNumber) return;
    dealtRoundRef.current = state.roundNumber;
    setDealing(true);
    const t = setTimeout(() => setDealing(false), Math.max(1100, hand.length * 240 + 250));
    return () => clearTimeout(t);
  }, [state?.roundNumber, state?.phase, hand.length]);

  const action = (dest, body = {}) => {
    socket.send(`/room/${room.roomCode}/${dest}`, {
      playerId: room.playerId,
      ...body
    });
  };

  const toggle = card => {
    if (!myTurn || open || !legal.includes('DROP')) return;

    setSelected(current =>
      current.includes(card.code)
        ? current.filter(code => code !== card.code)
        : [...current, card.code]
    );
  };

  const canDropSelected = selected.length > 0;

  const drop = codes => {
    const cardCodes = codes?.length ? codes : selected;
    if (!cardCodes.length) {
      setError('Select at least one card.');
      return;
    }

    // This is UX validation only. The server repeats the validation.
    const ranks = cardCodes.map(
      code => hand.find(h => h.code === code)?.rank
    );

    if (new Set(ranks).size > 1) {
      setError('You can only drop cards with the same rank.');
      return;
    }

    action('drop', {cardCodes});
    setSelected([]);
    setDragCode(null);
  };

  if (!state) {
    return (
      <div className="full-loading">
        <Spinner/>
        Connecting to table…
      </div>
    );
  }

  const joker = state.jokerCard;

  return (
    <main className="game-shell">
      <div className="game-top">
        <div className="round-meta">
          <span>ROUND {state.roundNumber}</span>
          <i/>
          <span>{state.targetScore} TARGET</span>
        </div>

        <div className="turn-status">
          {open ? (
            <>
              <Clock3 size={16}/>
              {state.players.find(p => p.id === state.openingPlayerId)?.name || 'Player'} IS OPENING
              {state.openingEndsAt && <Countdown endsAt={state.openingEndsAt}/>}
            </>
          ) : myTurn ? (
            <>
              <span className="pulse-dot"/>
              YOUR TURN
              {state.turnEndsAt && <TurnCountdown endsAt={state.turnEndsAt}/>}
            </>
          ) : (
            <>
              <span className="pulse-dot muted"/>
              {state.players.find(p => p.id === state.currentPlayerId)?.name || 'Opponent'}'S TURN
            </>
          )}
        </div>

        <div className="connection">
          <span className="status-dot"/>
          Connected
        </div>

        <VoicePanel
          voice={voice}
          players={state.players || []}
          room={room}
        />
      </div>

      <div className="game-board">
        <div className="opponents">
          {state.players
            .filter(p => p.id !== room.playerId)
            .map(p => (
              <Opponent
                key={p.id}
                player={p}
                active={p.id === state.currentPlayerId}
                compact={state.players.length > 4}
                voiceStatus={voice.remoteStatus?.[p.id]}
              />
            ))}
        </div>

        <div className="table-center">
          <div className="table-light"/>

          <div className="piles">
            <div
              className="pile-wrap previous-drop-wrap clickable-pile"
              role="button"
              tabIndex={legal.includes('TAKE_DROP') ? 0 : -1}
              aria-label="Take previous drop card"
              onClick={() => legal.includes('TAKE_DROP') && action('take')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && legal.includes('TAKE_DROP')) {
                  e.preventDefault();
                  action('take');
                }
              }}
            >
              <span className="pile-label">PREVIOUS CARD</span>
              {state.previousTopDropCard ? (
                <PlayingCard code={state.previousTopDropCard} small nonInteractive/>
              ) : (
                <div className="empty-pile">NO CARD</div>
              )}
              {legal.includes('TAKE_DROP') && <small className="click-hint">Tap to take</small>}
            </div>

            <div
              className={`pile-wrap current-drop-area ${myTurn && legal.includes('DROP') ? 'ready' : ''}`}
              role={myTurn && legal.includes('DROP') ? 'button' : undefined}
              tabIndex={myTurn && legal.includes('DROP') ? 0 : -1}
              onClick={() => {
                if (myTurn && legal.includes('DROP') && selected.length) drop();
              }}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && myTurn && legal.includes('DROP') && selected.length) {
                  e.preventDefault();
                  drop();
                }
              }}
              onDragOver={e => {
                if (myTurn && legal.includes('DROP')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={e => {
                e.preventDefault();
                const grouped = e.dataTransfer.getData('application/x-four-cards');
                if (grouped) {
                  try {
                    const codes = JSON.parse(grouped);
                    if (Array.isArray(codes) && codes.length) {
                      drop(codes);
                      return;
                    }
                  } catch (_) {}
                }
                const raw = e.dataTransfer.getData('text/plain') || dragCode || '';
                const codes = raw.split(',').filter(Boolean);
                if (codes.length) drop(codes);
              }}
            >
              <span className="pile-label">DROP AREA <b>THIS MOVE</b></span>
              {state.topDropCard ? (
                <PlayingCard code={state.topDropCard} small nonInteractive/>
              ) : (
                <div className="drop-target">
                  <span>DROP AREA</span>
                  <strong>EMPTY</strong>
                </div>
              )}
              {myTurn && legal.includes('DROP') && <small className="drop-hint">Drag a card here</small>}
            </div>

            <div
              className="pile-wrap deck-wrap clickable-pile"
              role="button"
              tabIndex={legal.includes('DRAW_DECK') ? 0 : -1}
              aria-label="Draw from deck"
              onClick={() => legal.includes('DRAW_DECK') && action('draw')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && legal.includes('DRAW_DECK')) {
                  e.preventDefault();
                  action('draw');
                }
              }}
            >
              <span className="pile-label">DRAW DECK <b>{state.deckCount}</b></span>
              <div className="deck-back" aria-label="Draw deck"><div/><div/></div>
              {legal.includes('DRAW_DECK') && <small className="click-hint">Tap to draw</small>}
            </div>

            <div className="joker-zone" aria-label="Immutable Joker card">
              <div className="joker-zone-label"><LockKeyhole size={10}/>JOKER</div>
              {joker ? <JokerCard card={joker}/> : <div className="joker-empty">JOKER</div>}
              <span className="joker-rule">{state.jokerRank || '—'} = 0</span>
            </div>
          </div>

          <div className="table-message">{state.message}</div>
        </div>

        <div className="my-area">
          <div className="my-info">
            <div className="score-summary">
              <div className="score-line">
                <span className="panel-kicker">CUMULATIVE</span>
                <strong>{me?.score ?? 0}</strong>
                <span>/ {state.targetScore}</span>
              </div>
              <div className="hand-score-private">
                <span>HAND SCORE</span>
                <b>{privateState?.handScore ?? 0}</b>
                <em>PRIVATE</em>
              </div>
            </div>

            <div className="score-track">
              <span
                style={{
                  width: `${Math.min(
                    100,
                    ((me?.score ?? 0) / state.targetScore) * 100
                  )}%`
                }}
              />
            </div>

            <div className="my-name">
              <Avatar name={me?.name}/>
              <b>{me?.name}</b>
              {me?.host && <span>HOST</span>}
            </div>
          </div>

          {dealing && <div className="deal-banner"><span className="pulse-dot"/> DEALING CARDS…</div>}

          <div className={`hand ${dealing ? 'dealing-hand' : ''}`}>
            {orderedHand.map((card, index) => (
              <PlayingCard
                key={card.code}
                code={card.code}
                className={dealing ? 'deal-in' : ''}
                style={dealing ? {animationDelay: `${index * 180}ms`} : undefined}
                value={card.value}
                selected={selected.includes(card.code)}
                onClick={() => toggle(card)}
                index={index}
                draggable={!open && myTurn && legal.includes('DROP')}
                onDragStart={e => {
                  const dragCodes = selected.includes(card.code) && selected.length
                    ? selected
                    : [card.code];
                  setDragCode(card.code);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-four-cards', JSON.stringify(dragCodes));
                  e.dataTransfer.setData('text/plain', dragCodes.join(','));
                }}
                onDragEnd={() => setDragCode(null)}
                onDragOver={e => {
                  if (!open) e.preventDefault();
                }}
                onDrop={e => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData('text/plain') || dragCode || '';
                  const dragged = raw.split(',')[0];
                  if (!dragged || dragged === card.code) return;

                  setHandOrder(order => {
                    const next = [...order];
                    const a = next.indexOf(dragged);
                    const b = next.indexOf(card.code);
                    if (a < 0 || b < 0) return order;
                    next.splice(a, 1);
                    next.splice(b, 0, dragged);
                    return next;
                  });
                  setDragCode(null);
                }}
              />
            ))}
          </div>

          <div className="controls">
            {open ? (
              <div className="open-lock">
                <Clock3 size={18}/>
                <div>
                  <b>{state.players.find(p => p.id === state.openingPlayerId)?.name || 'Player'} is opening</b>
                  <span>They can withdraw before the 10-second check ends and continue the turn.</span>
                </div>
                {state.openingPlayerId === room.playerId && (
                  <button className="btn secondary withdraw-open" onClick={() => action('withdraw-open')}>Withdraw opening</button>
                )}
                <Countdown endsAt={state.openingEndsAt}/>
              </div>
            ) : (
              <>
                <button
                  className="btn primary drop-btn"
                  disabled={!myTurn || !legal.includes('DROP') || !canDropSelected}
                  onClick={() => drop()}
                >
                  Drop {selected.length
                    ? `${selected.length} card${selected.length > 1 ? 's' : ''}`
                    : ''}
                  <span>→</span>
                </button>

                {legal.includes('OPEN') && (
                  <button className="open-btn" onClick={() => action('open')}>
                    <Sparkles size={16}/>
                    OPEN ROUND
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {result && <RoundResult state={state} room={room} action={action}/>}
      {over && <Winner state={state} room={room}/>}
      {me?.status === 'ELIMINATED' && (
        <div className="spectator-banner">
          <EyeIcon/> SPECTATOR MODE — watch the remaining table.
        </div>
      )}
    </main>
  );
}

function VoicePanel({voice, players, room}) {
  const humans = players.filter(
    p => !p.bot && p.id !== room.playerId && p.status === 'CONNECTED'
  );

  return (
    <div className={`voice-panel ${voice.active ? 'live' : ''}`}>
      <div className="voice-title">
        <span className={voice.speaking ? 'voice-pulse' : ''}>
          <Radio size={14}/>
        </span>
        <b>VOICE</b>
        <small>{voice.active ? `${humans.length + 1} connected` : 'Off'}</small>
      </div>

      <div className="voice-actions">
        {!voice.active ? (
          <button className="voice-btn join" onClick={voice.enable}>
            <Mic size={15}/>
            <span>Join voice</span>
          </button>
        ) : (
          <>
            <button
              className={`voice-btn ${voice.muted ? 'danger' : ''}`}
              title={voice.muted ? 'Unmute' : 'Mute'}
              onClick={voice.toggleMute}
            >
              {voice.muted ? <MicOff size={15}/> : <Mic size={15}/>}
            </button>

            <button
              className={`voice-btn ${voice.deafened ? 'danger' : ''}`}
              title={voice.deafened ? 'Undeafen' : 'Deafen'}
              onClick={voice.toggleDeafen}
            >
              {voice.deafened ? <VolumeX size={15}/> : <Volume2 size={15}/>}
            </button>

            <button
              className="voice-btn leave"
              title="Leave voice"
              onClick={voice.disable}
            >
              <PhoneOff size={15}/>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="spinner" aria-label="Loading"/>;
}

function EyeIcon() {
  return <span className="eye">◉</span>;
}

function Opponent({player, active, compact, voiceStatus}) {
  const voiceLive = voiceStatus?.micEnabled;
  const voiceSpeaking = voiceStatus?.speaking;

  return (
    <div
      className={`opponent ${active ? 'active' : ''} ${
        player.status !== 'CONNECTED' ? 'dimmed' : ''
      } ${voiceSpeaking ? 'voice-speaking' : ''}`}
    >
      <div className="opponent-hand" aria-label={`${player.handSize ?? 0} unrevealed cards`}>
        {Array.from({length: Math.min(player.handSize ?? 0, 4)}).map((_, i) => (
          <span className="mini-card-back" key={i}/>
        ))}
      </div>

      <Avatar name={player.name}/>

      <div className="opp-copy">
        <b>{player.name}</b>
        <span>
          {player.status === 'ELIMINATED'
            ? 'ELIMINATED'
            : player.status === 'DISCONNECTED'
              ? 'DISCONNECTED'
              : `Score ${player.score}`}
        </span>
      </div>

      <div className="opponent-voice" aria-label={voiceSpeaking ? 'Speaking' : voiceLive ? 'Mic on' : 'Voice off'}>
        {voiceSpeaking ? <Radio size={12}/> : voiceLive ? <Mic size={12}/> : <MicOff size={12}/>}
      </div>

      {player.host && <span className="mini-badge">HOST</span>}
      {player.bot && <span className="mini-badge bot-mini">BOT</span>}
      {player.dealer && <span className="mini-badge gold">DEALER</span>}
      {active && <span className="turn-dot"/>}
    </div>
  );
}

function JokerCard({card}) {
  const red = ['♥', '♦'].includes(card.suit);

  return (
    <div className={`joker-card ${red ? 'red' : 'black'}`} aria-label={`Joker ${card.rank} ${card.suit}`}>
      <div className="joker-card-badge">
        <LockKeyhole size={9}/>
        IMMUTABLE
      </div>
      <span>{card.rank}</span>
      <strong>{card.suit}</strong>
      <em>0 PTS</em>
    </div>
  );
}

function PlayingCard({
  code,
  value,
  selected,
  onClick,
  small,
  index = 0,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  nonInteractive,
  className: extraClass = '',
  style: extraStyle
}) {
  const suit = code?.slice(-1);
  const rank = code?.slice(0, -1);
  const red = ['♥', '♦'].includes(suit);

  const className = `card playing ${red ? 'red' : 'black'} ${
    selected ? 'selected' : ''
  } ${small ? 'small' : ''} ${nonInteractive ? 'non-interactive' : ''} ${extraClass}`;

  if (nonInteractive) {
    return (
      <div className={className} style={{'--i': index, ...extraStyle}}>
        <span>{rank}</span>
        <strong>{suit}</strong>
        {!small && <em>{value ?? ''}</em>}
      </div>
    );
  }

  return (
    <button
      aria-label={`${rank} ${suit}`}
      className={className}
      style={{'--i': index, ...extraStyle}}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
    >
      <span>{rank}</span>
      <strong>{suit}</strong>
      {!small && <em>{value ?? ''}</em>}
    </button>
  );
}

function TurnCountdown({endsAt}) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 200);
    return () => clearInterval(timer);
  }, [endsAt]);
  return <strong className="turn-countdown">{left}s</strong>;
}

function Countdown({endsAt}) {
  const [left, setLeft] = useState(
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 10
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft(
        Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      );
    }, 200);

    return () => clearInterval(timer);
  }, [endsAt]);

  return <strong className="countdown">{String(left).padStart(2, '0')}</strong>;
}

function RoundResult({state, room, action}) {
  const me = state.players.find(p => p.id === room.playerId);
  const openingSucceeded = Boolean(state.roundWinnerName);
  const roundWinner = state.roundWinnerName;

  return (
    <div className="overlay">
      <div className={`result-modal ${openingSucceeded ? 'legal-opening' : ''}`}>
        <div className="result-icon"><Sparkles/></div>
        <span className="eyebrow center">ROUND COMPLETE</span>
        <h2>
          {openingSucceeded
            ? `${roundWinner} has won the round!`
            : 'OPEN FAILED'}
        </h2>

        {openingSucceeded ? (
          <div className="round-winner-callout">
            <strong>{roundWinner}</strong>
            <span>Legal opening — lowest hand score</span>
            <b>{state.roundWinnerHandScore ?? 0} <small>HAND SCORE</small></b>
          </div>
        ) : (
          <div className="illegal-opening-callout">
            <b>Lowest score: {state.illegalOpeningWinnerName || 'Unknown'}</b>
            <span>{state.illegalOpeningLowestScore ?? '—'} hand score</span>
            <small>Your opening was invalid, so the opener receives +40 points.</small>
          </div>
        )}

        <div className="results-list round-scores">
          <div className="results-header">
            <span>PLAYER</span>
            <span>ROUND</span>
            <span>CUMULATIVE</span>
          </div>
          {state.players.map(p => (
            <div key={p.id}>
              <span>{p.name}</span>
              <b>{p.roundScore ?? 0}</b>
              <strong>{p.score}</strong>
            </div>
          ))}
        </div>

        {me?.host && state.phase === 'ROUND_RESULT' && (
          <button className="btn primary wide" onClick={() => action('next')}>
            Next round <span>→</span>
          </button>
        )}

        <small>Round score shows the points added this round. Cumulative is the total score.</small>
      </div>
    </div>
  );
}

function Winner({state}) {
  const winner = state.finalWinnerName
    ? state.players.find(p => p.name === state.finalWinnerName)
    : state.players.find(p => p.status !== 'ELIMINATED');

  const winnerName = state.finalWinnerName || winner?.name || 'Winner';
  const winnerScore = state.finalWinnerScore ?? winner?.score ?? 0;

  return (
    <div className="overlay winner-overlay">
      <div className="winner-modal">
        <img
          className="party-popper"
          src="/party-popper.gif"
          alt="Party popper celebration"
        />
        <div className="trophy"><Crown size={28}/></div>
        <span className="eyebrow center">GAME COMPLETE</span>
        <h1>{winnerName}</h1>
        <p>Final player standing</p>
        <div className="winner-announcement">
          Winner is <strong>{winnerName}</strong>
        </div>
        <div className="winner-score">
          {winnerScore}
          <span>PTS</span>
        </div>

        <div className="results-list final">
          {[...state.players]
            .sort((a, b) => a.score - b.score)
            .map((p, i) => (
              <div key={p.id}>
                <span><b>{i + 1}</b>{p.name}</span>
                <b>{p.score}</b>
              </div>
            ))}
        </div>

        <button
          className="btn secondary wide"
          onClick={() => location.reload()}
        >
          Back to lobby
        </button>
      </div>
    </div>
  );
}

export {GameScreen};

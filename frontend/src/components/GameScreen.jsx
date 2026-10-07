import React, {useEffect, useMemo, useState} from 'react';
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
  }, [
    state?.message,
    state?.currentPlayerId,
    state?.phase,
    privateState?.hand?.length
  ]);

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

  const dropDraggedCard = () => {
    if (!dragCode || !myTurn || !legal.includes('DROP')) return;
    drop([dragCode]);
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
              OPENING CHECK
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
              className={`pile-wrap drop-zone ${myTurn && legal.includes('DROP') ? 'ready' : ''}`}
              onDragOver={e => {
                if (myTurn && legal.includes('DROP')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={e => {
                e.preventDefault();
                dropDraggedCard();
              }}
            >
              <span className="pile-label">
                DROP PILE
                <b>{state.topDropCard ? 'LIVE' : 'EMPTY'}</b>
              </span>

              {state.topDropCard ? (
                <PlayingCard
                  code={state.topDropCard}
                  small
                  nonInteractive
                />
              ) : (
                <div className="empty-pile">DROP PILE</div>
              )}

              {myTurn && legal.includes('DROP') && (
                <small className="drop-hint">
                  Drag a card here
                </small>
              )}
            </div>

            <div className="pile-wrap deck-wrap">
              <span className="pile-label">
                DRAW DECK <b>{state.deckCount}</b>
              </span>
              <div className="deck-back" aria-label="Draw deck">
                <div/>
                <div/>
              </div>
            </div>

            {/* Immutable Joker: visually positioned immediately to the right of the draw deck. */}
            <div className="joker-zone" aria-label="Immutable Joker card">
              <div className="joker-zone-label">
                <LockKeyhole size={10}/>
                JOKER
              </div>

              {joker ? (
                <JokerCard card={joker}/>
              ) : (
                <div className="joker-empty">JOKER</div>
              )}

              <span className="joker-rule">
                {state.jokerRank || '—'} = 0
              </span>
            </div>
          </div>

          <div className="table-message">{state.message}</div>
        </div>

        <div className="my-area">
          <div className="my-info">
            <div>
              <span className="panel-kicker">YOUR SCORE</span>
              <strong>{me?.score ?? 0}</strong>
              <span>/ {state.targetScore}</span>
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

          <div className="hand">
            {orderedHand.map((card, index) => (
              <PlayingCard
                key={card.code}
                code={card.code}
                value={card.value}
                selected={selected.includes(card.code)}
                onClick={() => toggle(card)}
                index={index}
                draggable={!open && myTurn && legal.includes('DROP')}
                onDragStart={e => {
                  setDragCode(card.code);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', card.code);
                }}
                onDragEnd={() => setDragCode(null)}
                onDragOver={e => {
                  if (!open) e.preventDefault();
                }}
                onDrop={e => {
                  e.preventDefault();
                  const dragged = e.dataTransfer.getData('text/plain') || dragCode;
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
                  <b>Opening check in progress</b>
                  <span>Cards can be rearranged. Gameplay is paused.</span>
                </div>
                <Countdown endsAt={state.openingEndsAt}/>
              </div>
            ) : (
              <>
                <button
                  className="btn action-secondary"
                  disabled={!myTurn || !legal.includes('TAKE_DROP')}
                  onClick={() => action('take')}
                >
                  <span>Take</span>
                  <small>PREVIOUS DROP</small>
                </button>

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

                <button
                  className="btn action-secondary"
                  disabled={!myTurn || !legal.includes('DRAW_DECK')}
                  onClick={() => action('draw')}
                >
                  <span>Draw</span>
                  <small>FROM DECK</small>
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
  nonInteractive
}) {
  const suit = code?.slice(-1);
  const rank = code?.slice(0, -1);
  const red = ['♥', '♦'].includes(suit);

  const className = `card playing ${red ? 'red' : 'black'} ${
    selected ? 'selected' : ''
  } ${small ? 'small' : ''} ${nonInteractive ? 'non-interactive' : ''}`;

  if (nonInteractive) {
    return (
      <div className={className} style={{'--i': index}}>
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
      style={{'--i': index}}
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

  return (
    <div className="overlay">
      <div className="result-modal">
        <div className="result-icon"><Sparkles/></div>
        <span className="eyebrow center">ROUND COMPLETE</span>
        <h2>
          {state.message.includes('failed')
            ? 'OPEN FAILED'
            : 'ROUND RESOLVED'}
        </h2>
        <p>{state.message}</p>

        <div className="results-list">
          {state.players.map(p => (
            <div key={p.id}>
              <span>{p.name}</span>
              <b>{p.score}</b>
            </div>
          ))}
        </div>

        {me?.host && (
          <button className="btn primary wide" onClick={() => action('next')}>
            Next round <span>→</span>
          </button>
        )}

        <small>Scores shown are cumulative.</small>
      </div>
    </div>
  );
}

function Winner({state}) {
  const winner = state.players.find(p => p.status !== 'ELIMINATED');

  return (
    <div className="overlay winner-overlay">
      <div className="winner-modal">
        <div className="trophy"><Crown size={28}/></div>
        <span className="eyebrow center">GAME COMPLETE</span>
        <h1>{winner?.name || 'Winner'}</h1>
        <p>Final player standing</p>
        <div className="winner-score">
          {winner?.score ?? 0}
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

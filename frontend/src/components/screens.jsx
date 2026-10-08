import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Users,
  Copy,
  Crown,
  Check,
  Wifi
} from 'lucide-react';

import { Avatar, FormShell } from './common.jsx';

function Landing({ onCreate, onJoin }) {
  return (
    <section className="landing page-shell">
      <div className="hero-copy">
        <div className="eyebrow">
          <span />
          <span>PRIVATE MULTIPLAYER CARD TABLE</span>
        </div>

        <h1>
          Think ahead.<br />
          <em>Drop smart.</em><br />
          Score low.
        </h1>

        <p>
          Four Cards is a sharp, social card game built around simple choices,
          hidden information and just enough pressure to make every turn count.
        </p>

        <div className="cta-row">
          <button className="btn primary" onClick={onCreate}>
            Create game <span>→</span>
          </button>

          <button className="btn secondary" onClick={onJoin}>
            Join with code
          </button>
        </div>

        <div className="trust-row">
          <span>
            <Shield size={15} /> Server-authoritative play
          </span>
          <span>
            <Users size={15} /> 3–6 players
          </span>
          <span>
            <Wifi size={15} /> Real-time
          </span>
        </div>

        <div className="creator-marquee" aria-label="Created by Sharan">
          <div className="creator-marquee__track">
            <span>CREATED BY SHARAN</span><i>✦</i>
            <span>CREATED BY SHARAN</span><i>✦</i>
            <span>CREATED BY SHARAN</span><i>✦</i>
            <span>CREATED BY SHARAN</span><i>✦</i>
          </div>
        </div>
      </div>

      <div className="hero-table">
        <div className="ambient" />

        <div className="hero-card card black tilt-a">
          <span>K</span>
          <span>♣</span>
        </div>

        <div className="hero-card card red tilt-b">
          <span>J</span>
          <span>♦</span>
        </div>

        <div className="hero-card card black tilt-c">
          <span>Q</span>
          <span>♠</span>
        </div>

        <div className="table-ring">
          <span>DROP</span>
          <strong>YOUR MOVE</strong>
        </div>
      </div>
    </section>
  );
}

function Create({ onBack, onCreate }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState(50);
  const [bots, setBots] = useState(0);
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [turnSeconds, setTurnSeconds] = useState(15);

  return (
    <FormShell
      title="Create a game"
      subtitle="Set the table, invite your people, and deal."
      onBack={onBack}
    >
      <div className="form-card">
        <label>
          Player name
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your display name"
            maxLength={20}
          />
        </label>

        <label>
          Target score

          <div className="stepper">
            <button
              onClick={() => setTarget(Math.max(10, target - 5))}
            >
              −
            </button>

            <strong>{target}</strong>

            <button
              onClick={() => setTarget(Math.min(500, target + 5))}
            >
              +
            </button>
          </div>
        </label>

        <div className="bot-settings">
          <div className="bot-setting-head">
            <div>
              <span className="panel-kicker">BOT PLAYERS</span>
              <b>Fill empty seats with AI</b>
              <small>
                Perfect for solo practice or a quick table.
              </small>
            </div>

            <div className="bot-count">
              <button
                onClick={() => setBots(Math.max(0, bots - 1))}
              >
                −
              </button>

              <strong>{bots}</strong>

              <button
                onClick={() => setBots(Math.min(5, bots + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="bot-presets">
            {[
              ['0', 'OFF'],
              ['1', '1 BOT'],
              ['2', '2 BOTS'],
              ['3', '3 BOTS'],
              ['5', '5 BOTS']
            ].map(([v, label]) => (
              <button
                key={v}
                className={bots === Number(v) ? 'selected' : ''}
                onClick={() => setBots(Number(v))}
              >
                {label}
              </button>
            ))}
          </div>

          {bots > 0 && (
            <label>
              Bot difficulty

              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
              >
                <option value="EASY">Easy — relaxed</option>
                <option value="NORMAL">Normal — balanced</option>
                <option value="HARD">Hard — strategic</option>
              </select>
            </label>
          )}
        </div>

        <div className="timer-setting create-timer-setting">
          <div className="timer-setting-head">
            <div>
              <span className="panel-kicker">TURN TIMER</span>
              <b>{turnSeconds === 0 ? 'OFF' : `${turnSeconds}s`}</b>
            </div>
            <span>HOST SETTING</span>
          </div>
          <div className="timer-presets">
            {[0, 10, 15, 30, 45, 60, 90].map(v => (
              <button
                key={v}
                type="button"
                className={turnSeconds === v ? 'selected' : ''}
                onClick={() => setTurnSeconds(v)}
              >
                {v === 0 ? 'OFF' : `${v}s`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={Math.max(5, turnSeconds || 5)}
            disabled={turnSeconds === 0}
            onChange={e => setTurnSeconds(Number(e.target.value))}
          />
          <small>Choose OFF for unlimited turns, or set the maximum time each player has to complete a turn.</small>
        </div>

        <div className="setting-note">
          <Sparkles size={16} />

          <div>
            <b>Lower score wins</b>
            <span>
              Default target is 50. Bots use the same
              server-authoritative rules as human players.
            </span>
          </div>
        </div>

        <button
          className="btn primary wide"
          disabled={name.trim().length < 2}
          onClick={() => onCreate(name, target, bots, difficulty, turnSeconds)}
        >
          Create game <span>→</span>
        </button>
      </div>
    </FormShell>
  );
}

function Join({ onBack, onJoin }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <FormShell
      title="Join a table"
      subtitle="Enter the room code shared by your host."
      onBack={onBack}
    >
      <div className="form-card">
        <label>
          Player name

          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your display name"
            maxLength={20}
          />
        </label>

        <label>
          Room code

          <input
            className="code-input"
            value={code}
            onChange={e =>
              setCode(
                e.target.value
                  .replace(/[^a-z0-9]/gi, '')
                  .slice(0, 5)
                  .toUpperCase()
              )
            }
            placeholder="A7K92"
          />
        </label>

        <button
          className="btn primary wide"
          disabled={name.trim().length < 2 || code.length !== 5}
          onClick={() => onJoin(name, code)}
        >
          Join table <span>→</span>
        </button>
      </div>
    </FormShell>
  );
}

function Lobby({ room, state, onBack, onStart, onTarget }) {
  const me = state?.players?.find(p => p.id === room.playerId);
  const host = me?.host;

  const players =
    state?.players || [
      {
        id: room.playerId,
        name: 'You',
        score: 0,
        status: 'CONNECTED',
        host: true,
        dealer: false
      }
    ];

  return (
    <main className="lobby page-shell">
      <div className="lobby-top">
        <div>
          <div className="eyebrow">
            <span />
            <span>WAITING ROOM</span>
          </div>

          <h2>Make yourselves comfortable.</h2>

          <p>
            Share the code and start when at least three players are ready.
          </p>
        </div>

        <div className="room-code">
          <small>ROOM CODE</small>
          <strong>{room.roomCode}</strong>

          <button
            onClick={() =>
              navigator.clipboard?.writeText(room.roomCode)
            }
          >
            <Copy size={15} />
          </button>
        </div>
      </div>

      <div className="lobby-grid">
        <section className="panel players-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">PLAYERS</span>
              <h3>{players.length} / 6 seated</h3>
            </div>

            <span className="live-chip">
              <span />
              LIVE
            </span>
          </div>

          <div className="player-list">
            {[...Array(6)].map((_, i) => {
              const p = players[i];

              return p ? (
                <div className="lobby-player" key={p.id}>
                  <Avatar name={p.name} />

                  <div className="player-main">
                    <b>{p.name}</b>
                    <span>
                      {p.bot
                        ? 'AI PLAYER'
                        : p.host
                        ? 'HOST'
                        : 'CONNECTED'}
                    </span>
                  </div>

                  {p.host && (
                    <Crown size={16} className="gold" />
                  )}

                  <div className="ready">
                    <Check size={13} />
                    READY
                  </div>
                </div>
              ) : (
                <div className="lobby-player empty" key={i}>
                  <div className="empty-avatar">{i + 1}</div>

                  <div>
                    <b>Waiting for player</b>
                    <span>Share room code to invite</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">GAME SETTINGS</span>
              <h3>Table rules</h3>
            </div>

            <span className="lock-note">HOST ONLY</span>
          </div>

          <label>
            Target score

            <div className="target-line">
              <strong>{state?.targetScore ?? 50}</strong>
              <span>points</span>
            </div>
          </label>

          <input
            type="range"
            min="10"
            max="200"
            step="5"
            value={state?.targetScore ?? 50}
            disabled={!host}
            onChange={e => onTarget(Number(e.target.value))}
          />

          <p className="setting-help">
            First active player to reach the target is eliminated.
            The final player standing wins.
          </p>

          <button
            className="btn primary wide"
            disabled={!host || players.length < 3}
            onClick={onStart}
          >
            {players.length < 3 ? 'Need 3 players' : 'Start game'}
            <span>→</span>
          </button>

          <div className="minimum">
            <Users size={15} />
            <span>Minimum 3 players</span>
            <i>{players.length}/3</i>
          </div>
        </section>
      </div>
    </main>
  );
}

export {
  Landing,
  Create,
  Join,
  Lobby
};
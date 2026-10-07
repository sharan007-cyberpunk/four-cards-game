# Four Cards

A production-oriented, server-authoritative multiplayer card game for 3–6 players. The project contains a React/Vite frontend, Spring Boot backend, STOMP/WebSocket real-time transport, PostgreSQL persistence for game history, Docker Compose for local PostgreSQL, and backend rule tests.

## Stack

- Frontend: React 19, Vite, JavaScript, CSS, Lucide icons
- Backend: Java 21, Spring Boot 3.5, Spring Web, WebSocket/STOMP, Spring Data JPA, Maven
- Database: PostgreSQL 17
- Live game state: in-memory backend runtime; persistent game/round records in PostgreSQL

## Architecture

The backend owns the game state. Clients send intents only: drop cards, draw, take the drop card, open, or advance a completed round. The server validates turn, phase, card ownership, same-rank rules, opening rules, score calculation, target elimination, dealer rotation, deck exhaustion, and game-over conditions.

Public WebSocket state contains only safe table information. Private state is delivered through STOMP user destinations (`/user/queue/private`) and contains the connected player's own hand and legal actions.

### Game phases

`LOBBY → ROUND_START → PLAYING → OPEN_CONFIRMATION → ROUND_RESULT → PLAYING … → GAME_OVER`

## Project structure

```text
four-cards-game/
├── frontend/
│   ├── src/
│   │   ├── components/   # reserved for further decomposition
│   │   ├── pages/        # reserved page modules
│   │   ├── services/     # API/WebSocket service layer can be extracted here
│   │   ├── state/
│   │   └── styles/
│   └── package.json
├── backend/
│   ├── src/main/java/com/fourcards/
│   │   ├── config/
│   │   ├── controller/
│   │   ├── dto/
│   │   ├── game/
│   │   ├── model/
│   │   ├── repository/
│   │   ├── service/
│   │   └── websocket/
│   └── pom.xml
├── docker-compose.yml
└── README.md
```

## Run PostgreSQL

Copy `.env.example` to `.env`, change credentials if desired, then:

```bash
docker compose up -d postgres
```

If Docker is unavailable, point `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD` at an existing PostgreSQL 17+ database.

## Backend

Requires Java 21+ and Maven 3.9+.

```bash
cd backend
mvn spring-boot:run
```

The API is available at `http://localhost:8080` and the STOMP endpoint is `ws://localhost:8080/ws`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

Optional frontend environment variables:

```text
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

## REST endpoints

- `POST /api/rooms` — create a room
- `POST /api/rooms/{roomCode}/join` — join a lobby
- `GET /api/rooms/{roomCode}` — read public room state
- `POST /api/rooms/{roomCode}/reconnect` — reconnect a known player identity between rounds
- `PUT /api/rooms/{roomCode}/settings/target?playerId=...&value=...` — host target score update
- `POST /api/rooms/{roomCode}/start` — host starts the game

## WebSocket/STOMP

Connect to `/ws` with native STOMP header:

```text
player-id: <player id returned by create/join>
```

Subscribe to:

```text
/topic/rooms/{roomCode}
/user/queue/private
```

Send to:

```text
/app/room/{roomCode}/drop
/app/room/{roomCode}/draw
/app/room/{roomCode}/take
/app/room/{roomCode}/open
/app/room/{roomCode}/next
/app/room/{roomCode}/disconnect
```

Payload examples:

```json
{"playerId":"...","cardCodes":["9♥","9♠"]}
```

```json
{"playerId":"..."}
```

## Rules implemented

- Standard 52-card deck
- 3–6 players
- Four cards per active player
- One randomly selected rank is the Joker rank each round; all cards of that rank score 0
- Normal values: A=1, 2–10 face value, J/Q/K=10
- Same-rank multi-card drops are legal; mixed-rank drops are rejected
- Drop must happen before a normal draw
- Draw exactly one card from deck or top drop card
- Last card pushed to the drop pile is the available top card
- Opening is only available at the beginning of a player's turn and pauses normal play for 10 seconds
- Equal-score opener wins; strictly lower opposing score causes +40 penalty
- Target-score elimination, including multiple eliminations in one round
- Dealer rotation skips eliminated players
- Disconnection eliminates the player for the current round, skips their interrupted turn, and allows identity-based reconnection between rounds
- Deck exhaustion reshuffles the drop pile while preserving the current top drop card

## Testing

Backend tests live under `backend/src/test`. Run:

```bash
cd backend
mvn test
```

The tests cover deck size, values, joker scoring, drop validation, drop-before-draw, opening/tie/penalty scoring, target elimination, dealer rotation, deck reshuffling, and disconnect/turn behavior.

## Production notes

This version deliberately keeps live room state in process memory for low-latency gameplay. For horizontal scaling, move room state and scheduled opening jobs to a shared state layer such as Redis, add a WebSocket broker strategy, and use a stable player/session identity service. PostgreSQL remains the durable store for game history.

## Build

```bash
cd frontend && npm run build
cd ../backend && mvn clean package
```

The frontend build output is in `frontend/dist`; the backend jar is in `backend/target`.

## Live Voice Chat

Four Cards now includes optional browser-to-browser live voice chat during a room/game.

- WebRTC audio mesh for up to 6 human players
- STOMP is used only for WebRTC signaling (offers, answers, ICE candidates)
- Microphone permission is requested only when the player presses **Join voice**
- Echo cancellation, noise suppression and automatic gain control are enabled
- Mute, deafen and leave-voice controls are available
- Bot players never join the voice mesh
- Voice is peer-to-peer; the Spring server does not relay microphone audio

For production deployments, serve the frontend over HTTPS and provide a TURN server in `frontend/src/services/voice.js` for reliable connectivity across restrictive NAT/firewalls. The included Google STUN servers are suitable for development/testing but are not a replacement for TURN in production.

## Bot Players

The Create Game screen can fill empty seats with server-controlled AI players.

- 0–5 bots can be added
- Easy / Normal / Hard difficulty
- Bots are real server-side players, not frontend simulations
- Bots use the same `GameEngine` validation and scoring rules as humans
- Bots cannot see human private hands
- Bot turns are scheduled by the backend
- Bot decisions include valid same-rank drops, deck/drop selection, and strategic opening decisions

Create-room payload now accepts:

```json
{
  "playerName": "Sharan",
  "targetScore": 50,
  "botCount": 2,
  "botDifficulty": "NORMAL"
}
```

Valid difficulties are `EASY`, `NORMAL`, and `HARD`.

## Voice WebSocket Signaling

The existing WebSocket endpoint remains:

`/ws`

Game state continues to use `/topic/rooms/{roomCode}`.

Voice signaling uses:

`/app/room/{roomCode}/voice`

and broadcasts to:

`/topic/rooms/{roomCode}/voice`

Voice signaling messages contain only WebRTC negotiation data. They do not contain game cards, scores, or microphone audio.

package com.fourcards.service;

import com.fourcards.dto.*;
import com.fourcards.game.*;
import com.fourcards.model.*;
import com.fourcards.repository.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

@Service
public class GameService {

    private final Map<String, GameRuntime> rooms = new ConcurrentHashMap<>();
    private final Set<String> scheduledBots = ConcurrentHashMap.newKeySet();

    private final GameEngine engine;
    private final SimpMessagingTemplate messaging;
    private final PersistedGameRepository games;
    private final PersistedRoundRepository rounds;
    private final ScheduledExecutorService scheduler =
            Executors.newScheduledThreadPool(4);

    public GameService(
            @Value("${app.opening-seconds:10}") long seconds,
            SimpMessagingTemplate messaging,
            PersistedGameRepository games,
            PersistedRoundRepository rounds
    ) {
        this.engine = new GameEngine(seconds);
        this.messaging = messaging;
        this.games = games;
        this.rounds = rounds;
    }

    // =========================================================
    // CREATE ROOM + OPTIONAL BOTS
    // =========================================================

    public RoomResponse create(
            String name,
            Integer target,
            Integer botCount,
            BotDifficulty difficulty
    ) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Player name is required");
        }

        int targetScore = target == null ? 50 : target;
        if (targetScore <= 0 || targetScore > 500) {
            throw new IllegalArgumentException("Target score must be between 1 and 500");
        }

        int bots = botCount == null ? 0 : botCount;
        if (bots < 0 || bots > 5) {
            throw new IllegalArgumentException("Bot count must be between 0 and 5");
        }

        BotDifficulty botDifficulty =
                difficulty == null ? BotDifficulty.NORMAL : difficulty;

        String code = uniqueCode();
        GameRuntime game = new GameRuntime(code);
        game.targetScore = targetScore;

        String playerId = UUID.randomUUID().toString();
        game.players.add(
                new PlayerRuntime(
                        playerId,
                        name.trim(),
                        true,
                        false,
                        BotDifficulty.NORMAL
                )
        );

        for (int i = 1; i <= bots; i++) {
            game.players.add(
                    new PlayerRuntime(
                            "bot-" + UUID.randomUUID(),
                            botName(i),
                            false,
                            true,
                            botDifficulty
                    )
            );
        }

        rooms.put(code, game);
        games.save(new PersistedGame(code, game.targetScore));

        return new RoomResponse(code, playerId);
    }

    // Backward-compatible overload for existing callers/tests.
    public RoomResponse create(String name, Integer target) {
        return create(name, target, 0, BotDifficulty.NORMAL);
    }

    // =========================================================
    // JOIN
    // =========================================================

    public RoomResponse join(String code, String name) {
        GameRuntime game = requireRoom(code);

        if (game.phase != GamePhase.LOBBY) {
            throw new IllegalStateException("Game already started");
        }

        if (game.players.size() >= 6) {
            throw new IllegalStateException("Room is full");
        }

        String playerName = name == null ? "" : name.trim();
        if (playerName.length() < 2) {
            throw new IllegalArgumentException("Player name must contain at least 2 characters");
        }

        if (game.players.stream().anyMatch(p ->
                p.name.equalsIgnoreCase(playerName))) {
            throw new IllegalStateException("Player name already exists");
        }

        String pid = UUID.randomUUID().toString();
        game.players.add(new PlayerRuntime(pid, playerName, false));

        broadcast(game, playerName + " joined the room");
        return new RoomResponse(game.roomCode, pid);
    }

    // =========================================================
    // START
    // =========================================================

    public void start(String code, String pid) {
        GameRuntime game = requireRoom(code);
        PlayerRuntime player = game.player(pid);

        if (!player.host) {
            throw new IllegalStateException("Only host can start");
        }

        if (game.players.size() < 3) {
            throw new IllegalStateException("Minimum 3 players required");
        }

        if (game.players.size() > 6) {
            throw new IllegalStateException("Maximum 6 players allowed");
        }

        engine.start(game);
        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    // =========================================================
    // TARGET SCORE
    // =========================================================

    public void setTarget(String code, String pid, int target) {
        GameRuntime game = requireRoom(code);

        if (game.phase != GamePhase.LOBBY) {
            throw new IllegalStateException("Settings locked");
        }

        if (!game.player(pid).host) {
            throw new IllegalStateException("Only host can change settings");
        }

        if (target <= 0 || target > 500) {
            throw new IllegalArgumentException("Target score must be 1–500");
        }

        game.targetScore = target;
        broadcast(game, "Target updated");
    }

    // =========================================================
    // GAME ACTIONS
    // =========================================================

    public void drop(String code, GameActionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Action request is required");
        }

        GameRuntime game = requireRoom(code);
        engine.drop(game, request.playerId(), request.cardCodes());
        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    public void drawDeck(String code, String pid) {
        GameRuntime game = requireRoom(code);
        engine.drawDeck(game, pid);
        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    public void takeDrop(String code, String pid) {
        GameRuntime game = requireRoom(code);
        engine.takeDrop(game, pid);
        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    public void open(String code, String pid) {
        GameRuntime game = requireRoom(code);
        engine.open(game, pid);
        broadcastAll(game);

        long delay = Math.max(
                0L,
                Duration.between(
                        Instant.now(),
                        game.openingEndsAt
                ).toMillis()
        );

        scheduler.schedule(
                () -> {
                    synchronized (game) {
                        if (game.phase == GamePhase.OPEN_CONFIRMATION) {
                            engine.evaluateOpening(game);
                            persistRound(game);
                            broadcastAll(game);
                        }
                    }
                },
                delay,
                TimeUnit.MILLISECONDS
        );
    }

    public void nextRound(String code, String pid) {
        GameRuntime game = requireRoom(code);

        if (!game.player(pid).host) {
            throw new IllegalStateException("Only host can advance");
        }

        if (game.phase != GamePhase.ROUND_RESULT) {
            throw new IllegalStateException("Round is not complete");
        }

        engine.nextRound(game);
        persistRound(game);
        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    // =========================================================
    // BOT ENGINE
    // =========================================================

    private void scheduleBotIfNeeded(GameRuntime game) {
        if (game.phase != GamePhase.PLAYING) {
            return;
        }

        PlayerRuntime current = game.currentPlayer();
        if (current == null || !current.bot || !current.active()) {
            return;
        }

        String jobKey = game.roomCode + ":" + current.id;
        if (!scheduledBots.add(jobKey)) {
            return;
        }

        long delay = switch (current.botDifficulty) {
            case EASY -> 1200L;
            case NORMAL -> 850L;
            case HARD -> 650L;
        };

        scheduler.schedule(() -> {
            try {
                performBotTurn(game, current.id);
            } finally {
                scheduledBots.remove(jobKey);
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void performBotTurn(GameRuntime game, String botId) {
        synchronized (game) {
            if (game.phase != GamePhase.PLAYING) {
                return;
            }

            PlayerRuntime bot = game.player(botId);
            if (!bot.bot || !bot.active()) {
                return;
            }

            PlayerRuntime current = game.currentPlayer();
            if (current == null || !current.id.equals(botId)) {
                return;
            }

            try {
                if (game.mustDrawAfterDrop) {
                    botDraw(game, bot);
                } else {
                    if (shouldBotOpen(game, bot)) {
                        engine.open(game, bot.id);
                        broadcastAll(game);
                        scheduleOpeningEvaluation(game);
                        return;
                    }

                    List<String> drop = chooseBotDrop(game, bot);
                    engine.drop(game, bot.id, drop);
                    broadcastAll(game);

                    scheduler.schedule(
                            () -> performBotDraw(game, bot.id),
                            bot.botDifficulty == BotDifficulty.EASY ? 800L : 550L,
                            TimeUnit.MILLISECONDS
                    );
                }
            } catch (RuntimeException ex) {
                // A bot must never stall the table. Fall back to a legal
                // single-card drop if its strategy becomes invalid.
                if (!game.mustDrawAfterDrop && game.phase == GamePhase.PLAYING) {
                    try {
                        CardFallback.dropOne(engine, game, bot);
                        broadcastAll(game);
                        scheduler.schedule(
                                () -> performBotDraw(game, bot.id),
                                450L,
                                TimeUnit.MILLISECONDS
                        );
                    } catch (RuntimeException ignored) {
                        // The game state will be re-evaluated on the next server action.
                    }
                }
            }
        }
    }

    private void performBotDraw(GameRuntime game, String botId) {
        synchronized (game) {
            if (game.phase != GamePhase.PLAYING || !game.mustDrawAfterDrop) {
                return;
            }

            PlayerRuntime bot = game.player(botId);
            if (!bot.bot || !bot.active()) {
                return;
            }

            try {
                botDraw(game, bot);
            } catch (RuntimeException ignored) {
                // Do not crash the scheduler because of an exhausted deck edge case.
            }
        }
    }

    private void botDraw(GameRuntime game, PlayerRuntime bot) {
        boolean take = false;

        if (!game.dropPile.isEmpty()) {
            Card top = game.dropPile.peek();
            int topValue = top.value(game.jokerRank);
            int bestHandValue = bot.hand.stream()
                    .mapToInt(c -> c.value(game.jokerRank))
                    .max()
                    .orElse(0);

            take = switch (bot.botDifficulty) {
                case EASY -> game.random.nextBoolean();
                case NORMAL -> topValue <= Math.min(6, bestHandValue);
                case HARD -> topValue == 0 || topValue <= bestHandValue;
            };
        }

        if (take) {
            engine.takeDrop(game, bot.id);
        } else {
            engine.drawDeck(game, bot.id);
        }

        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    private boolean shouldBotOpen(GameRuntime game, PlayerRuntime bot) {
        int score = game.scorer.score(bot.hand, game.jokerRank);

        return switch (bot.botDifficulty) {
            case EASY -> score <= 4 && game.random.nextInt(100) < 30;
            case NORMAL -> score <= 7 && game.random.nextInt(100) < 60;
            case HARD -> score <= 9;
        };
    }

    private List<String> chooseBotDrop(GameRuntime game, PlayerRuntime bot) {
        Map<Rank, List<Card>> groups = new EnumMap<>(Rank.class);
        for (Card card : bot.hand) {
            groups.computeIfAbsent(card.rank(), k -> new ArrayList<>()).add(card);
        }

        List<List<Card>> candidates = new ArrayList<>(groups.values());

        candidates.sort(
                Comparator.comparingInt(
                        cards -> -cards.stream()
                                .mapToInt(c -> c.value(game.jokerRank))
                                .sum()
                )
        );

        List<Card> chosen;

        if (bot.botDifficulty == BotDifficulty.EASY) {
            List<Card> nonZero = bot.hand.stream()
                    .filter(c -> c.value(game.jokerRank) > 0)
                    .toList();

            if (nonZero.isEmpty()) {
                chosen = List.of(bot.hand.get(0));
            } else {
                chosen = List.of(
                        nonZero.get(game.random.nextInt(nonZero.size()))
                );
            }
        } else {
            chosen = candidates.get(0);
        }

        return chosen.stream().map(Card::code).toList();
    }

    private void scheduleOpeningEvaluation(GameRuntime game) {
        if (game.openingEndsAt == null) {
            return;
        }

        long delay = Math.max(
                0L,
                Duration.between(
                        Instant.now(),
                        game.openingEndsAt
                ).toMillis()
        );

        scheduler.schedule(() -> {
            synchronized (game) {
                if (game.phase == GamePhase.OPEN_CONFIRMATION) {
                    engine.evaluateOpening(game);
                    persistRound(game);
                    broadcastAll(game);
                }
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private String botName(int index) {
        String[] names = {
                "Atlas Bot",
                "Nova Bot",
                "Ace Bot",
                "Milo Bot",
                "Echo Bot"
        };
        return names[(index - 1) % names.length];
    }

    // =========================================================
    // VOICE CHAT SIGNALING
    // =========================================================

    public void broadcastVoice(
            String code,
            VoiceSignal signal
    ) {
        GameRuntime game = requireRoom(code);

        if (signal == null || signal.fromPlayerId() == null) {
            throw new IllegalArgumentException("Invalid voice signal");
        }

        if (game.players.stream().noneMatch(
                p -> p.id.equals(signal.fromPlayerId()))) {
            throw new IllegalArgumentException("Voice sender is not in this room");
        }

        if (signal.toPlayerId() != null && game.players.stream().noneMatch(
                p -> p.id.equals(signal.toPlayerId()))) {
            throw new IllegalArgumentException("Voice recipient is not in this room");
        }

        messaging.convertAndSend(
                "/topic/rooms/" + game.roomCode + "/voice",
                signal
        );
    }

    // =========================================================
    // CONNECTION
    // =========================================================

    public void reconnect(String code, String pid) {
        GameRuntime game = requireRoom(code);

        if (game.phase != GamePhase.LOBBY
                && game.phase != GamePhase.ROUND_RESULT) {
            throw new IllegalStateException(
                    "Reconnect is available between rounds"
            );
        }

        PlayerRuntime p = game.player(pid);
        if (p.status == PlayerStatus.ELIMINATED) {
            throw new IllegalStateException("Player is eliminated");
        }

        p.status = PlayerStatus.CONNECTED;
        broadcast(game, p.name + " reconnected");
    }

    public void disconnectPlayerFromAll(String pid) {
        for (GameRuntime game : rooms.values()) {
            if (game.players.stream().anyMatch(p -> p.id.equals(pid))) {
                disconnect(game.roomCode, pid);
                return;
            }
        }
    }

    public void disconnect(String code, String pid) {
        GameRuntime game = rooms.get(code.toUpperCase(Locale.ROOT));
        if (game == null) {
            return;
        }

        PlayerRuntime p = game.player(pid);

        if (game.phase == GamePhase.LOBBY) {
            p.status = PlayerStatus.DISCONNECTED;
            broadcast(game, p.name + " disconnected");
            return;
        }

        if (p.status == PlayerStatus.ELIMINATED) {
            return;
        }

        p.status = PlayerStatus.DISCONNECTED;

        if (game.currentPlayer() != null
                && game.currentPlayer().id.equals(pid)) {
            game.advanceTurn();
        }

        if (game.activePlayers().size() <= 1) {
            game.phase = GamePhase.GAME_OVER;
        }

        broadcastAll(game);
        scheduleBotIfNeeded(game);
    }

    // =========================================================
    // STATE
    // =========================================================

    public PublicGameState publicState(String code) {
        return toPublic(requireRoom(code));
    }

    public PrivateGameState privateState(
            String code,
            String pid
    ) {
        GameRuntime g = requireRoom(code);
        PlayerRuntime p = g.player(pid);

        List<String> legal = new ArrayList<>();

        PlayerRuntime current = g.currentPlayer();
        boolean myTurn = current != null
                && current.id.equals(pid);

        if (g.phase == GamePhase.PLAYING && myTurn) {
            if (!g.mustDrawAfterDrop) {
                legal.add("DROP");
                legal.add("OPEN");
            }

            if (g.mustDrawAfterDrop) {
                legal.add("DRAW_DECK");
                legal.add("TAKE_DROP");
            }
        }

        return new PrivateGameState(
                toPublic(g),
                pid,
                p.hand.stream()
                        .map(c -> CardDto.of(c, g.jokerRank))
                        .toList(),
                List.of(),
                legal
        );
    }

    private void broadcastAll(GameRuntime g) {
        broadcast(g, g.message);
    }

    private void broadcast(
            GameRuntime g,
            String message
    ) {
        g.message = message;

        messaging.convertAndSend(
                "/topic/rooms/" + g.roomCode,
                toPublic(g)
        );

        for (PlayerRuntime p : g.players) {
            messaging.convertAndSendToUser(
                    p.id,
                    "/queue/private",
                    privateState(g.roomCode, p.id)
            );
        }
    }

    private PublicGameState toPublic(GameRuntime g) {
        List<PlayerPublicDto> players =
                g.players.stream()
                        .map(p -> new PlayerPublicDto(
                                p.id,
                                p.name,
                                p.score,
                                p.status,
                                p.host,
                                p.dealer,
                                p.bot
                        ))
                        .toList();

        PlayerRuntime cur = g.currentPlayer();

        String top = g.dropPile.isEmpty()
                ? null
                : g.dropPile.peek().code();

        return new PublicGameState(
                g.roomCode,
                g.phase,
                players,
                cur == null ? null : cur.id,
                top,
                g.jokerRank == null ? null : g.jokerRank.symbol,
                g.deck == null ? 0 : g.deck.size(),
                g.targetScore,
                g.roundNumber,
                g.message,
                g.openingEndsAt == null
                        ? null
                        : g.openingEndsAt.toEpochMilli()
        );
    }

    private GameRuntime requireRoom(String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Room code is required");
        }

        GameRuntime g = rooms.get(
                code.trim().toUpperCase(Locale.ROOT)
        );

        if (g == null) {
            throw new NoSuchElementException("Room not found");
        }

        return g;
    }

    private String uniqueCode() {
        String alphabet =
                "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        Random random = new Random();
        String code;

        do {
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 5; i++) {
                b.append(
                        alphabet.charAt(
                                random.nextInt(alphabet.length())
                        )
                );
            }
            code = b.toString();
        } while (rooms.containsKey(code));

        return code;
    }

    private void persistRound(GameRuntime g) {
        PersistedGame pg = games
                .findByRoomCode(g.roomCode)
                .orElse(null);

        if (pg != null) {
            rounds.save(
                    new PersistedRound(
                            pg,
                            g.roundNumber,
                            g.message
                    )
            );
        }
    }

    // Keeps bot fallback logic inside the service without exposing
    // engine internals as a public API.
    private static final class CardFallback {
        private static void dropOne(
                GameEngine engine,
                GameRuntime game,
                PlayerRuntime bot
        ) {
            Card selected = bot.hand.stream()
                    .max(Comparator.comparingInt(
                            c -> c.value(game.jokerRank)
                    ))
                    .orElseThrow();

            engine.drop(
                    game,
                    bot.id,
                    List.of(selected.code())
            );
        }
    }
}

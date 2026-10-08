package com.fourcards.game;

import com.fourcards.model.*;
import java.time.*;
import java.util.*;

public class GameEngine {
  private final long openingSeconds;
  private final long turnSeconds;

  public GameEngine(long openingSeconds, long turnSeconds) {
    this.openingSeconds = openingSeconds;
    this.turnSeconds = turnSeconds;
  }

  public GameEngine(long openingSeconds) { this(openingSeconds, 15); }

  public synchronized void start(GameRuntime g) {
    if (g.players.size() < 3 || g.players.size() > 6)
      throw new IllegalStateException("Game requires 3–6 players");
    g.phase = GamePhase.ROUND_START;
    startRound(g);
  }

  public synchronized void startRound(GameRuntime g) {
    List<PlayerRuntime> active = g.activePlayers();
    if (active.size() <= 1) {
      g.phase = GamePhase.GAME_OVER;
      return;
    }

    g.roundNumber++;
    for (PlayerRuntime p : g.players) p.roundScore = null;
    g.openingSuccess = null;
    g.lowestScorePlayerId = null;
    g.lowestScore = null;
    g.openingLoserId = null;
    g.deck = Deck.standardShuffled(g.random);
    g.dropPile.clear();
    g.jokerCard = null;
    g.jokerRank = null;
    g.previousTopDropCard = null;
    g.mustDrawAfterDrop = false;
    g.pendingDropCards.clear();

    // Deal exactly four cards to active players only.
    for (PlayerRuntime p : active) {
      p.hand.clear();
      for (int i = 0; i < 4; i++) p.hand.add(g.deck.draw());
    }

    // Remove one real physical card from the playable deck and make it the
    // immutable Joker for this round. It is never returned to the deck.
    Card physicalJoker = g.deck.drawRandom(g.random);
    g.jokerCard = new JokerCard(physicalJoker);
    g.jokerRank = physicalJoker.rank();

    // One separate physical card starts the discard history.
    g.dropPile.addFirst(g.deck.draw());

    for (PlayerRuntime p : g.players) p.dealer = false;
    PlayerRuntime dealer = dealerForRound(g, active);
    dealer.dealer = true;
    g.dealerIndex = indexOfActive(g, dealer);
    g.turnIndex = g.dealerIndex;
    g.phase = GamePhase.PLAYING;
    g.beginTurn(g.timerEnabled ? g.turnSeconds : 0);
    g.message = "Round " + g.roundNumber + " started — Joker " + g.jokerRank.symbol;
  }

  private PlayerRuntime dealerForRound(GameRuntime g, List<PlayerRuntime> active) {
    if (g.roundNumber == 1) return active.get(0);
    return active.get(g.dealerIndex % active.size());
  }

  private int indexOfActive(GameRuntime g, PlayerRuntime p) {
    return g.activePlayers().indexOf(p);
  }

  public synchronized void drop(GameRuntime g, String pid, List<String> codes) {
    requireTurn(g, pid);
    ensurePlaying(g);

    if (g.mustDrawAfterDrop)
      throw new IllegalStateException("You must draw after dropping");

    if (codes == null || codes.isEmpty())
      throw new IllegalArgumentException("Select at least one card");

    PlayerRuntime p = g.player(pid);
    List<Card> selected = resolveCards(p, codes);

    Rank rank = selected.get(0).rank();
    if (selected.stream().anyMatch(c -> c.rank() != rank))
      throw new IllegalArgumentException("All dropped cards must have the same rank");

    // Keep the current-turn drop in a dedicated temporary area. It is visible to
    // everyone, but is NOT part of the discard pile until the player chooses a
    // source (previous drop or draw deck). This keeps the previous discard
    // clickable and prevents the newly dropped card from becoming drawable.
    g.pendingDropCards.clear();
    for (Card c : selected) {
      p.hand.remove(c);
      g.pendingDropCards.add(c);
    }

    g.mustDrawAfterDrop = true;
    g.message = p.name + " dropped " + selected.size()
        + " card" + (selected.size() > 1 ? "s" : "");
  }

  public synchronized Card drawDeck(GameRuntime g, String pid) {
    requireTurn(g, pid);
    ensurePlaying(g);

    if (!g.mustDrawAfterDrop)
      throw new IllegalStateException("Drop before draw");

    ensureDeck(g);

    commitPendingDrop(g);
    Card c = g.deck.draw();
    g.player(pid).hand.add(c);
    afterDraw(g);
    return c;
  }

  public synchronized Card takeDrop(GameRuntime g, String pid) {
    requireTurn(g, pid);
    ensurePlaying(g);

    if (!g.mustDrawAfterDrop)
      throw new IllegalStateException("Drop before draw");

    Card drawable = g.previousTopDropCard;
    if (drawable == null || !g.dropPile.contains(drawable))
      throw new IllegalStateException("The previous discard is no longer available");

    // The previous discard is the only discard card drawable by this player.
    // First commit this turn's temporary drop to the top of the discard pile,
    // then remove the previous visible card and give it to the player.
    commitPendingDrop(g);
    boolean removed = g.dropPile.removeFirstOccurrence(drawable);
    if (!removed)
      throw new IllegalStateException("Previous discard could not be located");

    g.player(pid).hand.add(drawable);
    afterDraw(g);
    return drawable;
  }


  private void commitPendingDrop(GameRuntime g) {
    if (g.pendingDropCards.isEmpty()) return;
    // Preserve the order of a multi-card same-rank drop while keeping the last
    // dropped card as the visible top card.
    for (int i = g.pendingDropCards.size() - 1; i >= 0; i--) {
      g.dropPile.addFirst(g.pendingDropCards.get(i));
    }
    g.pendingDropCards.clear();
  }

  private void afterDraw(GameRuntime g) {
    g.mustDrawAfterDrop = false;
    g.advanceTurn(g.turnSeconds);
    g.message = "Turn complete";
  }

  public synchronized void open(GameRuntime g, String pid) {
    requireTurn(g, pid);
    ensurePlaying(g);

    if (g.mustDrawAfterDrop)
      throw new IllegalStateException("You must draw after dropping");

    if (g.openingPlayerId != null)
      throw new IllegalStateException("Opening is already in progress");

    g.phase = GamePhase.OPEN_CONFIRMATION;
    g.openingPlayerId = pid;
    g.openingOriginalTurnEndsAt = g.turnEndsAt;
    g.turnEndsAt = null;
    g.openingEndsAt = Instant.now().plusSeconds(openingSeconds);
    g.message = g.player(pid).name + " opened";
  }

  public synchronized void withdrawOpening(GameRuntime g, String pid) {
    if (g.phase != GamePhase.OPEN_CONFIRMATION)
      throw new IllegalStateException("No opening is in progress");
    if (!Objects.equals(g.openingPlayerId, pid))
      throw new IllegalStateException("Only the opening player can withdraw");

    g.phase = GamePhase.PLAYING;
    g.openingPlayerId = null;
    g.openingEndsAt = null;
    g.turnEndsAt = g.openingOriginalTurnEndsAt;
    g.openingOriginalTurnEndsAt = null;
    g.message = g.player(pid).name + " withdrew the opening and continues the turn";
  }

  public synchronized void evaluateOpening(GameRuntime g) {
    if (g.phase != GamePhase.OPEN_CONFIRMATION) return;

    PlayerRuntime opener = g.players.stream()
        .filter(p -> p.id.equals(g.openingPlayerId))
        .findFirst()
        .orElse(null);

    if (opener == null) {
      g.phase = GamePhase.GAME_OVER;
      return;
    }

    int openerScore = g.scorer.score(opener.hand, g.jokerRank);
    Map<PlayerRuntime, Integer> scores = new LinkedHashMap<>();

    for (PlayerRuntime p : g.activePlayers())
      scores.put(p, g.scorer.score(p.hand, g.jokerRank));

    int lowest = scores.values().stream()
        .min(Integer::compareTo)
        .orElse(openerScore);

    boolean success = openerScore <= lowest;
    PlayerRuntime lowestPlayer = scores.entrySet().stream()
        .min(Map.Entry.comparingByValue())
        .map(Map.Entry::getKey)
        .orElse(opener);
    g.openingSuccess = success;
    g.lowestScorePlayerId = lowestPlayer.id;
    g.lowestScore = scores.get(lowestPlayer);
    g.openingLoserId = success ? null : opener.id;

    for (var e : scores.entrySet()) {
      int roundScore = e.getKey() == opener
          ? (success ? 0 : 40)
          : (success ? e.getValue() : 0);
      e.getKey().roundScore = roundScore;
      e.getKey().score += roundScore;
    }

    eliminateAtTarget(g);
    g.phase = GamePhase.ROUND_RESULT;
    if (success) {
      g.message = opener.name + " opened successfully — lowest score";
    } else {
      int lowestScore = scores.getOrDefault(lowestPlayer, 0);
      g.message = "Opening failed — " + lowestPlayer.name + " had the lowest score ("
          + lowestScore + "). " + opener.name + " lost the round (+40).";
    }

    g.openingEndsAt = null;
    g.openingOriginalTurnEndsAt = null;
    g.openingPlayerId = null;

    if (g.activePlayers().size() <= 1)
      g.phase = GamePhase.GAME_OVER;
  }

  /** Resolve a turn that expired before the player completed it. */
  public synchronized void timeoutTurn(GameRuntime g) {
    requireTurn(g, g.turnPlayerId);
    ensurePlaying(g);
    PlayerRuntime p = g.currentPlayer();
    if (p == null) return;

    if (!g.mustDrawAfterDrop) {
      // A turn always starts with DROP. If the player did nothing, the server
      // chooses one random card and performs a legal drop, then immediately
      // completes the required draw so the table cannot stall.
      Card random = p.hand.get(g.random.nextInt(p.hand.size()));
      drop(g, p.id, List.of(random.code()));
    }

    if (g.mustDrawAfterDrop) {
      // Reuse the authoritative draw path so the temporary Drop Area is
      // committed before the automatic draw completes the turn.
      drawDeck(g, p.id);
    }
    g.message = p.name + " ran out of time — a random move was made";
  }

  public synchronized void nextRound(GameRuntime g) {
    if (g.phase != GamePhase.ROUND_RESULT)
      throw new IllegalStateException("Round is not complete");

    if (g.activePlayers().size() <= 1) {
      g.phase = GamePhase.GAME_OVER;
      return;
    }

    rotateDealer(g);
    startRound(g);
  }

  private void rotateDealer(GameRuntime g) {
    List<PlayerRuntime> active = g.activePlayers();
    if (!active.isEmpty()) g.dealerIndex = (g.dealerIndex + 1) % active.size();
  }

  private void eliminateAtTarget(GameRuntime g) {
    for (PlayerRuntime p : g.players) {
      if (p.status != PlayerStatus.ELIMINATED && p.score >= g.targetScore) {
        p.status = PlayerStatus.ELIMINATED;
        p.hand.clear();
        p.websocketSessionId = null;
      }
    }
  }

  private void ensurePlaying(GameRuntime g) {
    if (g.phase != GamePhase.PLAYING)
      throw new IllegalStateException("Action not allowed in current phase");
  }

  private void requireTurn(GameRuntime g, String pid) {
    if (g.currentPlayer() == null || !g.currentPlayer().id.equals(pid))
      throw new IllegalStateException("It is not your turn");
  }

  private List<Card> resolveCards(PlayerRuntime p, List<String> codes) {
    List<Card> result = new ArrayList<>();

    for (String code : codes) {
      Card c = p.hand.stream()
          .filter(x -> x.code().equalsIgnoreCase(code))
          .findFirst()
          .orElseThrow(() -> new IllegalArgumentException("Card not in hand: " + code));

      if (result.contains(c))
        throw new IllegalArgumentException("Duplicate card");

      result.add(c);
    }

    return result;
  }

  /**
   * Recycles old discard history when the draw deck is empty.
   *
   * The visible top and the current turn's previousTopDropCard are protected,
   * because the latter is still legally drawable by the current player.
   * Neither can accidentally enter the deck before the current action resolves.
   */
  private void ensureDeck(GameRuntime g) {
    if (g.deck.size() > 0) return;

    if (g.dropPile.isEmpty())
      throw new IllegalStateException("No cards available");

    Card visibleTop = g.dropPile.peekFirst();
    Card protectedPrevious = g.previousTopDropCard;

    List<Card> recycle = new ArrayList<>();
    for (Card card : g.dropPile) {
      if (card != visibleTop && card != protectedPrevious)
        recycle.add(card);
    }

    if (recycle.isEmpty())
      throw new IllegalStateException("No cards available");

    g.dropPile.removeIf(card -> card != visibleTop && card != protectedPrevious);
    Collections.shuffle(recycle, g.random);
    g.deck.addAllBottom(recycle);
  }
}

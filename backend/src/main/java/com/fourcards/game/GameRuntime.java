package com.fourcards.game;

import com.fourcards.model.*;
import java.time.Instant;
import java.util.*;

public class GameRuntime {
  public final String roomCode;
  public final List<PlayerRuntime> players = new ArrayList<>();
  public final Random random = new Random();
  public final ScoreCalculator scorer = new ScoreCalculator();

  public GamePhase phase = GamePhase.LOBBY;
  public int targetScore = 50;
  public int roundNumber = 0;
  public int dealerIndex = 0;
  public int turnIndex = 0;
  /** Stable identity of the player whose turn it is, including during disconnect grace. */
  public String turnPlayerId;
  /** Server-authoritative deadline for the current turn. */
  public Instant turnEndsAt;

  public Deck deck;
  /** Newest discard is always first. The complete history is retained for the round. */
  public final Deque<Card> dropPile = new ArrayDeque<>();

  /** Immutable server-owned Joker for the current round. It is never in deck/dropPile/hand. */
  public JokerCard jokerCard;
  public Rank jokerRank;

  /** Card that was visible when the current player's turn began. */
  public Card previousTopDropCard;

  public String message = "";
  public Instant openingEndsAt;
  public String openingPlayerId;
  public boolean mustDrawAfterDrop;

  public GameRuntime(String roomCode) {
    this.roomCode = roomCode;
  }

  public PlayerRuntime player(String id) {
    return players.stream()
        .filter(p -> p.id.equals(id))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Player not found"));
  }

  public List<PlayerRuntime> activePlayers() {
    return players.stream().filter(PlayerRuntime::active).toList();
  }

  public PlayerRuntime currentPlayer() {
    if (turnPlayerId != null) {
      return players.stream()
          .filter(p -> p.id.equals(turnPlayerId) && p.status != PlayerStatus.ELIMINATED)
          .findFirst().orElse(null);
    }
    if (activePlayers().isEmpty()) return null;
    return activePlayers().get(Math.floorMod(turnIndex, activePlayers().size()));
  }

  public void beginTurn(long turnSeconds) {
    previousTopDropCard = dropPile.peekFirst();
    mustDrawAfterDrop = false;
    PlayerRuntime current = currentPlayer();
    turnPlayerId = current == null ? null : current.id;
    turnEndsAt = current == null ? null : Instant.now().plusSeconds(turnSeconds);
  }

  /** Compatibility helper for tests/older callers. */
  public void beginTurn() { beginTurn(15); }

  public void advanceTurn(long turnSeconds) {
    List<PlayerRuntime> active = activePlayers();
    if (active.isEmpty()) {
      previousTopDropCard = null;
      turnPlayerId = null;
      turnEndsAt = null;
      return;
    }

    int currentPosition = -1;
    if (turnPlayerId != null) {
      for (int i = 0; i < players.size(); i++) {
        if (players.get(i).id.equals(turnPlayerId)) { currentPosition = i; break; }
      }
    }

    PlayerRuntime next = null;
    for (int offset = 1; offset <= players.size(); offset++) {
      PlayerRuntime candidate = players.get((Math.max(currentPosition, -1) + offset) % players.size());
      if (candidate.active()) { next = candidate; break; }
    }

    if (next == null) {
      previousTopDropCard = null;
      turnPlayerId = null;
      turnEndsAt = null;
      return;
    }

    turnIndex = active.indexOf(next);
    turnPlayerId = next.id;
    previousTopDropCard = dropPile.peekFirst();
    mustDrawAfterDrop = false;
    turnEndsAt = Instant.now().plusSeconds(turnSeconds);
  }

  public void advanceTurn() { advanceTurn(15); }
}

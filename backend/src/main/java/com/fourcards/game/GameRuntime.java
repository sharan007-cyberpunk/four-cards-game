package com.fourcards.game;

import com.fourcards.model.*;
import java.time.Instant; import java.util.*;

public class GameRuntime {
  public final String roomCode; public final List<PlayerRuntime> players = new ArrayList<>();
  public final Random random = new Random(); public final ScoreCalculator scorer = new ScoreCalculator();
  public GamePhase phase = GamePhase.LOBBY; public int targetScore=50; public int roundNumber=0; public int dealerIndex=0; public int turnIndex=0;
  public Deck deck; public final Deque<Card> dropPile = new ArrayDeque<>(); public Card jokerCard; public Rank jokerRank; public Card previousDropCard; public String message=""; public Instant openingEndsAt; public String openingPlayerId; public boolean mustDrawAfterDrop; public String roundWinnerId; public String roundWinnerName; public Integer roundWinnerHandScore;
  public GameRuntime(String roomCode) { this.roomCode=roomCode; }
  public PlayerRuntime player(String id) { return players.stream().filter(p -> p.id.equals(id)).findFirst().orElseThrow(() -> new IllegalArgumentException("Player not found")); }
  public List<PlayerRuntime> activePlayers() { return players.stream().filter(PlayerRuntime::active).toList(); }
  public PlayerRuntime currentPlayer() { if (activePlayers().isEmpty()) return null; return activePlayers().get(turnIndex % activePlayers().size()); }
  public void advanceTurn() { if (!activePlayers().isEmpty()) turnIndex = (turnIndex + 1) % activePlayers().size(); }
}

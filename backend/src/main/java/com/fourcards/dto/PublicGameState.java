package com.fourcards.dto;

import com.fourcards.model.GamePhase;
import java.util.List;

public record PublicGameState(
    String roomCode,
    GamePhase phase,
    List<PlayerPublicDto> players,
    String currentPlayerId,
    String topDropCard,
    String previousTopDropCard,
    String jokerRank,
    CardDto jokerCard,
    int deckCount,
    int targetScore,
    int roundNumber,
    String message,
    Long turnEndsAt,
    Long openingEndsAt,
    String openingPlayerId,
    int turnSeconds,
    String roundWinnerName,
    Integer roundWinnerHandScore,
    String illegalOpeningWinnerName,
    Integer illegalOpeningLowestScore,
    String finalWinnerName,
    Integer finalWinnerScore
) {}

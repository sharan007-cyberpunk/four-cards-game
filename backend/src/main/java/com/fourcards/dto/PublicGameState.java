package com.fourcards.dto;

import com.fourcards.model.GamePhase;
import java.util.List;

public record PublicGameState(
        String roomCode,
        GamePhase phase,
        List<PlayerPublicDto> players,
        String currentPlayerId,
        String topDropCard,
        String previousDropCard,
        String jokerCard,
        String jokerRank,
        int deckCount,
        int targetScore,
        int roundNumber,
        String message,
        Long openingEndsAt,
        String roundWinnerId,
        String roundWinnerName,
        Integer roundWinnerHandScore
) {}

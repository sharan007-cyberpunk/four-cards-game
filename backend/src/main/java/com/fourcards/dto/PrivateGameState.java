package com.fourcards.dto;
import java.util.List;
public record PrivateGameState(
        PublicGameState publicState,
        String playerId,
        List<CardDto> hand,
        int handScore,
        List<String> selectedCodes,
        List<String> legalActions
) {}

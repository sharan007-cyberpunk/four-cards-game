package com.fourcards.dto;

import com.fourcards.model.PlayerStatus;

public record PlayerPublicDto(
        String id,
        String name,
        int score,
        Integer roundScore,
        int handSize,
        PlayerStatus status,
        boolean host,
        boolean dealer,
        boolean bot
) {}

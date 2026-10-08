package com.fourcards.dto;

import com.fourcards.model.BotDifficulty;
import jakarta.validation.constraints.*;

public record CreateGameRequest(
        @NotBlank @Size(min = 2, max = 20) String playerName,
        @Min(1) @Max(500) Integer targetScore,
        @Min(0) @Max(5) Integer botCount,
        BotDifficulty botDifficulty,
        @Min(0) @Max(120) Integer turnSeconds
) {}

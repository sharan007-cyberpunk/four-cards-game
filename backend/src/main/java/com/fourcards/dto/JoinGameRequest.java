package com.fourcards.dto;
import jakarta.validation.constraints.*;
public record JoinGameRequest(@NotBlank @Size(min=2,max=20) String playerName) {}

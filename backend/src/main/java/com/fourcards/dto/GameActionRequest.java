package com.fourcards.dto;
import java.util.List;
public record GameActionRequest(String playerId, List<String> cardCodes) {}

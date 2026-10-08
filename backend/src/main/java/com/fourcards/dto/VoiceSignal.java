package com.fourcards.dto;

public record VoiceSignal(
        String fromPlayerId,
        String toPlayerId,
        String type,
        String sdp,
        String candidate,
        String sdpMid,
        Integer sdpMLineIndex
) {}

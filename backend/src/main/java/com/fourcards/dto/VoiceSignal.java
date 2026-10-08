package com.fourcards.dto;

public record VoiceSignal(
        String fromPlayerId,
        String toPlayerId,
        String type,
        String sdp,
        String candidate,
        String sdpMid,
        Integer sdpMLineIndex,
        Boolean micEnabled,
        Boolean speaking
) {
    public VoiceSignal(
            String fromPlayerId,
            String toPlayerId,
            String type,
            String sdp,
            String candidate,
            String sdpMid,
            Integer sdpMLineIndex
    ) {
        this(fromPlayerId, toPlayerId, type, sdp, candidate, sdpMid, sdpMLineIndex, null, null);
    }
}

package com.fourcards.websocket;

import com.fourcards.dto.*;
import com.fourcards.service.GameService;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class GameWebSocketController {

    private final GameService service;

    public GameWebSocketController(GameService service) { this.service = service; }

    private String principalId(StompHeaderAccessor accessor) {
        if (accessor == null || accessor.getUser() == null || accessor.getUser().getName() == null) {
            throw new IllegalStateException("Missing player identity");
        }
        return accessor.getUser().getName();
    }

    @MessageMapping("/room/{code}/drop")
    public void drop(@DestinationVariable String code, GameActionRequest request, StompHeaderAccessor accessor) {
        service.drop(code, new GameActionRequest(principalId(accessor), request == null ? null : request.cardCodes()));
    }

    @MessageMapping("/room/{code}/draw")
    public void draw(@DestinationVariable String code, StartGameRequest request, StompHeaderAccessor accessor) {
        service.drawDeck(code, principalId(accessor));
    }

    @MessageMapping("/room/{code}/take")
    public void take(@DestinationVariable String code, StartGameRequest request, StompHeaderAccessor accessor) {
        service.takeDrop(code, principalId(accessor));
    }

    @MessageMapping("/room/{code}/open")
    public void open(@DestinationVariable String code, StartGameRequest request, StompHeaderAccessor accessor) {
        service.open(code, principalId(accessor));
    }

    @MessageMapping("/room/{code}/withdraw-open")
    public void withdrawOpen(@DestinationVariable String code, StartGameRequest request, StompHeaderAccessor accessor) {
        service.withdrawOpening(code, principalId(accessor));
    }

    @MessageMapping("/room/{code}/next")
    public void next(@DestinationVariable String code, StartGameRequest request, StompHeaderAccessor accessor) {
        service.nextRound(code, principalId(accessor));
    }

    @MessageMapping("/room/{code}/disconnect")
    public void disconnect(@DestinationVariable String code, StartGameRequest request, StompHeaderAccessor accessor) {
        service.disconnect(code, principalId(accessor), accessor.getSessionId());
    }

    @MessageMapping("/room/{code}/voice")
    public void voice(@DestinationVariable String code, VoiceSignal signal, StompHeaderAccessor accessor) {
        service.broadcastVoice(code, principalId(accessor), signal);
    }

    @SubscribeMapping("/room/{code}/private")
    public PrivateGameState privateState(@DestinationVariable String code, StompHeaderAccessor accessor) {
        return service.privateState(code, principalId(accessor));
    }
}

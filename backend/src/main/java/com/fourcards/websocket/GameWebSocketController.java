package com.fourcards.websocket;

import com.fourcards.dto.*;
import com.fourcards.service.GameService;

import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

@Controller
public class GameWebSocketController {

    private final GameService service;

    public GameWebSocketController(GameService service) {
        this.service = service;
    }

    @MessageMapping("/room/{code}/drop")
    public void drop(
            @DestinationVariable String code,
            GameActionRequest request
    ) {
        service.drop(code, request);
    }

    @MessageMapping("/room/{code}/draw")
    public void draw(
            @DestinationVariable String code,
            StartGameRequest request
    ) {
        service.drawDeck(code, request.playerId());
    }

    @MessageMapping("/room/{code}/take")
    public void take(
            @DestinationVariable String code,
            StartGameRequest request
    ) {
        service.takeDrop(code, request.playerId());
    }

    @MessageMapping("/room/{code}/open")
    public void open(
            @DestinationVariable String code,
            StartGameRequest request
    ) {
        service.open(code, request.playerId());
    }

    @MessageMapping("/room/{code}/next")
    public void next(
            @DestinationVariable String code,
            StartGameRequest request
    ) {
        service.nextRound(code, request.playerId());
    }

    @MessageMapping("/room/{code}/disconnect")
    public void disconnect(
            @DestinationVariable String code,
            StartGameRequest request
    ) {
        service.disconnect(code, request.playerId());
    }

    @MessageMapping("/room/{code}/voice")
    public void voice(
            @DestinationVariable String code,
            VoiceSignal signal,
            org.springframework.messaging.simp.SimpMessageHeaderAccessor accessor
    ) {
        String playerId = accessor.getUser() == null
                ? null
                : accessor.getUser().getName();

        service.broadcastVoice(code, playerId, signal);
    }

    @SubscribeMapping("/room/{code}/private")
    public PrivateGameState privateState(
            @DestinationVariable String code,
            org.springframework.messaging.simp.SimpMessageHeaderAccessor accessor
    ) {
        String id = accessor.getUser() == null
                ? null
                : accessor.getUser().getName();

        if (id == null) {
            throw new IllegalStateException(
                    "Missing player identity"
            );
        }

        return service.privateState(code, id);
    }
}

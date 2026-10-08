package com.fourcards.websocket;

import com.fourcards.service.GameService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionConnectedEvent;

@Component
public class WebSocketDisconnectListener {
  private final GameService gameService;
  public WebSocketDisconnectListener(GameService gameService){this.gameService=gameService;}
  @EventListener
  public void onConnect(SessionConnectedEvent event){
    StompHeaderAccessor accessor=StompHeaderAccessor.wrap(event.getMessage());
    if(accessor.getUser()!=null) gameService.connectWebSocket(accessor.getUser().getName(), accessor.getSessionId());
  }

  @EventListener
  public void onDisconnect(SessionDisconnectEvent event){
    StompHeaderAccessor accessor=StompHeaderAccessor.wrap(event.getMessage());
    if(accessor.getUser()!=null) gameService.disconnectPlayerFromAll(accessor.getUser().getName(), accessor.getSessionId());
  }
}

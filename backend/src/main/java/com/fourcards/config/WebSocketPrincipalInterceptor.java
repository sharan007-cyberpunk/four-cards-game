package com.fourcards.config;

import org.springframework.context.annotation.Configuration; import org.springframework.messaging.*;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.stomp.*; import org.springframework.messaging.support.ChannelInterceptor; import org.springframework.messaging.support.MessageHeaderAccessor; import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import java.security.Principal;

@Configuration
public class WebSocketPrincipalInterceptor implements WebSocketMessageBrokerConfigurer {
  @Override public void configureClientInboundChannel(ChannelRegistration registration){registration.interceptors(new ChannelInterceptor(){
    @Override public Message<?> preSend(Message<?> message,MessageChannel channel){StompHeaderAccessor a=MessageHeaderAccessor.getAccessor(message,StompHeaderAccessor.class);if(a!=null&&StompCommand.CONNECT.equals(a.getCommand())){String id=a.getFirstNativeHeader("player-id");if(id!=null&&!id.isBlank())a.setUser(new Principal(){public String getName(){return id;}});}return message;}
  });}
}

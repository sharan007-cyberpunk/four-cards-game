package com.fourcards.config;

import org.springframework.context.annotation.Configuration; import org.springframework.messaging.simp.config.MessageBrokerRegistry; import org.springframework.web.socket.config.annotation.*;

@Configuration @EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
  @Override public void configureMessageBroker(MessageBrokerRegistry r){r.enableSimpleBroker("/topic","/queue");r.setApplicationDestinationPrefixes("/app");r.setUserDestinationPrefix("/user");}
  @Override public void registerStompEndpoints(StompEndpointRegistry r){r.addEndpoint("/ws").setAllowedOriginPatterns("*");}
}

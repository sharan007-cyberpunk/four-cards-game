package com.fourcards.config;
import org.springframework.beans.factory.annotation.Value; import org.springframework.context.annotation.Configuration; import org.springframework.web.servlet.config.annotation.*;
@Configuration public class CorsConfig implements WebMvcConfigurer { @Value("${app.cors-origins:http://localhost:5173}") String origins; @Override public void addCorsMappings(CorsRegistry r){r.addMapping("/api/**").allowedOrigins(origins.split(",")).allowedMethods("GET","POST","PUT","OPTIONS").allowedHeaders("*");} }

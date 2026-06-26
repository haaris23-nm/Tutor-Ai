package com.tutorai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class TutorAiApplication {

    public static void main(String[] args) {
        SpringApplication.run(TutorAiApplication.class, args);
        System.out.println("Tutor AI Spring Boot Academic server active on port 8080 smoothly!");
    }

    // Connect global CORS settings so standalone frontend clients can communicate instantly
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .exposedHeaders("Set-Cookie");
            }
        };
    }
}

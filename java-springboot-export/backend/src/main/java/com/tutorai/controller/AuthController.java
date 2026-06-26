package com.tutorai.controller;

import com.tutorai.model.User;
import com.tutorai.model.Subject;
import com.tutorai.model.Notification;
import com.tutorai.repository.UserRepository;
import com.tutorai.repository.SubjectRepository;
import com.tutorai.repository.NotificationRepository;
import com.tutorai.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*", allowCredentials = "true")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private JwtService jwtService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String username = request.get("username");
        String email = request.get("email");
        String password = request.get("password");

        if (username == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Please fill in all standard credentials."));
        }

        if (userRepository.findByEmail(email.toLowerCase()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "An account with this email already exists."));
        }

        String userId = "user_" + System.currentTimeMillis();
        User user = new User(userId, username, email.toLowerCase(), "simulated_hash_" + password.hashCode(), LocalDateTime.now());
        userRepository.save(user);

        // Auto-create initial default academic subjects
        Subject cs = new Subject("subj_" + System.currentTimeMillis() + "_cs", userId, "Computer Science (AI & Robotics)", "emerald", LocalDateTime.now());
        Subject math = new Subject("subj_" + System.currentTimeMillis() + "_math", userId, "Advanced Calculus", "indigo", LocalDateTime.now());
        subjectRepository.saveAll(List.of(cs, math));

        // Create initial hello notification
        Notification welcome = new Notification("not_" + System.currentTimeMillis(), userId, "Welcome to Tutor AI!", "Great to have you! Explore notes repositories, write cards and boost GPA!", false, LocalDateTime.now());
        notificationRepository.save(welcome);

        String token = jwtService.generateToken(userId, email);
        setCookie(response, token);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("user", user, "token", token));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request, HttpServletResponse response) {
        String email = request.get("email");
        String password = request.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required."));
        }

        Optional<User> userOpt = userRepository.findByEmail(email.toLowerCase());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Account not found. Please register."));
        }

        User user = userOpt.get();
        String token = jwtService.generateToken(user.getId(), user.getEmail());
        setCookie(response, token);

        return ResponseEntity.ok(Map.of("user", user, "token", token));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("tutor_ai_auth_token", null);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Successfully logged out."));
    }

    @GetMapping("/session")
    public ResponseEntity<?> session(@CookieValue(value = "tutor_ai_auth_token", required = false) String token, 
                                     @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String jwt = token;
        if (jwt == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            jwt = authHeader.substring(7);
        }

        if (jwt == null || !jwtService.validateToken(jwt)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Session unavailable."));
        }

        String userId = jwtService.extractUserId(jwt);
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User does not exist."));
        }

        return ResponseEntity.ok(Map.of("user", userOpt.get(), "token", jwt));
    }

    private void setCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("tutor_ai_auth_token", token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(86400); // 1 day
        response.addCookie(cookie);
    }
}

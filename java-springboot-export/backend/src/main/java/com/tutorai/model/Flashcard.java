package com.tutorai.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "flashcards")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Flashcard {
    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String subjectId;

    private String noteId;

    @Column(nullable = false, length = 1000)
    private String question;

    @Column(nullable = false, length = 1000)
    private String answer;

    @Column(nullable = false)
    private String mastery = "unfamiliar"; // "unfamiliar" | "review" | "known"

    private LocalDateTime lastReviewedAt;
    private LocalDateTime createdAt = LocalDateTime.now();
}

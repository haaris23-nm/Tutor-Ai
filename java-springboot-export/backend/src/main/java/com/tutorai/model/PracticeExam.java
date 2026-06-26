package com.tutorai.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "practice_exams")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PracticeExam {
    @Id
    private String id;

    @Column(nullable = false)
    private String noteId;

    @Column(nullable = false)
    private String subjectId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String difficulty = "medium"; // "easy" | "medium" | "hard"

    @Lob
    @Column(columnDefinition = "CLOB")
    private String questionsJson; // Store exam questions as serialized JSON string
}

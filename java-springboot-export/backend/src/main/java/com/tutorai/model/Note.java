package com.tutorai.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "notes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Note {
    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String subjectId;

    @Column(nullable = false)
    private String title;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String content;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String summary;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String vocabularyJson; // Store vocabulary list as serialized JSON for easy portability

    private Boolean isPdf = false;
    private String pdfId;
    private String source = "custom"; // "custom" | "online" | "pdf"
    private LocalDateTime createdAt = LocalDateTime.now();
}

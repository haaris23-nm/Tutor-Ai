package com.tutorai.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "planner_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlannerTask {
    @Id
    private String id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String subjectId;

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(nullable = false)
    private String dueDate; // Stores ISO date string

    @Column(nullable = false)
    private String status = "pending"; // "pending" | "active" | "completed"

    private LocalDateTime createdAt = LocalDateTime.now();
}

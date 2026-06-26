package com.tutorai.controller;

import com.tutorai.model.*;
import com.tutorai.repository.*;
import com.tutorai.service.GeminiService;
import com.tutorai.service.JwtService;
import com.tutorai.service.PDFService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowCredentials = "true")
public class AcademicController {

    @Autowired private SubjectRepository subjectRepository;
    @Autowired private NoteRepository noteRepository;
    @Autowired private FlashcardRepository flashcardRepository;
    @Autowired private PracticeExamRepository practiceExamRepository;
    @Autowired private QuizAttemptRepository quizAttemptRepository;
    @Autowired private PlannerTaskRepository plannerTaskRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private JwtService jwtService;
    @Autowired private PDFService pdfService;
    @Autowired private GeminiService geminiService;

    // Helper to validate request session and retrieve active User ID
    private String resolveUserId(String authHeader, String tokenCookie) {
        String token = tokenCookie;
        if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
        if (token == null || !jwtService.validateToken(token)) {
            throw new RuntimeException("Unauthorized session access.");
        }
        return jwtService.extractUserId(token);
    }

    /* === SUBJECTS PORT === */
    @GetMapping("/subjects")
    public ResponseEntity<?> getSubjects(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                         @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            return ResponseEntity.ok(subjectRepository.findByUserId(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/subjects")
    public ResponseEntity<?> createSubject(@RequestBody Map<String, String> body,
                                           @RequestHeader(value = "Authorization", required = false) String authHeader,
                                           @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            String name = body.get("name");
            String color = body.getOrDefault("color", "indigo");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Subject title is required."));
            }

            Subject nSub = new Subject("subj_" + System.currentTimeMillis(), userId, name.trim(), color, LocalDateTime.now());
            subjectRepository.save(nSub);
            return ResponseEntity.status(HttpStatus.CREATED).body(nSub);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /* === NOTES & PDF INGESTION PORT === */
    @GetMapping("/notes")
    public ResponseEntity<?> getNotes(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                      @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            return ResponseEntity.ok(noteRepository.findByUserId(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/notes")
    public ResponseEntity<?> createNote(@RequestBody Map<String, String> body,
                                        @RequestHeader(value = "Authorization", required = false) String authHeader,
                                        @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            String subId = body.get("subjectId");
            String title = body.get("title");
            String content = body.get("content");

            if (subId == null || title == null || content == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Subject, Title, and Content are required."));
            }

            // Generate AI Summary and flashcards of the academic resource
            Map<String, Object> aiMap = geminiService.generateAcademicMetadata(title, content);
            String noteId = "note_" + System.currentTimeMillis();

            Note note = new Note();
            note.setId(noteId);
            note.setUserId(userId);
            note.setSubjectId(subId);
            note.setTitle(title.trim());
            note.setContent(content.trim());
            note.setSummary((String) aiMap.get("summary"));
            note.setVocabularyJson(""); // Optional list field can be empty or serialized string
            note.setIsPdf(false);
            note.setSource("custom");
            note.setCreatedAt(LocalDateTime.now());
            noteRepository.save(note);

            // Populate generated flashcards
            List<Map<String, String>> fcs = (List<Map<String, String>>) aiMap.get("flashcards");
            if (fcs != null) {
                for (int i = 0; i < fcs.size(); i++) {
                    Map<String, String> fc = fcs.get(i);
                    Flashcard flashcard = new Flashcard(
                        "fc_" + System.currentTimeMillis() + "_" + i, userId, subId, noteId,
                        fc.get("question"), fc.get("answer"), "unfamiliar", null, LocalDateTime.now()
                    );
                    flashcardRepository.save(flashcard);
                }
            }

            // Track Activity log telemetry
            ActivityLog act = new ActivityLog("act_" + System.currentTimeMillis(), userId, "Created Note", "Added note: \"" + title + "\" with AI summaries.", "note", LocalDateTime.now());
            activityLogRepository.save(act);

            return ResponseEntity.status(HttpStatus.CREATED).body(note);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/notes/upload")
    public ResponseEntity<?> uploadPdfNote(@RequestBody Map<String, String> body,
                                           @RequestHeader(value = "Authorization", required = false) String authHeader,
                                           @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            String fileName = body.get("fileName");
            String base64Data = body.get("fileDataB64");
            String subjectId = body.get("subjectId");

            if (fileName == null || base64Data == null || subjectId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Filename, Base64 Stream, and Subject ID are required."));
            }

            byte[] pdfBytes = Base64.getDecoder().decode(base64Data);
            String pdfText = pdfService.extractText(pdfBytes);
            String noteTitle = fileName.replaceAll("(?i)\\.pdf$", "");

            Map<String, Object> aiMap = geminiService.generateAcademicMetadata(noteTitle, pdfText);
            String noteId = "note_pdf_" + System.currentTimeMillis();

            Note note = new Note();
            note.setId(noteId);
            note.setUserId(userId);
            note.setSubjectId(subjectId);
            note.setTitle(noteTitle);
            note.setContent(pdfText);
            note.setSummary((String) aiMap.get("summary"));
            note.setIsPdf(true);
            note.setPdfId("pdf_" + System.currentTimeMillis());
            note.setSource("pdf");
            note.setCreatedAt(LocalDateTime.now());
            noteRepository.save(note);

            // Populate generated PDF flashcards
            List<Map<String, String>> fcs = (List<Map<String, String>>) aiMap.get("flashcards");
            if (fcs != null) {
                for (int i = 0; i < fcs.size(); i++) {
                    Map<String, String> fc = fcs.get(i);
                    Flashcard flashcard = new Flashcard(
                        "fc_" + System.currentTimeMillis() + "_" + i, userId, subjectId, noteId,
                        fc.get("question"), fc.get("answer"), "unfamiliar", null, LocalDateTime.now()
                    );
                    flashcardRepository.save(flashcard);
                }
            }

            // Activity Log
            ActivityLog act = new ActivityLog("act_" + System.currentTimeMillis(), userId, "Uploaded PDF", "Ingested PDF document \"" + fileName + "\" into knowledge library.", "note", LocalDateTime.now());
            activityLogRepository.save(act);

            return ResponseEntity.ok(note);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to compile uploaded material: " + e.getMessage()));
        }
    }

    /* === FLASHCARDS PORT === */
    @GetMapping("/flashcards")
    public ResponseEntity<?> getFlashcards(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                           @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            return ResponseEntity.ok(flashcardRepository.findByUserId(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/flashcards/{id}/review")
    public ResponseEntity<?> updateFlashcardMastery(@PathVariable String id, @RequestBody Map<String, String> body,
                                                    @RequestHeader(value = "Authorization", required = false) String authHeader,
                                                    @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            String mastery = body.get("mastery"); // "unfamiliar" | "review" | "known"

            Optional<Flashcard> fcOpt = flashcardRepository.findById(id);
            if (fcOpt.isEmpty() || !fcOpt.get().getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Flashcard not found."));
            }

            Flashcard fc = fcOpt.get();
            fc.setMastery(mastery);
            fc.setLastReviewedAt(LocalDateTime.now());
            flashcardRepository.save(fc);

            // Append Activity log
            ActivityLog act = new ActivityLog("act_" + System.currentTimeMillis(), userId, "Reviewed Flashcards", "Tested card \"" + fc.getQuestion() + "\" marked as " + mastery + ".", "study", LocalDateTime.now());
            activityLogRepository.save(act);

            return ResponseEntity.ok(fc);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /* === PLANNER TASKS PORT === */
    @GetMapping("/planner-tasks")
    public ResponseEntity<?> getPlannerTasks(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                             @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            return ResponseEntity.ok(plannerTaskRepository.findByUserId(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/planner-tasks")
    public ResponseEntity<?> createPlannerTask(@RequestBody Map<String, String> body,
                                               @RequestHeader(value = "Authorization", required = false) String authHeader,
                                               @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            String subId = body.get("subjectId");
            String title = body.get("title");
            String description = body.get("description");
            String dueDate = body.get("dueDate");

            if (subId == null || title == null || dueDate == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Subject, Title, and Due Date are required fields."));
            }

            PlannerTask task = new PlannerTask("task_" + System.currentTimeMillis(), userId, subId, title.trim(), description, dueDate, "pending", LocalDateTime.now());
            plannerTaskRepository.save(task);

            ActivityLog act = new ActivityLog("act_" + System.currentTimeMillis(), userId, "Scheduled Task", "Added task \"" + title + "\" to study planner.", "planner", LocalDateTime.now());
            activityLogRepository.save(act);

            return ResponseEntity.status(HttpStatus.CREATED).body(task);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/planner-tasks/{id}")
    public ResponseEntity<?> updateTaskStatus(@PathVariable String id, @RequestBody Map<String, String> body,
                                              @RequestHeader(value = "Authorization", required = false) String authHeader,
                                              @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            String status = body.get("status");

            Optional<PlannerTask> taskOpt = plannerTaskRepository.findById(id);
            if (taskOpt.isEmpty() || !taskOpt.get().getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Task not found."));
            }

            PlannerTask t = taskOpt.get();
            t.setStatus(status);
            plannerTaskRepository.save(t);

            return ResponseEntity.ok(t);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /* === DASHBOARD, LOGS & RECOMMENDATIONS === */
    @GetMapping("/activity-logs")
    public ResponseEntity<?> getActivityLogs(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                             @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            return ResponseEntity.ok(activityLogRepository.findByUserId(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                              @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            return ResponseEntity.ok(notificationRepository.findByUserId(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/dashboard/recommendations")
    public ResponseEntity<?> getRecommendations(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                                @CookieValue(value = "tutor_ai_auth_token", required = false) String cookie) {
        try {
            String userId = resolveUserId(authHeader, cookie);
            List<Subject> subList = subjectRepository.findByUserId(userId);
            List<String> subNames = new ArrayList<>();
            for (Subject s : subList) subNames.add(s.getName());

            String recoText = geminiService.generateRecommendations("Level 1 Core Academic Student", subNames, "Flashcards reviewed: " + flashcardRepository.findByUserId(userId).size());
            return ResponseEntity.ok(Map.of("recommendations", recoText));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}

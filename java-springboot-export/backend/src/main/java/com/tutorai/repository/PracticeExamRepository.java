package com.tutorai.repository;

import com.tutorai.model.PracticeExam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface PracticeExamRepository extends JpaRepository<PracticeExam, String> {
    Optional<PracticeExam> findByNoteId(String noteId);
}

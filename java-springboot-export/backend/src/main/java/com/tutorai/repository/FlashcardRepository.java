package com.tutorai.repository;

import com.tutorai.model.Flashcard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FlashcardRepository extends JpaRepository<Flashcard, String> {
    List<Flashcard> findByUserId(String userId);
    List<Flashcard> findByUserIdAndSubjectId(String userId, String subjectId);
}

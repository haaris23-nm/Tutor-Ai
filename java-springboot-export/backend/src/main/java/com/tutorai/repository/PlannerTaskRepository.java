package com.tutorai.repository;

import com.tutorai.model.PlannerTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlannerTaskRepository extends JpaRepository<PlannerTask, String> {
    List<PlannerTask> findByUserId(String userId);
}

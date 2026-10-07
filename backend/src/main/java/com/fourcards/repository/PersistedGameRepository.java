package com.fourcards.repository;
import com.fourcards.model.PersistedGame; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface PersistedGameRepository extends JpaRepository<PersistedGame,Long>{ Optional<PersistedGame> findByRoomCode(String roomCode); }

package com.fourcards.model;

import jakarta.persistence.*; import java.time.Instant;

@Entity @Table(name="games")
public class PersistedGame {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false,unique=true,length=8) private String roomCode;
  @Column(nullable=false) private Integer targetScore;
  @Column(nullable=false) private Instant createdAt=Instant.now();
  protected PersistedGame(){}
  public PersistedGame(String roomCode,int targetScore){this.roomCode=roomCode;this.targetScore=targetScore;}
  public Long getId(){return id;} public String getRoomCode(){return roomCode;} public Integer getTargetScore(){return targetScore;} public Instant getCreatedAt(){return createdAt;}
}

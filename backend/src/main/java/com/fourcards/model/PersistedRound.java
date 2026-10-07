package com.fourcards.model;

import jakarta.persistence.*; import java.time.Instant;

@Entity @Table(name="rounds")
public class PersistedRound {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @ManyToOne(optional=false) private PersistedGame game;
  @Column(nullable=false) private Integer roundNumber;
  @Column(nullable=false) private String resultSummary;
  @Column(nullable=false) private Instant createdAt=Instant.now();
  protected PersistedRound(){}
  public PersistedRound(PersistedGame game,int roundNumber,String resultSummary){this.game=game;this.roundNumber=roundNumber;this.resultSummary=resultSummary;}
}

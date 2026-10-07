package com.fourcards.game;

import com.fourcards.model.Card;
import com.fourcards.model.Rank;
import java.util.Collection;

public class ScoreCalculator {
  public int score(Collection<Card> hand, Rank jokerRank) { return hand.stream().mapToInt(c -> c.value(jokerRank)).sum(); }
}

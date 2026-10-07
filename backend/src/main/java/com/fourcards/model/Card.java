package com.fourcards.model;

import java.util.Objects;

public record Card(Rank rank, Suit suit) {
  public int value(Rank jokerRank) { return rank == jokerRank ? 0 : rank.baseValue; }
  public String code() { return rank.symbol + suit.symbol; }
  @Override public String toString() { return code(); }
  @Override public boolean equals(Object o) { return o instanceof Card c && c.rank == rank && c.suit == suit; }
  @Override public int hashCode() { return Objects.hash(rank, suit); }
}

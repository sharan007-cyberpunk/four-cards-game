package com.fourcards.model;

public enum Rank {
  ACE("A", 1), TWO("2", 2), THREE("3", 3), FOUR("4", 4), FIVE("5", 5), SIX("6", 6), SEVEN("7", 7), EIGHT("8", 8), NINE("9", 9), TEN("10", 10), JACK("J", 10), QUEEN("Q", 10), KING("K", 10);
  public final String symbol; public final int baseValue;
  Rank(String symbol, int baseValue) { this.symbol = symbol; this.baseValue = baseValue; }
  public static Rank fromSymbol(String value) { for (Rank r : values()) if (r.symbol.equalsIgnoreCase(value)) return r; throw new IllegalArgumentException("Unknown rank: " + value); }
}

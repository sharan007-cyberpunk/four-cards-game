package com.fourcards.model;

public enum Suit {
  HEARTS("♥", "red"), DIAMONDS("♦", "red"), CLUBS("♣", "black"), SPADES("♠", "black");
  public final String symbol; public final String color;
  Suit(String symbol, String color) { this.symbol = symbol; this.color = color; }
}

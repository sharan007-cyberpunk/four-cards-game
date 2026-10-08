package com.fourcards.game;

import com.fourcards.model.Card;
import com.fourcards.model.Rank;
import com.fourcards.model.Suit;
import java.util.*;

public class Deck {
  private final Deque<Card> cards = new ArrayDeque<>();
  public static Deck standardShuffled(Random random) {
    List<Card> all = new ArrayList<>();
    for (Rank rank : Rank.values()) for (Suit suit : Suit.values()) all.add(new Card(rank, suit));
    Collections.shuffle(all, random);
    Deck deck = new Deck(); all.forEach(deck.cards::addLast); return deck;
  }
  public Card draw() { if (cards.isEmpty()) throw new IllegalStateException("Deck is empty"); return cards.removeFirst(); }
  public void addBottom(Card card) { cards.addLast(card); }
  public void addAllBottom(Collection<Card> cards) { cards.forEach(this.cards::addLast); }
  public int size() { return cards.size(); }
  public List<Card> snapshot() { return List.copyOf(cards); }
}

package com.fourcards.dto;
import com.fourcards.model.Card;
public record CardDto(String rank, String suit, String code, int value) { public static CardDto of(Card c, com.fourcards.model.Rank joker) { return new CardDto(c.rank().symbol, c.suit().symbol, c.code(), c.value(joker)); } }

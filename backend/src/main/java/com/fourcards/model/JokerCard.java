package com.fourcards.model;

/**
 * Marker wrapper for the immutable server-owned Joker.
 * The underlying physical card is removed from the playable deck for the round.
 */
public record JokerCard(Card physicalCard) {
    public Rank rank() {
        return physicalCard.rank();
    }

    public String code() {
        return physicalCard.code();
    }
}

package com.fourcards.game;

import com.fourcards.model.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class GameEngineTest {
  private GameRuntime game(){GameRuntime g=new GameRuntime("TEST1");g.players.add(new PlayerRuntime("a","A",true));g.players.add(new PlayerRuntime("b","B",false));g.players.add(new PlayerRuntime("c","C",false));g.targetScore=50;return g;}
  @Test void standardDeckHas52UniqueCards(){Deck d=Deck.standardShuffled(new Random(1));assertEquals(52,d.size());assertEquals(52,new HashSet<>(d.snapshot()).size());}
  @Test void jokerRankScoresZeroAndFacesTen(){ScoreCalculator s=new ScoreCalculator();assertEquals(0,s.score(List.of(new Card(Rank.EIGHT,Suit.HEARTS)),Rank.EIGHT));assertEquals(10,s.score(List.of(new Card(Rank.KING,Suit.SPADES)),Rank.EIGHT));assertEquals(1,s.score(List.of(new Card(Rank.ACE,Suit.SPADES)),Rank.EIGHT));}
  @Test void startDealsFourAndLeavesCorrectDeck(){GameRuntime g=game();new GameEngine(10).start(g);assertEquals(GamePhase.PLAYING,g.phase);assertEquals(4,g.players.get(0).hand.size());assertEquals(4,g.players.get(1).hand.size());assertEquals(4,g.players.get(2).hand.size());assertEquals(52-3*4-1-1,g.deck.size());assertEquals(1,g.dropPile.size());assertNotNull(g.jokerCard);assertEquals(g.jokerCard.rank(),g.jokerRank);}
  @Test void mixedRankDropRejected(){GameRuntime g=game();GameEngine e=new GameEngine(10);e.start(g);PlayerRuntime p=g.currentPlayer();Card a=p.hand.get(0);Card b=p.hand.stream().filter(c->c.rank()!=a.rank()).findFirst().orElseThrow();assertThrows(IllegalArgumentException.class,()->e.drop(g,p.id,List.of(a.code(),b.code())));}
  @Test void dropMustPrecedeDraw(){GameRuntime g=game();GameEngine e=new GameEngine(10);e.start(g);assertThrows(IllegalStateException.class,()->e.drawDeck(g,g.currentPlayer().id));}
  @Test void droppedCardCannotBeImmediatelyTaken(){
    GameRuntime g=game(); GameEngine e=new GameEngine(10); e.start(g);
    PlayerRuntime p=g.currentPlayer();
    Card previous=g.previousTopDropCard;
    Card dropped=p.hand.get(0);
    e.drop(g,p.id,List.of(dropped.code()));

    assertEquals(dropped,g.dropPile.peekFirst());
    assertTrue(g.dropPile.contains(previous));

    e.takeDrop(g,p.id);

    assertTrue(p.hand.contains(previous));
    assertFalse(p.hand.contains(dropped));
    assertEquals(dropped,g.dropPile.peekFirst());
  }

  @Test void discardHistorySurvivesConsecutiveTurns(){
    GameRuntime g=game(); GameEngine e=new GameEngine(10); e.start(g);
    PlayerRuntime first=g.currentPlayer();
    Card previous=g.previousTopDropCard;
    Card firstDrop=first.hand.get(0);
    e.drop(g,first.id,List.of(firstDrop.code()));
    e.takeDrop(g,first.id);

    PlayerRuntime second=g.currentPlayer();
    Card secondPrevious=g.previousTopDropCard;
    assertEquals(firstDrop,secondPrevious);
    Card secondDrop=second.hand.get(0);
    e.drop(g,second.id,List.of(secondDrop.code()));
    e.takeDrop(g,second.id);

    assertTrue(second.hand.contains(firstDrop));
    assertTrue(g.dropPile.contains(secondDrop));
    assertFalse(g.dropPile.contains(previous));
  }

  @Test void jokerIsRemovedFromPlayableDeck(){
    GameRuntime g=game(); new GameEngine(10).start(g);
    assertNotNull(g.jokerCard);
    assertFalse(g.deck.snapshot().contains(g.jokerCard.physicalCard()));
    assertFalse(g.dropPile.contains(g.jokerCard.physicalCard()));
    assertTrue(g.players.stream().noneMatch(p -> p.hand.contains(g.jokerCard.physicalCard())));
  }
  @Test void openingTieFavorsOpener(){GameRuntime g=game();GameEngine e=new GameEngine(10);e.start(g);PlayerRuntime opener=g.currentPlayer();opener.hand.clear();opener.hand.add(new Card(Rank.EIGHT,Suit.HEARTS));g.players.get(1).hand.clear();g.players.get(1).hand.add(new Card(Rank.EIGHT,Suit.SPADES));g.players.get(2).hand.clear();g.players.get(2).hand.add(new Card(Rank.TWO,Suit.CLUBS));g.jokerRank=Rank.KING;e.open(g,opener.id);e.evaluateOpening(g);assertEquals(0,opener.score);assertEquals(0,g.players.get(1).score);assertEquals(2,g.players.get(2).score);}
  @Test void wrongOpeningAddsForty(){GameRuntime g=game();GameEngine e=new GameEngine(10);e.start(g);PlayerRuntime opener=g.currentPlayer();opener.hand.clear();opener.hand.add(new Card(Rank.EIGHT,Suit.HEARTS));g.players.get(1).hand.clear();g.players.get(1).hand.add(new Card(Rank.TWO,Suit.SPADES));g.players.get(2).hand.clear();g.players.get(2).hand.add(new Card(Rank.KING,Suit.CLUBS));g.jokerRank=Rank.KING;e.open(g,opener.id);e.evaluateOpening(g);assertEquals(40,opener.score);assertEquals(0,g.players.get(1).score);}
  @Test void targetEliminatesMultiplePlayers(){GameRuntime g=game();g.targetScore=10;GameEngine e=new GameEngine(10);e.start(g);PlayerRuntime opener=g.currentPlayer();for(PlayerRuntime p:g.players){p.hand.clear();p.hand.add(new Card(Rank.KING,Suit.SPADES));}g.players.get(0).hand.clear();g.players.get(0).hand.add(new Card(Rank.ACE,Suit.SPADES));g.players.get(1).hand.clear();g.players.get(1).hand.add(new Card(Rank.TEN,Suit.SPADES));g.players.get(2).hand.clear();g.players.get(2).hand.add(new Card(Rank.TEN,Suit.HEARTS));g.jokerRank=Rank.TWO;g.players.get(1).score=10;g.players.get(2).score=10;e.open(g,opener.id);e.evaluateOpening(g);assertEquals(PlayerStatus.ELIMINATED,g.players.get(1).status);assertEquals(PlayerStatus.ELIMINATED,g.players.get(2).status);}
  @Test void dealerRotationSkipsEliminatedPlayer(){GameRuntime g=game();GameEngine e=new GameEngine(10);e.start(g);g.players.get(1).status=PlayerStatus.ELIMINATED;e.nextRound(g);assertTrue(g.players.stream().filter(p->p.dealer).findFirst().isPresent());assertNotEquals("B",g.players.stream().filter(p->p.dealer).findFirst().orElseThrow().name);}
}

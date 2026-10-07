package com.fourcards.game;

import com.fourcards.model.*;
import java.time.*; import java.util.*; import java.util.stream.Collectors;

public class GameEngine {
  private final long openingSeconds;
  public GameEngine(long openingSeconds) { this.openingSeconds=openingSeconds; }

  public synchronized void start(GameRuntime g) {
    if (g.players.size() < 3 || g.players.size() > 6) throw new IllegalStateException("Game requires 3–6 players");
    g.phase=GamePhase.ROUND_START; startRound(g);
  }
  public synchronized void startRound(GameRuntime g) {
    List<PlayerRuntime> active=g.activePlayers(); if(active.size()<=1){g.phase=GamePhase.GAME_OVER;return;}
    g.roundNumber++; g.deck=Deck.standardShuffled(g.random); g.dropPile.clear();
    g.jokerRank=g.deck.snapshot().get(g.deck.size()-1).rank(); // bottom card defines the Joker rank and remains in the deck
    for(PlayerRuntime p: active){p.hand.clear(); for(int i=0;i<4;i++) p.hand.add(g.deck.draw());}
    g.dropPile.push(g.deck.draw());
    for(PlayerRuntime p:g.players) p.dealer=false;
    PlayerRuntime dealer=dealerForRound(g, active); dealer.dealer=true;
    g.dealerIndex = indexOfActive(g, dealer);
    g.turnIndex = g.dealerIndex; g.phase=GamePhase.PLAYING; g.mustDrawAfterDrop=false; g.message="Round " + g.roundNumber + " started";
  }
  private PlayerRuntime dealerForRound(GameRuntime g,List<PlayerRuntime> active){
    if(g.roundNumber==1) return active.get(0);
    int start=g.dealerIndex; // previous dealer index among active list; rotate to next active
    return active.get(start % active.size());
  }
  private int indexOfActive(GameRuntime g, PlayerRuntime p){ return g.activePlayers().indexOf(p); }

  public synchronized void drop(GameRuntime g,String pid,List<String> codes){
    requireTurn(g,pid); if(g.phase!=GamePhase.PLAYING) throw new IllegalStateException("Not in playing phase");
    if(codes==null||codes.isEmpty()) throw new IllegalArgumentException("Select at least one card");
    PlayerRuntime p=g.player(pid); List<Card> selected=resolveCards(p,codes);
    Rank rank=selected.get(0).rank(); if(selected.stream().anyMatch(c->c.rank()!=rank)) throw new IllegalArgumentException("All dropped cards must have the same rank");
    for(Card c:selected) p.hand.remove(c); selected.forEach(g.dropPile::push); g.mustDrawAfterDrop=true; g.message=p.name+" dropped "+selected.size()+" card"+(selected.size()>1?"s":"");
  }

  public synchronized Card drawDeck(GameRuntime g,String pid){ requireTurn(g,pid); ensurePlaying(g); if(!g.mustDrawAfterDrop) throw new IllegalStateException("Drop before draw");
    ensureDeck(g); Card c=g.deck.draw(); g.player(pid).hand.add(c); afterDraw(g); return c; }
  public synchronized Card takeDrop(GameRuntime g,String pid){ requireTurn(g,pid); ensurePlaying(g); if(!g.mustDrawAfterDrop) throw new IllegalStateException("Drop before draw");
    if(g.dropPile.isEmpty()) throw new IllegalStateException("Drop pile is empty"); Card c=g.dropPile.pop(); g.player(pid).hand.add(c); afterDraw(g); return c; }
  private void afterDraw(GameRuntime g){g.mustDrawAfterDrop=false;g.advanceTurn();g.message="Turn complete";}

  public synchronized void open(GameRuntime g,String pid){
    requireTurn(g,pid); ensurePlaying(g); if(g.mustDrawAfterDrop) throw new IllegalStateException("You must draw after dropping"); g.phase=GamePhase.OPEN_CONFIRMATION; g.openingPlayerId=pid; g.openingEndsAt=Instant.now().plusSeconds(openingSeconds); g.message=g.player(pid).name+" opened";
  }
  public synchronized void evaluateOpening(GameRuntime g){
    if(g.phase!=GamePhase.OPEN_CONFIRMATION) return; PlayerRuntime opener=g.players.stream().filter(p->p.id.equals(g.openingPlayerId)).findFirst().orElse(null); if(opener==null){g.phase=GamePhase.GAME_OVER;return;}
    int openerScore=g.scorer.score(opener.hand,g.jokerRank); Map<PlayerRuntime,Integer> scores=new LinkedHashMap<>();
    for(PlayerRuntime p:g.activePlayers()) scores.put(p,g.scorer.score(p.hand,g.jokerRank));
    int lowest=scores.values().stream().min(Integer::compareTo).orElse(openerScore); boolean success=openerScore<=lowest;
    for(var e:scores.entrySet()) e.getKey().score += (e.getKey()==opener ? (success?0:40) : (success?e.getValue():0));
    eliminateAtTarget(g); g.phase=GamePhase.ROUND_RESULT; g.message=success?opener.name+" won the round":"Opening failed — +40 penalty";
    g.openingEndsAt=null; g.openingPlayerId=null;
    if(g.activePlayers().size()<=1) g.phase=GamePhase.GAME_OVER;
  }
  public synchronized void nextRound(GameRuntime g){
    if(g.phase!=GamePhase.ROUND_RESULT) throw new IllegalStateException("Round is not complete");
    if(g.activePlayers().size()<=1){g.phase=GamePhase.GAME_OVER;return;}
    rotateDealer(g); startRound(g);
  }
  private void rotateDealer(GameRuntime g){
    List<PlayerRuntime> active=g.activePlayers(); if(active.isEmpty()) return; int old=g.dealerIndex; g.dealerIndex=(old+1)%active.size(); }
  private void eliminateAtTarget(GameRuntime g){ for(PlayerRuntime p:g.players) if(p.status!=PlayerStatus.ELIMINATED && p.score>=g.targetScore) p.status=PlayerStatus.ELIMINATED; }
  private void ensurePlaying(GameRuntime g){if(g.phase!=GamePhase.PLAYING) throw new IllegalStateException("Action not allowed in current phase");}
  private void requireTurn(GameRuntime g,String pid){if(g.currentPlayer()==null||!g.currentPlayer().id.equals(pid)) throw new IllegalStateException("It is not your turn");}
  private List<Card> resolveCards(PlayerRuntime p,List<String> codes){
    List<Card> result=new ArrayList<>(); for(String code:codes){ Card c=p.hand.stream().filter(x->x.code().equalsIgnoreCase(code)).findFirst().orElseThrow(()->new IllegalArgumentException("Card not in hand: "+code)); if(result.contains(c)) throw new IllegalArgumentException("Duplicate card"); result.add(c); } return result;
  }
  private void ensureDeck(GameRuntime g){ if(g.deck.size()>0)return; if(g.dropPile.size()<=1) throw new IllegalStateException("No cards available"); Card top=g.dropPile.pop(); List<Card> recycle=new ArrayList<>(g.dropPile);g.dropPile.clear();Collections.shuffle(recycle,g.random);g.deck.addAllBottom(recycle);g.dropPile.push(top); }
}

import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Sparkles,Clock3,Crown,Mic,MicOff,Volume2,VolumeX,PhoneOff,Radio} from 'lucide-react';
import {Avatar} from './common.jsx';
import partyPopper from '../assets/party-popper.gif';
import {useVoiceChat} from '../services/voice.js';
function GameScreen({room,state,privateState,socket,error,setError}){
 const [selected,setSelected]=useState([]);
 const [handOrder,setHandOrder]=useState([]);
 const [dragCode,setDragCode]=useState(null);
 const [dragging,setDragging]=useState(false);
 const dropZoneRef=useRef(null);
 const suppressClickRef=useRef(false);
 const me=state?.players?.find(p=>p.id===room.playerId);
 const myTurn=state?.currentPlayerId===room.playerId;
 const hand=privateState?.hand||[];
 const legal=privateState?.legalActions||[];
 const orderedHand=useMemo(()=>{
   if(!handOrder.length)return hand;
   const map=new Map(hand.map(c=>[c.code,c]));
   return [...handOrder.map(c=>map.get(c)).filter(Boolean),...hand.filter(c=>!handOrder.includes(c.code))];
 },[hand,handOrder]);
 const open=state?.phase==='OPEN_CONFIRMATION';
 const result=state?.phase==='ROUND_RESULT';
 const over=state?.phase==='GAME_OVER';
 const voice=useVoiceChat(room.roomCode,room.playerId,state?.players||[],true,setError);

 useEffect(()=>{
   setSelected([]);
   setHandOrder(hand.map(c=>c.code));
 },[state?.message,state?.currentPlayerId,state?.phase,privateState?.hand?.length]);

 const action=(dest,body={})=>socket.send(`/room/${room.roomCode}/${dest}`,{playerId:room.playerId,...body});
 const toggle=c=>{
   if(suppressClickRef.current){suppressClickRef.current=false;return;}
   if(!myTurn||open||!legal.includes('DROP'))return;
   setSelected(s=>s.includes(c.code)?s.filter(x=>x!==c.code):[...s,c.code]);
 };
 const dropCodes=(codes)=>{
   if(!codes?.length)return setError('Select at least one card.');
   const ranks=codes.map(code=>hand.find(h=>h.code===code)?.rank).filter(Boolean);
   if(!ranks.length||new Set(ranks).size>1)return setError('You can only drop cards with the same rank.');
   action('drop',{cardCodes:codes});
   setSelected([]);
 };
 const drop=()=>dropCodes(selected);

 const handlePointerDown=(e,c)=>{
   if(open || !myTurn || !legal.includes('DROP'))return;
   if(e.pointerType==='mouse' && e.button!==0)return;
   e.preventDefault();
   setDragCode(c.code);
   setDragging(true);
   e.currentTarget.setPointerCapture?.(e.pointerId);
   const move=(ev)=>{
     ev.preventDefault?.();
     const target=document.elementFromPoint(ev.clientX,ev.clientY);
     dropZoneRef.current?.classList.toggle('drag-over',!!target?.closest?.('.drop-target'));
   };
   const up=(ev)=>{
     ev.preventDefault?.();
     window.removeEventListener('pointermove',move,{passive:false});
     window.removeEventListener('pointerup',up,{passive:false});
     const target=document.elementFromPoint(ev.clientX,ev.clientY);
     const overDrop=!!target?.closest?.('.drop-target');
     dropZoneRef.current?.classList.remove('drag-over');
     setDragging(false);
     setDragCode(null);
     if(overDrop){ suppressClickRef.current=true; dropCodes([c.code]); }
   };
   window.addEventListener('pointermove',move,{passive:false});
   window.addEventListener('pointerup',up,{passive:false});
 };

 if(!state)return <div className="full-loading"><Spinner/>Connecting to table…</div>;
 return <main className="game-shell">
   <div className="game-top">
    <div className="round-meta"><span>ROUND {state.roundNumber}</span><i/> <span>{state.targetScore} TARGET</span></div>
    <div className="turn-status">{open?<><Clock3 size={16}/> OPENING CHECK</>:myTurn?<><span className="pulse-dot"/> YOUR TURN</>:<><span className="pulse-dot muted"/> {state.players.find(p=>p.id===state.currentPlayerId)?.name||'Opponent'}'S TURN</>}</div>
    <div className="connection"><span className="status-dot"/> Connected</div>
    <VoicePanel voice={voice} players={state.players||[]} room={room}/>
   </div>
   <div className="game-board">
    <div className="opponents">{state.players.filter(p=>p.id!==room.playerId).map((p,i)=><Opponent key={p.id} player={p} active={p.id===state.currentPlayerId} compact={state.players.length>4}/>)}</div>
    <div className="table-center">
      <div className="table-light"/>
      <div className="joker-center" aria-label={`Joker ${state.jokerRank||''}`}>
        <div className="joker-ring"/>
        {state.jokerCard?<PlayingCard code={state.jokerCard} small nonInteractive/>:<div className="joker-placeholder"><span>JOKER</span><b>{state.jokerRank||'—'}</b></div>}
        <span className="joker-caption">JOKER · {state.jokerRank||'—'} = 0</span>
      </div>
      <div className="center-actions">
        <div className="pile-wrap">
          <span className="pile-label">DROP</span>
          {state.topDropCard?<PlayingCard code={state.topDropCard} small nonInteractive/>:<div className="empty-pile">DROP PILE</div>}
        </div>
        <div className="drop-target" ref={dropZoneRef}>
          <span>DROP CARD</span><small>{dragging?'RELEASE HERE':'DRAG HERE'}</small>
        </div>
        <div className="pile-wrap deck-wrap">
          <span className="pile-label">DECK <b>{state.deckCount}</b></span>
          <div className="deck-back"><div/><div/></div>
        </div>
      </div>
      <div className="table-message">{state.message}</div>
    </div>
    <div className="my-area">
      <div className="my-info">
        <div className="score-summary">
          <div className="score-block">
            <span className="panel-kicker">YOUR SCORE</span>
            <strong>{me?.score??0}</strong><span>/ {state.targetScore}</span>
          </div>
          <div className="hand-score" aria-label={`Your hand score ${privateState?.handScore ?? 0}`}>
            <span>HAND</span><b>{privateState?.handScore ?? 0}</b>
          </div>
        </div>
        <div className="score-track"><span style={{width:`${Math.min(100,((me?.score??0)/state.targetScore)*100)}%`}}/></div>
        <div className="my-name"><Avatar name={me?.name}/><b>{me?.name}</b>{me?.host&&<span>HOST</span>}</div>
      </div>
      <div className="hand" onContextMenu={e=>e.preventDefault()}>
       {orderedHand.map((c,i)=><PlayingCard key={c.code} code={c.code} value={c.value} selected={selected.includes(c.code)} onClick={()=>toggle(c)} index={i}
         draggable={open}
         onPointerDown={e=>handlePointerDown(e,c)}
         onDragStart={()=>setDragCode(c.code)}
         onDragOver={e=>e.preventDefault()}
         onDrop={()=>{if(!dragCode||dragCode===c.code)return;setHandOrder(order=>{const next=[...order];const a=next.indexOf(dragCode),b=next.indexOf(c.code);if(a<0||b<0)return order;next.splice(a,1);next.splice(b,0,dragCode);return next})}}
       />)}
      </div>
      <div className="controls">
       {open?<div className="open-lock"><Clock3 size={18}/><div><b>Opening check in progress</b><span>Cards can be rearranged. Gameplay is paused.</span></div><Countdown endsAt={state.openingEndsAt}/></div>:<>
        <button className="btn action-secondary" disabled={!myTurn||!legal.includes('TAKE_DROP')||!state.previousDropCard} onClick={()=>action('take')}><span>Take</span><small>PREVIOUS DROP</small></button>
        <button className="btn primary drop-btn" disabled={!myTurn||!legal.includes('DROP')||selected.length===0} onClick={drop}>Drop {selected.length?selected.length+' card'+(selected.length>1?'s':''):''} <span>→</span></button>
        <button className="btn action-secondary" disabled={!myTurn||!legal.includes('DRAW_DECK')} onClick={()=>action('draw')}><span>Draw</span><small>FROM DECK</small></button>
        {legal.includes('OPEN')&&<button className="open-btn" onClick={()=>action('open')}><Sparkles size={16}/> OPEN ROUND</button>}
       </>}
      </div>
    </div>
   </div>
   {result&&<RoundResult state={state} room={room} action={action}/>} {over&&<Winner state={state} room={room}/>} {me?.status==='ELIMINATED'&&<div className="spectator-banner"><EyeIcon/> SPECTATOR MODE — watch the remaining table.</div>}
 </main>
}


function VoicePanel({voice,players,room}){
 const humans=players.filter(p=>!p.bot&&p.id!==room.playerId&&p.status==='CONNECTED');
 return <div className={`voice-panel ${voice.active?'live':''}`}>
  <div className="voice-title"><span className={voice.speaking?'voice-pulse':''}><Radio size={14}/></span><b>VOICE</b><small>{voice.active?`${humans.length+1} connected`:'Off'}</small></div>
  <div className="voice-actions">
   {!voice.active?<button className="voice-btn join" onClick={voice.enable}><Mic size={15}/><span>Join voice</span></button>:<>
    <button className={`voice-btn ${voice.muted?'danger':''}`} title={voice.muted?'Unmute':'Mute'} onClick={voice.toggleMute}>{voice.muted?<MicOff size={15}/>:<Mic size={15}/>}</button>
    <button className={`voice-btn ${voice.deafened?'danger':''}`} title={voice.deafened?'Undeafen':'Deafen'} onClick={voice.toggleDeafen}>{voice.deafened?<VolumeX size={15}/>:<Volume2 size={15}/>}</button>
    <button className="voice-btn leave" title="Leave voice" onClick={voice.disable}><PhoneOff size={15}/></button>
   </>}
  </div>
 </div>
}

function Spinner(){return <span className="spinner" aria-label="Loading"/>}

function EyeIcon(){return <span className="eye">◉</span>}

function Opponent({player,active,compact}){return <div className={`opponent ${active?'active':''} ${player.status!=='CONNECTED'?'dimmed':''}`}><Avatar name={player.name}/><div className="opp-copy"><b>{player.name}</b><span>{player.status==='ELIMINATED'?'ELIMINATED':player.status==='DISCONNECTED'?'DISCONNECTED':`Score ${player.score}`}</span></div>{player.host&&<span className="mini-badge">HOST</span>}{player.bot&&<span className="mini-badge bot-mini">BOT</span>}{player.dealer&&<span className="mini-badge gold">DEALER</span>}{active&&<span className="turn-dot"/>}</div>}

function PlayingCard({code,value,selected,onClick,small,index=0,draggable,onDragStart,onDragOver,onDrop,onPointerDown,nonInteractive}){const suit=code?.slice(-1);const rank=code?.slice(0,-1);const red=['♥','♦'].includes(suit);return <button type="button" aria-label={`${rank} ${suit}`} tabIndex={nonInteractive?-1:0} className={`card playing ${red?'red':'black'} ${selected?'selected':''} ${small?'small':''} ${nonInteractive?'non-interactive':''}`} style={{'--i':index}} draggable={!nonInteractive&&draggable} onDragStart={!nonInteractive?onDragStart:undefined} onDragOver={!nonInteractive?onDragOver:undefined} onDrop={!nonInteractive?onDrop:undefined} onPointerDown={!nonInteractive?onPointerDown:undefined} onClick={!nonInteractive?onClick:undefined}>{rank&&<span>{rank}</span>}<strong>{suit}</strong>{!small&&<em>{value??''}</em>}</button>}

function Countdown({endsAt}){const [left,setLeft]=useState(endsAt?Math.max(0,Math.ceil((endsAt-Date.now())/1000)):10);useEffect(()=>{const t=setInterval(()=>setLeft(Math.max(0,Math.ceil((endsAt-Date.now())/1000))),200);return()=>clearInterval(t)},[endsAt]);return <strong className="countdown">{String(left).padStart(2,'0')}</strong>}

function RoundResult({state,room,action}){const me=state.players.find(p=>p.id===room.playerId);const won=!!state.roundWinnerName;return <div className="overlay"><div className={`result-modal ${won?'round-win':''}`}><div className="result-icon"><Sparkles/></div><span className="eyebrow center">ROUND COMPLETE</span>{won?<><h2>{state.roundWinnerName} has won the round!</h2><div className="round-winner-score"><span>HAND SCORE</span><strong>{state.roundWinnerHandScore??0}</strong><small>{state.roundWinnerName}'s score at opening</small></div><p className="round-win-copy">Opening was legal — {state.roundWinnerName} had the lowest score.</p></>:<><h2>OPEN FAILED</h2><p>{state.message}</p></>}<div className="results-list">{state.players.map(p=><div key={p.id}><span>{p.name}</span><b>{p.score}</b></div>)}</div>{me?.host&&<button className="btn primary wide" onClick={()=>action('next')}>Next round <span>→</span></button>}<small>Scores shown are cumulative.</small></div></div>}

function Winner({state,room}){const winner=state.players.find(p=>p.status!=='ELIMINATED');const winnerName=winner?.name||state.roundWinnerName||'Winner';return <div className="overlay winner-overlay"><div className="winner-modal"><img className="party-popper" src={partyPopper} alt="Party poppers"/><div className="trophy"><Crown size={28}/></div><span className="eyebrow center">GAME COMPLETE</span><p className="winner-label">WINNER</p><h1>{winnerName}</h1><p className="winner-announcement">Winner is <strong>{winnerName}</strong></p><p>Final player standing</p><div className="winner-score">{winner?.score??0}<span>PTS</span></div><div className="results-list final">{[...state.players].sort((a,b)=>a.score-b.score).map((p,i)=><div key={p.id}><span><b>{i+1}</b>{p.name}</span><b>{p.score}</b></div>)}</div><button className="btn secondary wide" onClick={()=>location.reload()}>Back to lobby</button></div></div>}

export { GameScreen };
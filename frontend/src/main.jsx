import React,{useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Header,ErrorToast} from './components/common.jsx';
import {Landing,Create,Join,Lobby} from './components/screens.jsx';
import {GameScreen} from './components/GameScreen.jsx';
import {api} from './services/api.js';
import {useGameSocket} from './services/websocket.js';
import './styles/variables.css';import './styles/globals.css';import './styles/cards.css';import './styles/animations.css';
function App(){const [screen,setScreen]=useState('landing');const [room,setRoom]=useState(null);const [publicState,setPublic]=useState(null);const [privateState,setPrivate]=useState(null);const [error,setError]=useState('');
 const onError=useCallback(e=>setError(e),[]);
 const onPublic=useCallback(state=>{
   if(state.connection)return;
   setPublic(state);
   if(['PLAYING','OPEN_CONFIRMATION','ROUND_RESULT','GAME_OVER'].includes(state.phase))setScreen('game');
 },[]);

 const socket=useGameSocket(room?.roomCode,room?.playerId,onPublic,setPrivate,onError);
 const create=async(name,target,bots=0,difficulty='NORMAL')=>{try{const r=await api('/api/rooms',{method:'POST',body:JSON.stringify({playerName:name,targetScore:Number(target),botCount:Number(bots),botDifficulty:difficulty})});setRoom(r);setScreen('lobby');setError('');}catch(e){setError(e.message)}};
 const join=async(name,code)=>{try{const r=await api(`/api/rooms/${code.toUpperCase()}/join`,{method:'POST',body:JSON.stringify({playerName:name})});setRoom(r);setScreen('lobby');setError('');}catch(e){setError(e.message)}};
 useEffect(()=>{if(!room)return;api(`/api/rooms/${room.roomCode}`).then(setPublic).catch(()=>{});},[room?.roomCode]);
 useEffect(()=>{if(room?.roomCode&&publicState?.phase==='LOBBY')setScreen('lobby')},[publicState?.phase,room]);
 if(!room)return <><Header/><main>{screen==='landing'&&<Landing onCreate={()=>setScreen('create')} onJoin={()=>setScreen('join')}/>} {screen==='create'&&<Create onBack={()=>setScreen('landing')} onCreate={create}/>} {screen==='join'&&<Join onBack={()=>setScreen('landing')} onJoin={join}/>}</main><ErrorToast message={error} clear={()=>setError('')}/></>;
 if(screen==='lobby')return <><Header room={room.roomCode}/><Lobby room={room} state={publicState} onBack={()=>{setRoom(null);setPublic(null)}} onStart={async()=>{try{await api(`/api/rooms/${room.roomCode}/start`,{method:'POST',body:JSON.stringify({playerId:room.playerId})})}catch(e){setError(e.message)}}} onTarget={async(v)=>{try{await api(`/api/rooms/${room.roomCode}/settings/target?playerId=${room.playerId}&value=${v}`,{method:'PUT'})}catch(e){setError(e.message)}}}/><ErrorToast message={error} clear={()=>setError('')}/></>;
 return <><GameScreen room={room} state={publicState} privateState={privateState} socket={socket} error={error} setError={setError}/><ErrorToast message={error} clear={()=>setError('')}/></>;
}
createRoot(document.getElementById('root')).render(<App/>);

export const API=import.meta.env.VITE_API_URL||'http://localhost:8080';
export async function api(path,options={}){const r=await fetch(API+path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Request failed');return data;}

import { useEffect, useRef, useState, type ReactNode } from 'react';
// Firebase is installed in the deployment workspace; this module never contains credentials.
// @ts-expect-error JavaScript module
import { createPrivateClient } from './client.mjs';

type Store<T> = {
  load(): Promise<{revision:number;data:T}|null>;
  initialize(data:T, legacy?: unknown[]): Promise<{revision:number;data:T}>;
  save(revision:number, data:T): Promise<{revision:number;data:T}>;
  restore(revision:number, data:T, legacy:unknown[]): Promise<{revision:number;data:T}>;
  exportBackup(): Promise<unknown>;
  watch(onRevision:(revision:number|null)=>void,onError:(e:Error)=>void):()=>void;
};
export type CloudAccess<T> = { save(data:T):Promise<T>; history():Promise<any>; revision():number };
const download = (value: unknown, name: string) => {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};
export function PrivateGate<T>({dashboard, validate, render}:{dashboard:'ects'|'campus'; validate:(value:unknown)=>T; render:(initial:T,cloud:CloudAccess<T>)=>ReactNode}) {
  const [client,setClient]=useState<any>(null), [user,setUser]=useState<any>(undefined);
  const [state,setState]=useState<{data:T;revision:number}|null>(null), [store,setStore]=useState<Store<T>|null>(null);
  const [message,setMessage]=useState(''), [remote,setRemote]=useState(false), [busy,setBusy]=useState(false), [ready,setReady]=useState(false);
  const revision=useRef(0), saving=useRef(false);
  const recoveryInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    let disposed=false; let unsubscribe=()=>{};
    const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
    createPrivateClient(config, import.meta.env.VITE_OWNER_UID).then((c:any)=>{
      if(disposed) return; setClient(c);
      unsubscribe=c.observe((u:any,err:string)=>{setUser(u);setMessage(err);setState(null);setStore(null);setReady(false)});
    }).catch((e:Error)=>{if(!disposed){setMessage(e.message);setUser(null)}});
    return ()=>{disposed=true;unsubscribe()};
  },[]);
  useEffect(()=>{
    if(!client || !user) return;
    let cancelled=false;
    const s:Store<T>=client.store(dashboard,validate); setStore(s);
    s.load().then(result=>{if(cancelled)return; revision.current=result?.revision||0;setState(result);setReady(true)}).catch(e=>{if(!cancelled){setMessage('Cloud-Daten konnten nicht geladen werden. Bitte Verbindung und Zugriffsrechte prüfen.');setReady(false)}});
    return ()=>{cancelled=true};
  },[client,user,dashboard,validate]);
  useEffect(()=>{
    if(!store||!ready)return;
    return store.watch(r=>{if(!saving.current && r!==revision.current && !(r===null&&revision.current===0))setRemote(true)},()=>setMessage('Synchronisierung unterbrochen. Änderungen werden nicht automatisch überschrieben.'));
  },[store,ready]);
  const cloud:CloudAccess<T>={
    revision:()=>revision.current,
    async save(data:T){
      if(!store || saving.current) throw Error('Speichern ist bereits aktiv oder nicht verfügbar.');
      saving.current=true;
      try {const saved=await store.save(revision.current,data);revision.current=saved.revision;return saved.data;}
      finally {saving.current=false;}
    },
    async history(){if(!store)throw Error('Cloud nicht verfügbar.');return store.exportBackup()},
  };
  if(!client||user===undefined) return <main style={{padding:24}}><h1>Privater Studienbereich</h1><p>{message||'Sichere Verbindung wird vorbereitet …'}</p></main>;
  if(!user) return <main style={{padding:24,maxWidth:620,margin:'auto'}}><h1>Privater Studienbereich</h1><p>Mit dem freigeschalteten Google-Konto anmelden.</p><button onClick={async()=>{try{await client.login()}catch{setMessage('Anmeldung fehlgeschlagen oder Konto nicht freigeschaltet.')}}}>Mit Google anmelden</button><p role="alert">{message}</p></main>;
  if(!ready) return <main style={{padding:24}}><p>{message||'Cloud-Daten werden geladen …'}</p><button onClick={()=>location.reload()}>Erneut versuchen</button><button onClick={()=>client.logout()}>Abmelden</button></main>;
  if(!state) return <main style={{padding:24,maxWidth:700,margin:'auto'}}><h1>Erste Datenübernahme</h1><p>Wähle den privaten JSON-Export des ursprünglichen Dashboards. Ein vorhandener Cloud-Datenstand wird niemals überschrieben.</p><input type="file" accept="application/json,.json" disabled={busy} onChange={async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file||!store)return;setBusy(true);
    try{
      if(file.size>8000000)throw Error('Datei ist zu groß.');
      const raw=JSON.parse(await file.text());
      let data:unknown=raw;let legacy:unknown[]=[];
      if(raw?.format==='study-cloud-backup' && raw.dashboard===dashboard){
        if(!Array.isArray(raw.history) || !Array.isArray(raw.legacy)) throw Error('Verlauf fehlt.');
        data=raw.current?.data;
        legacy=[...raw.legacy, ...raw.history.map((x:any)=>({type:'snapshot',...x}))];
      } else if(dashboard==='campus' && raw?.format==='campus-sqlite-export'){
        data=raw.current?.data;
        if(!Array.isArray(raw.history)||!Array.isArray(raw.progressHistory))throw Error('Verlauf fehlt.');
        legacy=[...raw.history.map((x:any)=>({type:'snapshot',...x})),...raw.progressHistory.map((x:any)=>({type:'progress',...x}))];
      }
      const value=validate(data);
      if(!window.confirm('Diesen Datenbestand erstmalig in deinen privaten Cloud-Speicher übernehmen?'))return;
      const saved=await store.initialize(value,legacy);revision.current=saved.revision;setState(saved);setMessage('');
    }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }}/><p role="alert">{message}</p><button onClick={()=>client.logout()}>Abmelden</button></main>;
  return <><div style={{background:'#eef6f4',color:'#163e36',padding:'8px 16px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}><span>Privater Cloud-Speicher {remote?'· neuer Stand auf anderem Gerät':''}</span>{remote&&<button onClick={()=>{if(window.confirm('Neu laden? Nicht gespeicherte Eingaben gehen verloren. Sichere sie vorher.'))location.reload()}}>Neuen Stand laden</button>}<button onClick={async()=>{try{download(await cloud.history(),`${dashboard}-cloud-backup.json`)}catch(e){setMessage((e as Error).message)}}}>Cloud-Backup inkl. Verlauf</button><button disabled={busy} onClick={()=>recoveryInput.current?.click()}>Backup wiederherstellen</button><input ref={recoveryInput} hidden type="file" accept="application/json,.json" onChange={async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file||!store)return;setBusy(true);
    try {
      if(file.size>8000000)throw Error('Datei ist zu groß.');
      const raw=JSON.parse(await file.text());
      if(raw?.format!=='study-cloud-backup'||raw.dashboard!==dashboard||!Array.isArray(raw.history)||!Array.isArray(raw.legacy))throw Error('Ungültiges Cloud-Backup.');
      const data=validate(raw.current?.data), legacy=[...raw.legacy,...raw.history.map((x:any)=>({type:'snapshot',...x}))];
      if(!window.confirm('Das Backup ersetzt den aktuellen Stand. Der bisherige Cloud-Stand bleibt im Verlauf erhalten. Nicht gespeicherte Eingaben gehen verloren. Fortfahren?'))return;
      saving.current=true;
      const saved=await store.restore(revision.current,data,legacy);revision.current=saved.revision;setState(saved);setRemote(false);setMessage('Backup wiederhergestellt.');
    } catch(e) {setMessage((e as Error).message)} finally {saving.current=false;setBusy(false)}
  }}/><button onClick={()=>{if(window.confirm('Abmelden? Nicht gespeicherte Eingaben gehen verloren.'))client.logout()}}>Abmelden</button>{message&&<span role="alert">{message}</span>}</div><div key={state.revision}>{render(state.data,cloud)}</div></>;
}

// HTML media playback keeps music on the browser's normal media channel (also
// on iOS). Short gameplay effects remain synthesized with Web Audio.
const STORAGE_KEY='rogue-chess-audio-v2';
export function createGameAudio({host=globalThis,doc=globalThis.document,storage,soundtrackUrl=`${import.meta.env?.BASE_URL||'/'}audio/dungeon-theme-v2.mp3`}={}){
 try{storage??=host.localStorage;}catch{}
 let preferences;try{preferences=JSON.parse(storage?.getItem(STORAGE_KEY)||storage?.getItem('rogue-chess-audio-v1')||'null');}catch{}
 let musicEnabled=preferences?.music!==false,effectsEnabled=preferences?.effects!==false;
 let music,context,effectsBus,pendingPlay=null,playToken=0,interacted=false;
 let musicState=musicEnabled?'ready':'off',musicUnsupported=false,effectsUnsupported=false;
 const listeners=new Set();
 function notify(){for(const listener of listeners){try{listener();}catch{}}}
 function save(){try{storage?.setItem(STORAGE_KEY,JSON.stringify({music:musicEnabled,effects:effectsEnabled}));}catch{}}
 function playbackSession(){try{if(host.navigator?.audioSession)host.navigator.audioSession.type='playback';}catch{}}
 function ensureMusic(){
  if(music)return music;if(!host.Audio){musicUnsupported=true;musicState='error';notify();return null;}
  playbackSession();music=new host.Audio(soundtrackUrl);music.loop=true;music.preload='auto';music.volume=.45;
  music.addEventListener('playing',()=>{if(!musicEnabled||doc?.hidden){music.pause();return;}musicState='playing';notify();});
  music.addEventListener('pause',()=>{musicState=musicEnabled?'ready':'off';notify();});
  music.addEventListener('waiting',()=>{if(musicEnabled&&!music.paused){musicState='loading';notify();}});
  music.addEventListener('error',()=>{musicState='error';notify();});
  return music;
 }
 function pauseMusic(){playToken++;pendingPlay=null;music?.pause();musicState=musicEnabled?'ready':'off';notify();}
 function playMusic(retry=false){
  if(!musicEnabled||doc?.hidden)return Promise.resolve(false);
  const element=ensureMusic();if(!element)return Promise.resolve(false);
  if(element.error){if(!retry)return Promise.resolve(false);element.load();}
  if(!element.paused){musicState='playing';notify();return Promise.resolve(true);}
  if(pendingPlay)return pendingPlay;
  const token=++playToken;musicState='loading';notify();
  let result;try{result=element.play();}catch(error){result=Promise.reject(error);}
  pendingPlay=Promise.resolve(result).then(()=>{
   if(token!==playToken)return false;
   if(!musicEnabled||doc?.hidden){pauseMusic();return false;}
   musicState='playing';notify();return true;
  }).catch(error=>{
   if(token!==playToken)return false;
   // A blocked gesture or interrupted load is recoverable on the next tap.
   musicState=error?.name==='NotAllowedError'||error?.name==='AbortError'?'ready':'error';notify();return false;
  }).finally(()=>{if(token===playToken)pendingPlay=null;});
  return pendingPlay;
 }
 async function resumeEffects(){
  if(!effectsEnabled)return false;
  try{
   if(!context||context.state==='closed'){
    const AudioContext=host.AudioContext||host.webkitAudioContext;
    if(!AudioContext){effectsUnsupported=true;notify();return false;}
    playbackSession();context=new AudioContext();effectsBus=context.createGain();effectsBus.gain.value=.32;effectsBus.connect(context.destination);
   }
   // Safari can report "interrupted", not just "suspended".
   if(context.state!=='running')await context.resume();
   return context.state==='running';
  }catch{return false;}
 }
 function unlock(){
  interacted=true;playbackSession();
  // Invoke play() inside the gesture, before awaiting any Web Audio promise.
  return Promise.all([playMusic(),resumeEffects()]);
 }
 async function toggleMusic(){
  interacted=true;
  if(musicEnabled&&(musicState==='playing'||musicState==='loading')){musicEnabled=false;pauseMusic();save();return;}
  musicEnabled=true;save();await playMusic(true);
 }
 async function toggleEffects(){effectsEnabled=!effectsEnabled;save();if(effectsEnabled)await resumeEffects();notify();}
 const frequency=note=>440*2**((note-69)/12);
 function tone(note,at,duration,volume,type){
  const oscillator=context.createOscillator(),envelope=context.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency(note),at);
  envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(volume,at+.008);envelope.gain.setValueAtTime(volume*.65,at+duration*.35);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);
  oscillator.connect(envelope).connect(effectsBus);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};oscillator.start(at);oscillator.stop(at+duration+.015);
 }
 async function playMove(move,check=false){
  if(!effectsEnabled||doc?.hidden||!await resumeEffects()||!effectsEnabled||doc?.hidden)return;
  const at=context.currentTime;
  if(move.promotion)[72,76,79,84].forEach((n,i)=>tone(n,at+i*.055,.13,.2,'square'));
  else if(move.captured){[64,55,43].forEach((n,i)=>tone(n,at+i*.035,.09,.22,'triangle'));tone(79,at,.035,.1,'square');}
  else if(move.flags?.includes('k')||move.flags?.includes('q'))[60,67,72].forEach((n,i)=>tone(n,at+i*.04,.08,.17,'square'));
  else{tone(move.color==='w'?76:69,at,.035,.13,'square');tone(move.color==='w'?60:53,at+.026,.09,.3,'triangle');}
  if(check)[81,77].forEach((n,i)=>tone(n,at+.16+i*.09,.13,.12,'square'));
 }
 async function playPack(){if(!effectsEnabled||doc?.hidden||!await resumeEffects()||!effectsEnabled)return;const at=context.currentTime;[60,64,67,72,79,84].forEach((note,index)=>tone(note,at+index*.075,.16,.17,'square'));}
 async function playReward(){if(!effectsEnabled||doc?.hidden||!await resumeEffects()||!effectsEnabled)return;const at=context.currentTime;[72,76,79].forEach((note,index)=>tone(note,at+index*.035,.22,.14,'triangle'));}
 doc?.addEventListener('visibilitychange',()=>{if(doc.hidden)pauseMusic();else if(interacted)void unlock();});
 host.addEventListener?.('pagehide',pauseMusic);
 host.addEventListener?.('pageshow',()=>{if(interacted&&!doc?.hidden)void unlock();});
 return {
  unlock,toggleMusic,toggleEffects,playMove,playPack,playReward,
  subscribe(listener){listeners.add(listener);listener();return()=>listeners.delete(listener);},
  get music(){return musicEnabled;},get musicStatus(){return musicState;},get effects(){return effectsEnabled;},
  get musicUnavailable(){return musicUnsupported;},get effectsUnavailable(){return effectsUnsupported;},
  get unavailable(){return musicUnsupported&&effectsUnsupported;},
 };
}
export const audio=createGameAudio();

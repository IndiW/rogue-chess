import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGameAudio} from '../src/audio.js';
function setup({preferences,blocked=0,webAudio=true,resumeFailures=0}={}){
 const data=new Map();if(preferences)data.set('rogue-chess-audio-v1',JSON.stringify(preferences));
 const media=[],contexts=[];let blockedCount=blocked,failures=resumeFailures;
 class Media extends EventTarget{
  constructor(url){super();this.src=url;this.paused=true;this.error=null;this.playCalls=0;media.push(this);}
  async play(){this.playCalls++;if(blockedCount-->0)throw new DOMException('Tap required','NotAllowedError');this.paused=false;this.dispatchEvent(new Event('playing'));}
  pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  load(){this.error=null;}
 }
 class Context{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.resumeCalls=0;this.oscillators=0;contexts.push(this);}
  async resume(){this.resumeCalls++;if(failures-->0)throw new Error('Interrupted by OS');this.state='running';}
  createGain(){const gain={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};return {gain,connect(){return this;},disconnect(){}};}
  createOscillator(){this.oscillators++;return {frequency:{setValueAtTime(){}},connect(node){return node;},start(){},stop(){},disconnect(){}};}
 }
 const host=new EventTarget();host.Audio=Media;if(webAudio)host.AudioContext=Context;host.navigator={audioSession:{type:'auto'}};
 const doc=new EventTarget();doc.hidden=false;
 const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 const audio=createGameAudio({host,doc,storage,soundtrackUrl:'/audio/theme.mp3'});
 return {audio,media,contexts,doc,host,data};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('music defaults on but creates no playback before a gesture; normal media is looped and audible',async()=>{
 const s=setup();assert.equal(s.audio.music,true);assert.equal(s.media.length,0);await s.audio.unlock();assert.equal(s.media.length,1);assert.equal(s.media[0].paused,false);assert.equal(s.media[0].loop,true);assert.ok(s.media[0].volume>.3);assert.equal(s.audio.musicStatus,'playing');assert.equal(s.host.navigator.audioSession.type,'playback');
});
test('saved music mute is respected, and music/effect controls are independent',async()=>{
 const s=setup({preferences:{music:false,effects:true}});await s.audio.unlock();assert.equal(s.media.length,0);assert.equal(s.audio.music,false);
 await s.audio.toggleMusic();assert.equal(s.audio.musicStatus,'playing');await s.audio.toggleEffects();assert.equal(s.audio.effects,false);assert.equal(s.media[0].paused,false);
 await s.audio.toggleMusic();assert.equal(s.media[0].paused,true);assert.equal(JSON.parse(s.data.get('rogue-chess-audio-v2')).music,false);
});
test('an autoplay rejection keeps music retryable and does not permanently disable audio',async()=>{
 const s=setup({blocked:1});await s.audio.unlock();assert.equal(s.audio.music,true);assert.equal(s.audio.musicStatus,'ready');assert.equal(s.audio.unavailable,false);
 await s.audio.toggleMusic();assert.equal(s.media[0].playCalls,2);assert.equal(s.audio.musicStatus,'playing');
});
test('tab interruption pauses media and resumes when visible, while explicit mute stays muted',async()=>{
 const s=setup();await s.audio.unlock();s.doc.hidden=true;s.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(s.media[0].paused,true);
 s.doc.hidden=false;s.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(s.audio.musicStatus,'playing');
 await s.audio.toggleMusic();s.doc.hidden=true;s.doc.dispatchEvent(new Event('visibilitychange'));s.doc.hidden=false;s.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(s.media[0].paused,true);assert.equal(s.audio.music,false);
});
test('Safari interrupted effects contexts resume, and transient resume failure is recoverable',async()=>{
 const s=setup({resumeFailures:1});await s.audio.unlock();assert.equal(s.audio.effectsUnavailable,false);assert.equal(s.audio.musicStatus,'playing');await s.audio.unlock();assert.equal(s.contexts[0].state,'running');s.contexts[0].state='interrupted';await s.audio.playMove({color:'w'});assert.equal(s.contexts[0].state,'running');assert.equal(s.contexts[0].oscillators,2);
});
test('music works even when Web Audio effects are unsupported',async()=>{
 const s=setup({webAudio:false});await s.audio.unlock();assert.equal(s.audio.musicStatus,'playing');assert.equal(s.audio.effectsUnavailable,true);assert.equal(s.audio.musicUnavailable,false);
});
test('media errors can be retried and subscribers see the actual playing state',async()=>{
 const s=setup();let notifications=0;s.audio.subscribe(()=>notifications++);await s.audio.unlock();s.media[0].error={code:2};s.media[0].paused=true;s.media[0].dispatchEvent(new Event('error'));assert.equal(s.audio.musicStatus,'error');await s.audio.toggleMusic();assert.equal(s.audio.musicStatus,'playing');assert.ok(notifications>3);
});
test('pack opening and reward cues respect the sound-effects toggle',async()=>{
 const s=setup({preferences:{music:false,effects:false}});await s.audio.playPack();assert.equal(s.contexts.length,0);await s.audio.toggleEffects();await s.audio.playPack();assert.equal(s.contexts[0].oscillators,6);await s.audio.playReward();assert.equal(s.contexts[0].oscillators,9);
});

// Original Rogue Chess score, rendered to a mobile-friendly, locally hosted MP3.
// Optional authoring command: node scripts/render-music.mjs (requires ffmpeg).
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const sampleRate=44100,beat=60/108/2;
const melody=[76,0,72,74,76,0,79,76,74,0,72,0,71,72,74,0,72,0,69,71,72,0,76,72,71,0,67,0,69,71,72,0,74,0,71,72,74,0,77,74,76,0,74,72,71,0,67,0,69,0,72,0,76,74,72,71,69,0,64,0,69,0,0,0];
const chords=[[45,52,57,60],[41,48,53,57],[43,50,55,59],[45,52,57,60]];
const frames=Math.round(melody.length*beat*sampleRate),left=new Float32Array(frames),right=new Float32Array(frames);
function tone(note,start,duration,volume,type,pan=0){
 if(!note)return;const frequency=440*2**((note-69)/12),begin=Math.round(start*sampleRate),length=Math.round(duration*sampleRate);
 for(let i=0;i<length&&begin+i<frames;i++){
  const t=i/sampleRate,p=t*frequency%1;
  const wave=type==='triangle'?1-4*Math.abs(p-.5):(p<.25?1:-1/3);
  const attack=Math.min(1,t/.007),release=Math.max(0,1-t/duration),envelope=attack*release*release;
  const value=wave*volume*envelope;left[begin+i]+=value*Math.sqrt((1-pan)/2);right[begin+i]+=value*Math.sqrt((1+pan)/2);
 }
}
let noise=123456789;
for(let step=0;step<melody.length;step++){
 const at=step*beat,chord=chords[Math.floor(step/16)];
 tone(melody[step],at,beat*.9,.28,'pulse',-.16);
 if(step%2===0)tone(chord[0],at,beat*1.8,.34,'triangle');
 tone(chord[1+step%3]+12,at,beat*.6,.11,'pulse',.38);
 const start=Math.round(at*sampleRate),duration=.035;
 for(let i=0;i<duration*sampleRate&&start+i<frames;i++){
  noise^=noise<<13;noise^=noise>>>17;noise^=noise<<5;
  const value=((noise>>>0)/4294967296*2-1)*.026*(1-i/(duration*sampleRate))**3;
  left[start+i]+=value;right[start+i]+=value;
 }
}
let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
const scale=.82/peak,wav=Buffer.alloc(44+frames*4);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*4,40);
for(let i=0;i<frames;i++){wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left[i]*scale))*32767),44+i*4);wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right[i]*scale))*32767),46+i*4);}
await mkdir(new URL('../work/',import.meta.url),{recursive:true});await mkdir(new URL('../public/audio/',import.meta.url),{recursive:true});
const input=new URL('../work/dungeon-theme.wav',import.meta.url),output=new URL('../public/audio/dungeon-theme-v2.mp3',import.meta.url);
await writeFile(input,wav);
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input.pathname,'-codec:a','libmp3lame','-b:a','160k','-metadata','title=Rogue Chess — Dungeon Theme','-metadata','artist=Rogue Chess',output.pathname],{stdio:'inherit'});
if(result.status!==0)throw new Error('ffmpeg could not render the soundtrack');
console.log(`Rendered original ${Number(frames/sampleRate).toFixed(2)}s stereo loop to ${output.pathname}`);

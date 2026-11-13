'use strict';
const ClubMusic={
 audio:null,owner:null,playing:false,starting:false,version:0,key:null,cleanup:null,
 volume(){try{const n=Number(localStorage.getItem('politeshik:club-volume:'+Cloud.uid));return Number.isFinite(n)&&localStorage.getItem('politeshik:club-volume:'+Cloud.uid)!==null?Math.max(0,Math.min(1,n)):.35;}catch(e){return .35;}},
 target(){
  const current=typeof ClubDJ!=='undefined'?ClubDJ.current():null,track=current&&ClubDJ.track(current.track);
  if(track)return {src:track.src,key:current.key,startsAt:Date.parse(current.starts_at),seconds:track.seconds,loop:false};
  const room=Club.room||'main';return {src:room==='games'?'assets/club-jazz.mp3':room==='cinema'?'assets/club-cinema.mp3':'assets/club-bounce.mp3',key:room,loop:true};
 },
 async toggle(){
  if(ClubMusic.playing||ClubMusic.starting){ClubMusic.stop();return;}
  if(ui.tab!=='club'||!Social.allowed())return;
  return ClubMusic.play(ClubMusic.target());
 },
 async play(target){
  const owner=Cloud.uid,version=++ClubMusic.version;
  ClubMusic.cleanup?.();
  const reusable=ClubMusic.audio&&ClubMusic.owner===owner?ClubMusic.audio:null;
  ClubMusic.audio?.pause();
  const audio=reusable||new Audio(target.src);
  if(reusable)audio.src=target.src;
  ClubMusic.owner=owner;ClubMusic.audio=audio;ClubMusic.key=target.key;ClubMusic.starting=true;audio.loop=target.loop;audio.volume=ClubMusic.volume();
  const seek=()=>{
   if(version!==ClubMusic.version||!Number.isFinite(target.startsAt))return;
   const offset=typeof ClubMovie!=='undefined'?ClubMovie.offset:0;
   const elapsed=Math.max(0,Math.min(target.seconds-.05,(Date.now()+offset-target.startsAt)/1000));
   try{audio.currentTime=elapsed;}catch(e){}
  };
  audio.addEventListener?.('loadedmetadata',seek,{once:true});
  const ended=()=>{if(version===ClubMusic.version&&ClubMusic.playing&&ui.tab==='club'&&Club.room==='main')Club.refresh('state');};
  audio.addEventListener?.('ended',ended,{once:true});
  ClubMusic.cleanup=()=>{audio.removeEventListener?.('loadedmetadata',seek);audio.removeEventListener?.('ended',ended);};
  seek();
  try{await audio.play();if(version!==ClubMusic.version){if(audio!==ClubMusic.audio)audio.pause();return;}if(owner!==Cloud.uid||ui.tab!=='club'){audio.pause();return;}ClubMusic.playing=true;}
  catch(error){if(version===ClubMusic.version){toast('Не удалось включить музыку. Нажмите ещё раз.');ClubMusic.stop();}}
  finally{if(version===ClubMusic.version){ClubMusic.starting=false;ClubMusic.sync();}}
 },
 follow(){
  if(!(ClubMusic.playing||ClubMusic.starting))return;
  if(ui.tab!=='club'||Cloud.uid!==ClubMusic.owner||!Social.allowed()){ClubMusic.stop();return;}
  const target=ClubMusic.target();if(target.key!==ClubMusic.key)ClubMusic.play(target);
 },
 stop(){ClubMusic.version++;ClubMusic.cleanup?.();ClubMusic.cleanup=null;ClubMusic.audio?.pause();ClubMusic.audio=null;ClubMusic.key=null;ClubMusic.playing=false;ClubMusic.starting=false;ClubMusic.owner=null;ClubMusic.sync();},
 setVolume(value){const n=Math.max(0,Math.min(1,Number(value)/100));if(!Number.isFinite(n))return;if(ClubMusic.audio)ClubMusic.audio.volume=n;try{localStorage.setItem('politeshik:club-volume:'+Cloud.uid,String(n));}catch(e){}document.querySelectorAll('[data-input="club-volume"]').forEach(el=>{if(el.value!==String(Math.round(n*100)))el.value=Math.round(n*100);});},
 sync(){document.querySelectorAll('[data-action="club-music"]').forEach(b=>{b.textContent=ClubMusic.playing||ClubMusic.starting?'⏸ Выключить музыку':'♫ Включить музыку';b.setAttribute('aria-pressed',String(ClubMusic.playing||ClubMusic.starting));});},
 html(){return '<button class="btn" data-action="club-music" aria-pressed="'+(ClubMusic.playing||ClubMusic.starting)+'">'+(ClubMusic.playing||ClubMusic.starting?'⏸ Выключить музыку':'♫ Включить музыку')+'</button><label class="club-volume">Громкость<input type="range" min="0" max="100" step="1" value="'+Math.round(ClubMusic.volume()*100)+'" data-input="club-volume" aria-label="Громкость музыки в клубе"></label>'},
 check(){if((ClubMusic.playing||ClubMusic.starting)&&(ui.tab!=='club'||Cloud.uid!==ClubMusic.owner||!Social.allowed()))ClubMusic.stop();}
};
A['club-music']=()=>ClubMusic.toggle();
document.addEventListener('input',e=>{if(e.target.dataset.input==='club-volume')ClubMusic.setVolume(e.target.value);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)ClubMusic.stop();});

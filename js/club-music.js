'use strict';
const ClubMusic={
 audio:null,owner:null,playing:false,starting:false,version:0,
 volume(){try{const n=Number(localStorage.getItem('politeshik:club-volume:'+Cloud.uid));return Number.isFinite(n)&&localStorage.getItem('politeshik:club-volume:'+Cloud.uid)!==null?Math.max(0,Math.min(1,n)):.35;}catch(e){return .35;}},
 async toggle(){
  if(ClubMusic.playing||ClubMusic.starting){ClubMusic.stop();return;}
  if(ui.tab!=='club'||!Social.allowed())return;
  const owner=Cloud.uid,version=++ClubMusic.version,audio=new Audio('assets/club-bounce.mp3');
  ClubMusic.owner=owner;ClubMusic.audio=audio;ClubMusic.starting=true;audio.loop=true;audio.volume=ClubMusic.volume();
  try{await audio.play();if(version!==ClubMusic.version||owner!==Cloud.uid||ui.tab!=='club'){audio.pause();return;}ClubMusic.playing=true;}
  catch(error){if(version===ClubMusic.version){toast('Не удалось включить музыку. Нажмите ещё раз.');ClubMusic.stop();}}
  finally{if(version===ClubMusic.version){ClubMusic.starting=false;ClubMusic.sync();}}
 },
 stop(){ClubMusic.version++;ClubMusic.audio?.pause();ClubMusic.audio=null;ClubMusic.playing=false;ClubMusic.starting=false;ClubMusic.owner=null;ClubMusic.sync();},
 setVolume(value){const n=Math.max(0,Math.min(1,Number(value)/100));if(!Number.isFinite(n))return;if(ClubMusic.audio)ClubMusic.audio.volume=n;try{localStorage.setItem('politeshik:club-volume:'+Cloud.uid,String(n));}catch(e){}},
 sync(){document.querySelectorAll('[data-action="club-music"]').forEach(b=>{b.textContent=ClubMusic.playing||ClubMusic.starting?'⏸ Выключить музыку':'♫ Включить музыку';b.setAttribute('aria-pressed',String(ClubMusic.playing||ClubMusic.starting));});},
 html(){return '<button class="btn" data-action="club-music" aria-pressed="'+(ClubMusic.playing||ClubMusic.starting)+'">'+(ClubMusic.playing||ClubMusic.starting?'⏸ Выключить музыку':'♫ Включить музыку')+'</button><label class="club-volume">Громкость<input type="range" min="0" max="100" step="1" value="'+Math.round(ClubMusic.volume()*100)+'" data-input="club-volume" aria-label="Громкость музыки в клубе"></label>'},
 check(){if((ClubMusic.playing||ClubMusic.starting)&&(ui.tab!=='club'||Cloud.uid!==ClubMusic.owner||!Social.allowed()))ClubMusic.stop();}
};
A['club-music']=()=>ClubMusic.toggle();
document.addEventListener('input',e=>{if(e.target.dataset.input==='club-volume')ClubMusic.setVolume(e.target.value);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)ClubMusic.stop();});

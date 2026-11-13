const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app(){
 const audios=[],calls=[],messages=[],storage=new Map();
 class Audio{constructor(src){this.src=src;audios.push(this);}async play(){this.paused=false;}pause(){this.paused=true;}addEventListener(){}}
 const c=vm.createContext({Cloud:{uid:'a'},Club:{room:'main',joined:true,roomVersion:1,apply(){},refresh(){},walkTo:async(_,after)=>after()},Social:{owner:'a',allowed:()=>true,reset(){},call:async(name,args)=>{calls.push({name,args});throw Error('network');}},ui:{tab:'club'},A:{},Audio,ClubMovie:{offset:0},crypto:{randomUUID:()=>String(calls.length)},document:{querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},U:{esc:s=>String(s).replaceAll('<','&lt;')},toast:s=>messages.push(s),UI:{open(){}}});
 for(const file of ['js/data/club-tracks.js','js/club-dj.js','js/club-music.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 vm.runInContext('globalThis.api={ClubDJ,ClubMusic,CLUB_TRACKS}',c);return{c,...c.api,audios,calls,messages};
}
function state(key='first',track=1){return{current:{key,track,starts_at:new Date(Date.now()-5000).toISOString(),ends_at:new Date(Date.now()+27000).toISOString()},queue:[]};}
test('twenty distinct original recordings load on demand',()=>{
 const {CLUB_TRACKS}=app();assert.equal(CLUB_TRACKS.length,20);assert.equal(new Set(CLUB_TRACKS.map(t=>t.title)).size,20);
 for(const t of CLUB_TRACKS){assert.equal(t.seconds,32);assert.ok(fs.statSync(t.src).size>20000);}
 assert.ok(!fs.readFileSync('service-worker.js','utf8').includes('assets/club-tracks/'));
});
test('DJ follows the shared current track only after enabling audio, with local volume and synchronized position',async()=>{
 const {c,ClubDJ,ClubMusic,audios}=app();ClubDJ.apply(state());assert.equal(audios.length,0);
 ClubMusic.setVolume(20);await ClubMusic.toggle();assert.equal(audios.length,1);assert.equal(audios[0].src,'assets/club-tracks/01.mp3');assert.equal(audios[0].loop,false);
 assert.ok(audios[0].currentTime>=4.9&&audios[0].currentTime<6);assert.equal(audios[0].volume,.2);
 ClubDJ.apply(state());assert.equal(audios.length,1,'Polling restarted the same track');
 ClubDJ.apply(state('next',20));await Promise.resolve();assert.equal(audios.length,1,'Reuse the unlocked audio element on mobile');assert.equal(audios[0].src,'assets/club-tracks/20.mp3');
 ClubMusic.stop();ClubDJ.apply(state('third',3));assert.equal(audios.length,1,'Muted listener was restarted');
 c.Cloud.uid='b';assert.equal(ClubDJ.current(),null,'Previous account DJ state retained');
});
test('queued requests do not interrupt the playing track and queue nicknames are escaped',async()=>{
 const {ClubDJ,ClubMusic,audios}=app();ClubDJ.apply(state());await ClubMusic.toggle();
 const next=state();next.queue=[{key:'queued',track:2,requester:'<img onerror=oops>'}];ClubDJ.apply(next);
 assert.equal(audios.length,1);assert.ok(!ClubDJ.queueHtml().includes('<img'));assert.ok(ClubDJ.queueHtml().includes('&lt;img'));
});
test('lost DJ responses reuse the same request id; switching accounts resets it',async()=>{
 const {c,ClubDJ,calls}=app();await ClubDJ.request(2);await ClubDJ.request(2);
 assert.equal(calls.length,2);assert.equal(calls[0].args.p_nonce,calls[1].args.p_nonce);
 c.Cloud.uid='b';await ClubDJ.request(2);assert.notEqual(calls[0].args.p_nonce,calls[2].args.p_nonce);
});
test('old room responses cannot change DJ playback after leaving the floor',async()=>{
 const {c,ClubDJ}=app();let done;c.Social.call=()=>new Promise(resolve=>done=resolve);
 const pending=ClubDJ.request(1);c.Club.room='cinema';c.Club.roomVersion++;done({dj:state()});await pending;
 assert.equal(ClubDJ.current(),null);assert.equal(ClubDJ.busy,false);
});

'use strict';
// Only public totals returned by the server; no private attendance download for students.
const GroupRating={
 owner:'',data:null,at:0,loading:false,error:'',
 reset(){const key=[Cloud.uid,Cloud.tenantId,Groups.current].join(':');if(key!==GroupRating.owner)Object.assign(GroupRating,{owner:key,data:null,at:0,loading:false,error:''});},
 async load(force=false){
  GroupRating.reset();if(Cloud.status!=='online'||GroupRating.loading||!force&&Date.now()-GroupRating.at<30000)return;
  const owner=GroupRating.owner;GroupRating.loading=true;GroupRating.at=Date.now();
  try{const {data,error}=await supa.rpc('group_leaderboard');if(error)throw Error(error.message);GroupRating.reset();if(owner!==GroupRating.owner)return;GroupRating.data=data;GroupRating.error='';}
  catch(e){if(owner===GroupRating.owner)GroupRating.error=e.message;}
  finally{if(owner===GroupRating.owner){GroupRating.loading=false;if(ui.tab==='rating'&&ui.ratingScope!=='global')App.renderSoft();}}
 }
};
A['group-rating-refresh']=()=>GroupRating.load(true);
setInterval(()=>{if(!document.hidden&&ui.tab==='rating'&&ui.ratingScope!=='global'&&Social.allowed())GroupRating.load();},30000);

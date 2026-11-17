import nodemailer from 'npm:nodemailer@10.6.0';

// Public webhook, authenticated by a short-lived, single-event capability.
// Database RPCs require the server service role and independently verify the capability.
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const env=name=>Deno.env.get(name)||'';
const bytes=hex=>Uint8Array.from(hex.match(/../g)||[],pair=>parseInt(pair,16));
async function decryptEvent(payload,key){
 const id=payload?.event_id,iv=payload?.iv,data=payload?.data,mac=payload?.mac;
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)||typeof iv!=='string'||!/^[a-f0-9]{32}$/.test(iv)||typeof data!=='string'||!data.length||data.length>1536||data.length%32||!/^[a-f0-9]+$/.test(data)||typeof mac!=='string'||!/^[a-f0-9]{64}$/.test(mac))return null;
 const enc=new TextEncoder(),digest=prefix=>crypto.subtle.digest('SHA-256',enc.encode(prefix+key));
 const macKey=await crypto.subtle.importKey('raw',await digest('mac:'),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',macKey,bytes(mac),enc.encode(id+'\n'+iv+'\n'+data)))return null;
 const cipherKey=await crypto.subtle.importKey('raw',await digest('enc:'),{name:'AES-CBC'},false,['decrypt']);
 const clear=await crypto.subtle.decrypt({name:'AES-CBC',iv:bytes(iv)},cipherKey,bytes(data));
 const event=JSON.parse(new TextDecoder().decode(clear));
 return event.event_id===id&&typeof event.token==='string'&&/^[a-f0-9]{64}$/.test(event.token)?event:null;
}
async function rpc(name,body){
 const key=env('SUPABASE_SERVICE_ROLE_KEY');
 const result=await fetch(env('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!result.ok)throw Error('DATABASE_REQUEST_FAILED');
 return await result.json();
}
Deno.serve(async req=>{
 if(req.method!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
 if(Number(req.headers.get('content-length')||0)>2048)return response(413,{error:'BODY_TOO_LARGE'});
 let payload;
 try{const text=await req.text();if(text.length>2048)return response(413,{error:'BODY_TOO_LARGE'});payload=JSON.parse(text);}catch{return response(400,{error:'INVALID_REQUEST'});}
 if(!payload?.event_id||!payload?.iv||!payload?.data||!payload?.mac)return response(400,{error:'INVALID_REQUEST'});
 const host=env('SMTP_HOST'),user=env('SMTP_USER'),pass=env('SMTP_PASS'),from=env('SMTP_FROM'),port=Number(env('SMTP_PORT')||465);
 const dispatchKey=env('LOGIN_DISPATCH_KEY');
 if(!host||!user||!pass||!from||!dispatchKey||![465,587].includes(port))return response(503,{error:'MAIL_NOT_CONFIGURED'});
 let event;try{event=await decryptEvent(payload,dispatchKey);}catch{}
 if(!event)return response(403,{error:'INVALID_OR_CONSUMED_EVENT'});
 const id=event.event_id,token=event.token;
 let claimed=false;
 try{
  const item=await rpc('claim_login_notice',{p_id:id,p_token:token});
  if(!item)return response(403,{error:'INVALID_OR_CONSUMED_EVENT'});claimed=true;
  const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:true,auth:{user,pass},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,tls:{rejectUnauthorized:true}});
  const when=new Date(item.occurred_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'});
  const result=await transport.sendMail({from:{name:'Политешик',address:from},to:item.email,subject:'Вход в ваш аккаунт «Политешика»',messageId:'<login-'+id+'@politeshik.app>',
   text:'В ваш аккаунт «Политешика» выполнен вход по паролю.\n\nВремя: '+when+' (Москва).\n\nЕсли это были вы, ничего делать не нужно. Если входили не вы, откройте https://ariignatenok.github.io/politeshik/ и смените пароль через «Забыли пароль?», затем сообщите Админу Арине.\n\nНикому не сообщайте пароль и коды из писем.'});
  transport.close();
  if(!result.accepted?.length)throw Error('SMTP_DELIVERY_FAILED');
  const recorded=await rpc('finish_login_notice',{p_id:id,p_token:token,p_success:true});
  if(!recorded)return response(503,{error:'DELIVERY_STATUS_UNCONFIRMED'});
  return response(200,{sent:true});
 }catch{
  if(claimed)try{await rpc('finish_login_notice',{p_id:id,p_token:token,p_success:false});}catch{}
  // No email address, bearer token, capability or SMTP exception is written to logs.
  console.error('LOGIN_NOTICE_DELIVERY_FAILED');return response(503,{error:'DELIVERY_FAILED'});
 }
});

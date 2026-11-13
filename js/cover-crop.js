'use strict';
const CoverCrop={
 current:null,
 rect(width,height,ratio,zoom=1,cx=width/2,cy=height/2){
  const w=Math.min(width,height*ratio)/zoom,h=w/ratio;
  cx=Math.max(w/2,Math.min(width-w/2,cx));cy=Math.max(h/2,Math.min(height-h/2,cy));
  return {x:cx-w/2,y:cy-h/2,w,h,cx,cy};
 },
 ratio(){const cover=document.querySelector('.social-profile.is-full .wall-cover'),r=cover?.getBoundingClientRect();return r?.height?Math.max(1.5,Math.min(6,r.width/r.height)):4;},
 cancel(){const c=CoverCrop.current;if(c)c.finish(null);},
 async edit(file){
  CoverCrop.cancel();if(!file.size||file.size>20*1024*1024)throw Error('Выберите фотографию до 20 МБ');
  const owner=Cloud.uid,url=URL.createObjectURL(file),image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Не удалось открыть фото. Попробуйте JPG или PNG.'));image.src=url;});}
  catch(error){URL.revokeObjectURL(url);throw error;}
  if(owner!==Cloud.uid){URL.revokeObjectURL(url);return null;}
  const ratio=CoverCrop.ratio();
  return new Promise(resolve=>{
   const c={owner,url,image,ratio,zoom:1,cx:image.naturalWidth/2,cy:image.naturalHeight/2,drag:null,done:false};
   c.finish=result=>{if(c.done)return;c.done=true;c.observer?.disconnect();URL.revokeObjectURL(url);if(CoverCrop.current===c)CoverCrop.current=null;resolve(result);};
   CoverCrop.current=c;
   UI.open('Обрезать обложку','<div class="cover-crop-editor"><p class="hint">Перемещайте фото пальцем или мышью. Ползунком можно увеличить изображение.</p><canvas class="cover-crop-canvas" tabindex="0" role="img" aria-label="Область обложки. Используйте стрелки для перемещения фото."></canvas><label class="field"><span>Увеличение: <output id="cover-zoom-value">100%</output></span><input type="range" class="cover-crop-zoom" min="1" max="4" step="0.01" value="1" aria-label="Увеличение обложки"></label><div class="head-actions"><button class="btn" data-action="cover-crop-reset">По центру</button><button class="btn" data-action="cover-crop-cancel">Отмена</button><button class="btn primary" data-action="cover-crop-save">Сохранить обложку</button></div></div>',{wide:true,noFocus:true});
   c.root=document.querySelector('.cover-crop-editor');c.canvas=c.root.querySelector('canvas');c.canvas.width=1000;c.canvas.height=Math.round(1000/ratio);c.canvas.style.aspectRatio=String(ratio);
   c.slider=c.root.querySelector('input');c.slider.oninput=()=>{c.zoom=Number(c.slider.value);CoverCrop.draw();};
   c.canvas.onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();const r=CoverCrop.selection();c.drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:r.cx,cy:r.cy,w:r.w,h:r.h};c.canvas.setPointerCapture(e.pointerId);};
   c.canvas.onpointermove=e=>{const d=c.drag;if(!d||d.id!==e.pointerId)return;const box=c.canvas.getBoundingClientRect();c.cx=d.cx-(e.clientX-d.x)*d.w/box.width;c.cy=d.cy-(e.clientY-d.y)*d.h/box.height;CoverCrop.draw();};
   c.canvas.onpointerup=c.canvas.onpointercancel=e=>{if(c.drag?.id===e.pointerId)c.drag=null;};
   c.canvas.onkeydown=e=>{const dirs={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(!dirs[e.key])return;e.preventDefault();const r=CoverCrop.selection(),[x,y]=dirs[e.key];c.cx+=x*r.w*.03;c.cy+=y*r.h*.03;CoverCrop.draw();};
   c.observer=new MutationObserver(()=>{if(!c.root.isConnected||owner!==Cloud.uid)c.finish(null);});c.observer.observe(document.body,{childList:true,subtree:true});CoverCrop.draw();c.canvas.focus({preventScroll:true});
  });
 },
 selection(){const c=CoverCrop.current;return CoverCrop.rect(c.image.naturalWidth,c.image.naturalHeight,c.ratio,c.zoom,c.cx,c.cy);},
 draw(){const c=CoverCrop.current;if(!c||c.done)return;const r=CoverCrop.selection();c.cx=r.cx;c.cy=r.cy;const ctx=c.canvas.getContext('2d'),w=c.canvas.width,h=c.canvas.height;ctx.drawImage(c.image,r.x,r.y,r.w,r.h,0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1;ctx.beginPath();for(const f of [1/3,2/3]){ctx.moveTo(w*f,0);ctx.lineTo(w*f,h);ctx.moveTo(0,h*f);ctx.lineTo(w,h*f);}ctx.stroke();c.root.querySelector('output').textContent=Math.round(c.zoom*100)+'%';},
 reset(){const c=CoverCrop.current;if(!c)return;c.zoom=1;c.cx=c.image.naturalWidth/2;c.cy=c.image.naturalHeight/2;c.slider.value='1';CoverCrop.draw();},
 async save(){const c=CoverCrop.current;if(!c||c.saving||c.owner!==Cloud.uid)return;c.saving=true;const button=c.root.querySelector('[data-action="cover-crop-save"]');button.disabled=true;
  try{const r=CoverCrop.selection(),canvas=document.createElement('canvas');canvas.width=Math.min(1600,Math.max(1,Math.round(r.w)));canvas.height=Math.max(1,Math.round(canvas.width/c.ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(c.image,r.x,r.y,r.w,r.h,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)throw Error('Не удалось обработать фото');if(c.done||c.owner!==Cloud.uid)return;c.finish(new File([blob],'cover.jpg',{type:'image/jpeg'}));UI.close();}
  catch(error){toast(error.message);c.saving=false;button.disabled=false;}
 }
};
Object.assign(A,{'cover-crop-save':()=>CoverCrop.save(),'cover-crop-reset':()=>CoverCrop.reset(),'cover-crop-cancel':()=>{CoverCrop.cancel();UI.close();}});

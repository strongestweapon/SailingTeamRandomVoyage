const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const sharp=require('/Users/hojunsong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir='work/route-studio/dist/',tiny=fs.readFileSync('work/eox-test-z14.jpg'),dataURL='data:image/jpeg;base64,'+tiny.toString('base64');
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 // Tile loader runs without a browser. Fetch and canvas are instrumented, using a real decoded JPEG.
 const objectURLs=new Map();let sequence=0,requests=0,active=0,peak=0,mode='ok',lastDraws=[];
 const urls={createObjectURL(blob){const key='blob:'+sequence++;objectURLs.set(key,blob);return key;},revokeObjectURL(url){objectURLs.delete(url);}};
 class Image{async decode(){const b=objectURLs.get(this.src);const m=await sharp(Buffer.from(await b.arrayBuffer())).metadata();this.naturalWidth=m.width;this.naturalHeight=m.height;}}
 const ctx={window:null,AbortController,DOMException,URL:urls,Image,Blob,setTimeout,clearTimeout,console,
  document:{createElement(){const draws=[];lastDraws=draws;return {width:0,height:0,getContext(){return {fillRect(){},setTransform(...v){draws.push(['transform',...v]);},drawImage(...v){draws.push(['image',...v.slice(1)]);}};},toDataURL(){return dataURL;}};}},
  fetch:async(url,{signal})=>{
   requests++;active++;peak=Math.max(peak,active);
   try{await new Promise((resolve,reject)=>{const t=setTimeout(resolve,mode==='slow'?100:3);signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));},{once:true});});
    if(mode==='fail')return {ok:false,status:503};return {ok:true,blob:async()=>new Blob([tiny],{type:'image/jpeg'})};
   }finally{active--;}
  }};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(dir+'highres.js','utf8'),ctx);
 const hd=ctx.SatelliteHD,bounds=[124.12,24.32,124.17,24.36];
 const p=hd.plan(bounds,1024,768);assert.equal(p.z,14);assert(p.tiles.length<20);
 assert(hd.plan([65,0,180,65]).tiles.length<=320);
 const result=await hd.load(bounds,{width:1024,height:768});assert.equal(result.level,14);assert.equal(lastDraws.length,p.tiles.length+1);assert(peak<=4);
 const count=requests;await hd.load(bounds,{width:1024,height:768});assert.equal(requests,count,'Reuse tile cache');
 const abort=new AbortController();abort.abort();await assert.rejects(hd.load(bounds,{signal:abort.signal}),{name:'AbortError'});
 mode='fail';await assert.rejects(hd.load([130,30,130.02,30.02]),/503/);assert.equal(active,0,'Failed loads drain their workers');
 mode='slow';const controller=new AbortController(),pending=hd.load([135,35,135.02,35.02],{signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(active,0);
 assert.equal(objectURLs.size,0,'Release all temporary blob URLs');

 // Exercise actual app handlers and export snapshots, with deliberately delayed tile responses.
 const elements=new Map();class Element{
  constructor(){this.value='';this.dataset={};this.children=[];this.listeners={};this.classList={toggle(){},add(){},remove(){}};}
  addEventListener(k,v){this.listeners[k]=v;}append(...v){this.children.push(...v);}replaceChildren(){this.children=[];}
  closest(){return new Element();}querySelector(){return {dataset:{bounds:this.innerHTML.match(/data-bounds="([^"]+)"/)[1]},setAttribute(){},querySelectorAll(){return [];}};}
  getBoundingClientRect(){return {left:0,top:0,width:960,height:540};}setAttribute(k,v){this[k]=v;}focus(){}select(){}
 }
 for(const m of fs.readFileSync(dir+'index.html','utf8').matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new Element();e.type=m[1].match(/type="([^"]+)"/)?.[1]||'';elements.set(m[2],e);}
 const get=id=>{assert(elements.has(id),'Missing '+id);return elements.get(id);};
 let exportedSVG='',loads=[];
 class ExportImage{async decode(){this.svg=await objectURLs.get(this.src).text();}}
 const app={window:null,AbortController,DOMException,Image:ExportImage,Blob,URL:urls,navigator:{},console,setTimeout,clearTimeout,
  requestAnimationFrame(fn){fn();return 1;},cancelAnimationFrame(){},addEventListener(){},
  document:{getElementById:get,querySelector:()=>new Element(),querySelectorAll:()=>[],createTextNode:text=>({text}),body:new Element(),
   createElement(type){if(type!=='canvas')return new Element();return {getContext(){return {drawImage(img){exportedSVG=img.svg;}};},toBlob(fn){fn(new Blob(['png']));}};}},
  SatelliteHD:{load(bounds,options){return new Promise((resolve,reject)=>loads.push({bounds,options,resolve:raster=>resolve({bounds,url:dataURL,level:14,width:options.width||1920,...raster}),reject}));}}
 };
 app.window=app;vm.createContext(app);for(const f of ['data.js','backgrounds.js','renderer.js','app.js'])vm.runInContext(fs.readFileSync(dir+f,'utf8'),app,{filename:f});
 const studio=app.MapStudio,change=name=>{get('background').value=name;get('background').listeners.change();};
 const selection=JSON.stringify(studio.state.selectedIds),view=JSON.stringify(studio.state.view);
 change('satelliteHD');assert.equal(loads.length,1);assert.equal(JSON.stringify(studio.state.view),view);assert.equal(JSON.stringify(studio.state.selectedIds),selection);
 assert(!get('imagery-credit').hidden);assert(!get('map').innerHTML.includes('data-role="imagery-credit"'),'No false credit on temporary NASA image');
 const stale=loads[0];change('navionics');assert(stale.options.signal.aborted);stale.resolve();await settle();assert.equal(studio.state.background,'navionics');assert(!get('map').innerHTML.includes('data-role="imagery-credit"'));
 change('satelliteHD');loads.at(-1).resolve();await settle();assert(get('map').innerHTML.includes('data-role="imagery-credit"'));const readyCount=loads.length;
 studio.state.labelColor='#123456';studio.update();assert.equal(loads.length,readyCount,'Changing color must not redownload');
 const z0=studio.state.view.zoom;get('zoom-in').onclick();assert(studio.state.view.zoom>z0);studio.update();const panning=loads.at(-1);
 studio.state.view.zoom=256;studio.update();assert(get('zoom-in').disabled);panning.resolve();await settle();assert.equal(studio.state.view.zoom,256);assert(!get('map').innerHTML.includes('data-role="imagery-credit"'),'Discard a stale camera response');
 const current=loads.at(-1);current.reject(new Error('offline'));await settle();assert(!get('background-retry').hidden);assert(get('background-status').textContent.includes('저해상도'));
 get('background-retry').onclick();loads.at(-1).resolve();await settle();
 const before=studio.state.selectedIds[0],pendingPNG=studio.pngBlob(),exp=loads.at(-1);assert.equal(exp.options.width,3840);assert.equal(exp.options.height,2160);
 // Move and change selection while export waits. The saved frame must remain the captured one.
 studio.state.view.zoom=64;studio.state.selectedIds=[];studio.update();exp.resolve();await pendingPNG;
 assert(exportedSVG.includes('data-selected-count="1"'));assert(exportedSVG.includes('data-role="imagery-credit"'));
 assert.equal(exportedSVG.match(/data-viewport="([^"]+)"/)[1],exp.bounds.join(','));
 const failed=studio.pngBlob();loads.at(-1).reject(new Error('network unavailable'));await assert.rejects(failed,/network unavailable/);
 assert.equal(JSON.stringify(studio.state.selectedIds),'[]');assert.equal(studio.data.groups.flatMap(g=>g.tracks).length,81);
 change('navionics');studio.state.selectedIds=[before];studio.resetView();studio.update();assert.equal(get('zoom-level').textContent,'100%');
 // Verify high-res image and GPX registration independently, and fixed labels at maximum zoom.
 const r=app.RouteRenderer,data=studio.data,sample=JSON.parse(fs.readFileSync('work/highres-qa/sample.json'));
 const options={...sample.opt,hdRaster:{bounds:sample.plan.bounds,url:dataURL}};
 const svg=r.render(data,options),im=svg.match(/<image data-role="raster-background"[^>]+>/)[0];
 const attr=(tag,name)=>Number(tag.match(new RegExp('\\b'+name+'="([^"]+)"'))[1]);
 assert(Math.abs(attr(im,'x'))<.1);assert(Math.abs(attr(im,'y'))<.1);assert.equal(attr(im,'width'),3840);assert.equal(attr(im,'height'),2160);
 const lon=124.1456386,lat=24.3387884,marker=[...svg.matchAll(/<circle[^>]*data-role="endpoint-marker"[^>]+>/g)].map(m=>m[0]).find(m=>attr(m,'data-lon')===lon);
 assert(marker);assert(Math.abs(attr(marker,'cx')-1920)<.1);assert(Math.abs(attr(marker,'cy')-1080)<.1);
 const fonts=s=>[...s.matchAll(/data-role="endpoint-label"[\s\S]*?font-size="([^"]+)"/g)].map(m=>m[1]);
 const f0=fonts(r.render(data,{...options,view:{zoom:1,panX:0,panY:0}}));assert(fonts(svg).every(f=>f0.includes(f)));
 console.log('PASS: tile plan/cap; CORS loader 4-worker bound, cache, failure/abort cleanup; background switching; stale camera rejection; retry; immutable 4K export snapshot; reject incomplete export; 256x zoom; fixed fonts; geographic registration; original 81 tracks.');
})().catch(e=>{console.error(e);process.exitCode=1;});

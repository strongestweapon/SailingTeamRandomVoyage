const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const sharp=require('sharp');
const dir='work/route-studio/dist/';
fs.mkdirSync('work/map-backgrounds',{recursive:true});
const c={window:{}};vm.createContext(c);
for(const f of ['data.js','backgrounds.js','renderer.js'])vm.runInContext(fs.readFileSync(dir+f,'utf8'),c);
const {RouteRenderer:r,ROUTE_DATA:data}=c.window;
const allTrackCount=data.groups.reduce((count,group)=>count+group.tracks.length,0);
const naha=data.groups.flatMap(g=>g.tracks).find(t=>t.name==='Naha - Jeju');
const base={selectedIds:[naha.id]};
const path=(svg,role)=>svg.match(new RegExp('<path data-role="'+role+'"[^>]* d="([^"]*)"'))?.[1];
const attr=(tag,name)=>Number(tag.match(new RegExp('\\b'+name+'="([^"]+)"'))[1]);
const font=svg=>svg.match(/data-name="Naha"[\s\S]*?font-size="([^"]+)"/)[1];
const imageTag=svg=>svg.match(/<image data-role="raster-background"[^>]+>/)[0];
const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const original=r.render(data,base);
for(const background of ['navionics','satellite','relief']){
 const first=r.render(data,{...base,background,...r.backgroundLooks[background]});
 for(const role of ['all-other-routes','selected-route'])assert.equal(path(first,role),path(original,role));
 assert.equal(font(first),font(original));
 if(background==='navionics')continue;
 assert(!first.includes('<g data-role="land"'),'Opaque raster must not be covered by vector land');
 for(const view of [{zoom:1,panX:0,panY:0},{zoom:2,panX:170,panY:-90},{zoom:8,panX:800,panY:-2200}]){
  const svg=r.render(data,{...base,background,view}),image=imageTag(svg);
  const x=attr(image,'x'),y=attr(image,'y'),w=attr(image,'width'),h=attr(image,'height');
  // Derive endpoint positions independently from the raster's geographic extent.
  const markers=[...svg.matchAll(/<circle[^>]*data-role="endpoint-marker"[^>]+>/g)].map(m=>m[0]);
  for(const marker of markers){
   const expectedX=x+(attr(marker,'data-lon')-65)/115*w;
   const expectedY=y+(merc(65)-merc(attr(marker,'data-lat')))/merc(65)*h;
   assert(Math.abs(attr(marker,'cx')-expectedX)<.2);
   assert(Math.abs(attr(marker,'cy')-expectedY)<.2);
  }
  const baselineImage=imageTag(first);
  assert(Math.abs(w-attr(baselineImage,'width')*view.zoom)<1);
  const vector=r.render(data,{...base,view});
  for(const role of ['all-other-routes','selected-route'])assert.equal(path(svg,role),path(vector,role));
 }
 const focus=r.render(data,{...base,background,mode:'focus'});
 assert.equal(font(focus),font(first));
 fs.writeFileSync('work/map-backgrounds/'+background+'-focus.svg',focus);
}

// Execute the complete app with a DOM stub, exercising actual control handlers.
const elements=new Map();
class Element{
 constructor(){this.value='';this.dataset={};this.children=[];this.listeners={};this.classList={toggle(){},add(){},remove(){}};}
 addEventListener(k,v){this.listeners[k]=v;} append(...v){this.children.push(...v);} replaceChildren(){this.children=[];}
 closest(){return new Element();} querySelector(){return {dataset:{bounds:'-931,-1168,4055,2573'}};}
 setAttribute(k,v){this[k]=v;} focus(){} select(){this.selected=true;}
}
const get=id=>{assert(elements.has(id),'Missing control '+id);return elements.get(id);};
for(const m of fs.readFileSync(dir+'index.html','utf8').matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
 const el=new Element();el.type=m[1].match(/type="([^"]+)"/)?.[1]||'';el.value=m[1].match(/value="([^"]+)"/)?.[1]||'';elements.set(m[2],el);
}
let lastBlob;
const app={window:null,document:{getElementById:get,querySelector:()=>new Element(),querySelectorAll:()=>[],createElement:()=>new Element(),createTextNode:text=>({text}),body:new Element()},navigator:{},clearTimeout,setTimeout,cancelAnimationFrame(){},requestAnimationFrame(){return 1;},addEventListener(){},console};
app.window=app;vm.createContext(app);
for(const f of ['data.js','backgrounds.js','renderer.js','app.js'])vm.runInContext(fs.readFileSync(dir+f,'utf8'),app,{filename:f});
const studio=app.MapStudio,change=view=>{get('background').value=view;get('background').listeners.change();};
studio.state.view={zoom:2,panX:120,panY:-80};studio.state.accent='#123456';studio.state.labelColorAuto=false;studio.state.labelColor='#abcdef';studio.update();
const camera=JSON.stringify(studio.state.view),selection=JSON.stringify(studio.state.selectedIds);
change('satellite');assert.equal(studio.state.accent,'#ffb900');assert(get('landColor').disabled&&get('seaColor').disabled&&get('palette').disabled);
assert.equal(get('labelColor').value,'#f7f5e9');assert.equal(JSON.stringify(studio.state.view),camera);assert.equal(JSON.stringify(studio.state.selectedIds),selection);
studio.state.accent='#dd00aa';studio.update();change('relief');assert.equal(studio.state.accent,'#b42574');change('satellite');assert.equal(studio.state.accent,'#dd00aa');
change('navionics');assert.equal(studio.state.accent,'#123456');assert.equal(studio.state.labelColor,'#abcdef');assert.equal(studio.state.labelColorAuto,false);assert(!get('landColor').disabled&&!get('palette').disabled);
studio.state.style='trace';studio.update();assert.equal(get('background').value,'');change('satellite');assert.equal(studio.state.style,'expedition');
studio.state.transparentSea=true;studio.update();assert(!get('landOpacity').disabled);assert(!get('map').innerHTML.includes('<rect data-role="sea"'));
get('select-all').onclick();assert.equal(studio.state.selectedIds.length,allTrackCount);assert.equal(get('all-destination-coordinates').value.split('\n').length,allTrackCount+1);assert(get('all-destination-coordinates').value.includes('° N'));
get('reset').onclick();assert.equal(studio.state.background,'navionics');assert.equal(get('background').value,'navionics');

(async()=>{
 for(const background of ['satellite','relief']){
  for(const landOpacity of [0,20,100]){
   const svg=r.render(data,{...base,background,...r.backgroundLooks[background],transparentSea:true,landOpacity});
   assert(svg.includes('clip-path="url(#raster-land-clip)"'));
   const png=await sharp(Buffer.from(svg)).png().toBuffer(),meta=await sharp(png).metadata();
   assert.equal(meta.width,3840);assert.equal(meta.height,2160);assert(meta.hasAlpha);
   const pixel=async(x,y)=>(await sharp(png).extract({left:x,top:y,width:1,height:1}).raw().toBuffer())[3];
   assert.equal(await pixel(3800,2100),0,'Ocean must remain transparent');
   assert.equal(await pixel(100,100),Math.round(landOpacity*255/100),'Raster land alpha');
   assert.equal(path(svg,'selected-route'),path(original,'selected-route'));
   if(landOpacity===20)await sharp(png).flatten({background:'#17232c'}).resize(1440).jpeg({quality:92}).toFile('work/map-backgrounds/'+background+'-transparent-preview.jpg');
  }
  const png=await sharp(Buffer.from(fs.readFileSync('work/map-backgrounds/'+background+'-focus.svg'))).png().toBuffer();
  await sharp(png).resize(1440).jpeg({quality:92}).toFile('work/map-backgrounds/'+background+'-focus-preview.jpg');
 }
 console.log('PASS: all three views; complete app control handlers; preserved camera/selection and per-view colors; geographic raster/GPX registration at 1x/2x/8x and focus; fixed label size; 4K output; transparent sea and land alpha 0/20/100; '+allTrackCount+'-route coordinates retained; reset.');
})().catch(e=>{console.error(e);process.exit(1)});

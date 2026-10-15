/* Deterministic SVG renderer shared by preview and 4K PNG export. */
(function(root){
'use strict';
const W=3840,H=2160,rad=Math.PI/180,MAX_ZOOM=256;
const palettes={
 sailing:{theme:'light',landColor:'#d5dbd6',seaColor:'#378bb4',routeColor:'#193f54',accent:'#edbd54'},
 overlay:{theme:'dark',landColor:'#e6e5df',seaColor:'#17295b',routeColor:'#c9d0cf',accent:'#ff775f'},
 film:{theme:'light',landColor:'#d8ddd2',seaColor:'#8fa6b1',routeColor:'#315566',accent:'#b4336a'},
 // Median colors sampled from the user's Navionics reference: land, open water, magenta route.
 navionics:{theme:'light',landColor:'#f4dc56',seaColor:'#b9e5fe',routeColor:'#1d61a5',accent:'#d12fd4'},
 radar:{theme:'dark',landColor:'#41535c',seaColor:'#17295b',routeColor:'#24edb1',accent:'#ff537a'},
 cobalt:{theme:'light',landColor:'#b4dbec',seaColor:'#174ce0',routeColor:'#f4fcff',accent:'#ffbb35'},
 violet:{theme:'dark',landColor:'#6f5ba7',seaColor:'#241a4d',routeColor:'#38e7ed',accent:'#ffe054'},
 atlas:{theme:'light',landColor:'#e7e4d5',seaColor:'#b8ced3',routeColor:'#315e67',accent:'#d64e32'}
};
const backgroundLooks={
 satelliteHD:{routeColor:'#d4dfdf',accent:'#ffb900',labelColor:'#f7f5e9',labelColorAuto:true},
 satellite:{routeColor:'#d4dfdf',accent:'#ffb900',labelColor:'#f7f5e9',labelColorAuto:true},
 relief:{routeColor:'#2b5873',accent:'#b42574',labelColor:'#243b43',labelColorAuto:true}
};
const rasterColors={
 satelliteHD:{sea:'#082d48',ink:'#f7f5e9',halo:'#203541',coast:'#adc6c9'},
 satellite:{sea:'#082d48',ink:'#f7f5e9',halo:'#203541',coast:'#adc6c9'},
 relief:{sea:'#96bed2',ink:'#243b43',halo:'#f5f7f6',coast:'#446471'}
};
const brightness=hex=>{const n=parseInt(hex.slice(1),16);return .2126*(n>>16)+.7152*((n>>8)&255)+.0722*(n&255);};
const blend=(a,b,t)=>'#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(i+1,i+3),16)*(1-t)+parseInt(b.slice(i+1,i+3),16)*t).toString(16).padStart(2,'0')).join('');

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const merc=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*rad/2))/rad;
const distance=t=>t.segments.reduce((sum,s)=>sum+s.reduce((v,p,i)=>{if(!i)return v;let a=s[i-1],dlat=(p[1]-a[1])*rad,dlon=(p[0]-a[0])*rad,q=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(p[1]*rad)*Math.sin(dlon/2)**2;return v+6371.0088*2*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));},0),0);
// Port anchors come from the supplied GPX endpoints. Markers always use the selected track's actual coordinates.
const ports=[
 {id:'hong-kong',name:'Hong Kong',point:[114.1835,22.2835],priority:0},
 {id:'subic',name:'Subic Bay',point:[120.2893,14.8227],priority:0},
 {id:'naha',name:'Naha',point:[127.6670,26.2127],priority:1},
 {id:'jeju',name:'Jeju',point:[126.4654,33.5102],priority:1},
 {id:'ishigaki',name:'Ishigaki',point:[124.1592,24.3334],priority:1},
 {id:'sanya',name:'Sanya',point:[109.4776,18.2174],priority:1},
 {id:'ara',name:'Ara Marina',point:[126.7910,37.5986],priority:1},
 {id:'anping',name:'Anping',point:[120.1628,22.9820],priority:2},
 {id:'tamsui',name:'Tamsui',point:[121.4080,25.1843],priority:2},
 {id:'badouzi',name:'Badouzi Fishery Harbor',point:[121.7853,25.1465],priority:2},
 {id:'miyakojima',name:'Miyakojima',point:[125.2801,24.8138],priority:2},
 {id:'yonabaru',name:'Yonabaru Marina',point:[127.7665,26.2061],priority:3},
 {id:'ginowan',name:'Ginowan',point:[127.7287,26.2785],priority:3},
 {id:'zamami',name:'Zamami',point:[127.3022,26.2261],priority:3},
 {id:'gimnyeong',name:'Gimnyeong, Jeju',point:[126.7373,33.5592],priority:3}
];
const kmBetween=(a,b)=>distance({segments:[[a,b]]});
function nearestPort(p){
 let best=null,km=15;
 for(const port of ports){const d=kmBetween(p,port.point);if(d<km){best=port;km=d;}}
 return best;
}
function endpoints(track,overrides={}){
 const segments=track.segments.filter(s=>s.length),first=segments[0][0],last=segments.at(-1).at(-1);
 const names=track.name.split(/\s+[-–—]\s+|\s*→\s*/),pair=names.length===2?names:[];
 return [first,last].map((p,i)=>{
  const port=nearestPort(p),role=i?'end':'start';
  const custom=typeof overrides[role]==='string'?overrides[role].trim().slice(0,70):'';
  return {point:p,port:port?.id||null,role,name:custom||pair[i]?.trim()||port?.name||(i?'Arrival':'Departure')};
 });
}
const intersects=(a,b,gap=10)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
function selection(data,opt={}){
 const all=data.groups.flatMap(g=>g.tracks),byId=new Map(all.map(t=>[t.id,t]));
 const ids=Array.isArray(opt.selectedIds)?opt.selectedIds:opt.selected===null?[]:opt.selected?[opt.selected]:[all.find(t=>t.name==='Naha - Jeju')?.id||all[0]?.id];
 return [...new Set(ids)].map(id=>byId.get(id)).filter(Boolean);
}
function toggleSelection(ids,id){return ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];}
function render(data,opt={}){
 const options={mode:'all',history:true,opacity:100,...palettes.navionics,palette:'navionics',background:'navionics',grid:false,labels:true,title:false,style:'expedition',lineWidth:7,coastOpacity:14,labelFont:'arial',labelStyle:'plain',labelScale:100,labelColor:'#f1f5f7',labelColorAuto:true,endpointEmphasis:false,transparentSea:false,landOpacity:20,...opt};
 const customLabelColor=!options.labelColorAuto&&/^#[0-9a-f]{6}$/i.test(options.labelColor)?options.labelColor:null;
 const customLabelHalo=customLabelColor?(brightness(customLabelColor)>145?'#203541':'#f5f7f6'):null;
 const labelFonts={georgia:'Georgia, serif',arial:'Arial, Helvetica, sans-serif',helvetica:'Helvetica, Arial, sans-serif',times:"'Times New Roman', Times, serif",courier:"'Courier New', Courier, monospace"};
 const labelFont=esc(labelFonts[options.labelFont]||labelFonts.georgia);
 // 100% uses the former 150% label size.
 const labelScale=1.5*Math.max(.5,Math.min(2.5,(Number(options.labelScale)||100)/100));
 const countryLabelSize=34*labelScale;
 const plainLabels=options.labelStyle==='plain';
 const countryName=name=>plainLabels?name[0]+name.slice(1).toLowerCase():name;
 const groups=data.groups;const tracks=groups.flatMap(g=>g.tracks.map(t=>({...t,history:g.history})));
 if(!tracks.length)throw new Error('표시할 트랙이 없습니다.');
 const selectedTracks=selection(data,options),selectedIds=new Set(selectedTracks.map(t=>t.id));
 const selected=selectedTracks[0]||tracks[0]; // Reference only for the legacy scale bar; an empty selection stays empty.
 const selectedTitle=selectedTracks.length===1?selected.name:selectedTracks.length?`${selectedTracks.length} passages`:'Voyage overview';
 const visible=tracks.filter(t=>options.history||!t.history||selectedIds.has(t.id));
 let fit=options.mode==='focus'&&selectedTracks.length?selectedTracks:options.mode==='current'?visible.filter(t=>!t.history||selectedIds.has(t.id)):visible;
 if(!fit.length)fit=visible.length?visible:tracks;
 let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
 fit.forEach(t=>t.segments.forEach(s=>s.forEach(p=>{minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,merc(p[1]));maxy=Math.max(maxy,merc(p[1]));})));
 let dx=Math.max(maxx-minx,options.mode==='focus'?1.5:3),dy=Math.max(maxy-miny,options.mode==='focus'?1.5:3);
 const isExpedition=options.style==='expedition';
 const isOverlay=options.style==='coast'||options.style==='trace';
 const box=isExpedition?{x:440,y:110,w:2960,h:1940}:(isOverlay?{x:560,y:200,w:2720,h:1760}:(options.mode==='focus'?{x:1070,y:300,w:2450,h:1570}:{x:1000,y:240,w:2570,h:1680}));
 let scale=Math.min(box.w/(dx*1.14),box.h/(dy*1.14));
 let cx=(minx+maxx)/2,cy=(miny+maxy)/2;
 const basePoint=p=>[box.x+box.w/2+(p[0]-cx)*scale,box.y+box.h/2-(merc(p[1])-cy)*scale];
 const camera={zoom:Math.max(1,Math.min(MAX_ZOOM,Number(options.view?.zoom)||1)),panX:Number(options.view?.panX)||0,panY:Number(options.view?.panY)||0};
 const point=p=>{const[x,y]=basePoint(p);return[W/2+(x-W/2)*camera.zoom+camera.panX,H/2+(y-H/2)*camera.zoom+camera.panY];};
 // The bundled coastline extends from 65–180°E and 0–65°N.
 const upperLeft=basePoint([65,65]),lowerRight=basePoint([180,0]);
 const mapLayer=`<g data-map-layer="true" data-bounds="${[...upperLeft,...lowerRight].join(',')}">`;
 const inversePoint=([x,y])=>{
  const bx=W/2+(x-W/2-camera.panX)/camera.zoom,by=H/2+(y-H/2-camera.panY)/camera.zoom;
  return [cx+(bx-box.x-box.w/2)/scale,Math.atan(Math.sinh((cy-(by-box.y-box.h/2)/scale)*rad))/rad];
 };
 const viewport=[...inversePoint([0,H]),...inversePoint([W,0])];

 const num=x=>x.toFixed(1);
 const fixedAttrs=(x,y)=>`data-fixed-size="true" data-anchor-x="${num(x)}" data-anchor-y="${num(y)}"`;
 const fixed=(x,y,markup)=>`<g ${fixedAttrs(x,y)}>${markup}</g>`;
 function path(points,close=false){return points.map((p,i)=>{const[x,y]=point(p);return(i?'L':'M')+num(x)+','+num(y)}).join('')+(close?'Z':'');}
 function placeLabels({ink,halo,accent,context=true}){
  if(!options.labels)return {markup:'',boxes:[]};
  if(customLabelColor){ink=customLabelColor;halo=customLabelHalo;}
  const out=[],boxes=[],ends=selectedTracks.flatMap(t=>endpoints(t,options.endpointNames?.[t.id]).map(e=>({...e,trackId:t.id})));
  const projected=ends.map(e=>({...e,xy:point(e.point)}));
  const onScreen=([x,y])=>x>=24&&x<=W-24&&y>=24&&y<=H-24;
  const textWidth=(name,size)=>Array.from(name).reduce((n,c)=>n+(/[\u3000-\uffff]/.test(c)?1.05:/[MW@]/.test(c)?.92:/[il.,' ]/.test(c)?.35:.65)*size,0);
  const wrap=(name,size)=>{
   const lines=[];let line='';
   const words=[];
   for(const word of name.split(/\s+/)){let part='';for(const char of word){if(part&&textWidth(part+char,size)>950){words.push(part);part='';}part+=char;}if(part)words.push(part);}
   for(const word of words){const next=line?line+' '+word:word;if(line&&textWidth(next,size)>950){lines.push(line);line=word;}else line=next;}
   if(line)lines.push(line);return lines.length?lines:[''];
  };
  const markerPad=options.endpointEmphasis?22:12;
  const markerBoxes=projected.filter(e=>onScreen(e.xy)).map(e=>({x:e.xy[0]-markerPad,y:e.xy[1]-markerPad,w:markerPad*2,h:markerPad*2}));
  // Index the visible route geometry in screen space so label placement also
  // avoids track lines. Subpixel simplification affects only this collision index.
  const cell=128,cols=Math.ceil(W/cell),rows=Math.ceil(H/cell),routeCells=new Map();
  const routeGap=9+(isExpedition?Math.max(1,Math.min(20,Number(options.lineWidth)||7)):isOverlay?Math.max(5,Number(options.lineWidth)||5):23)/2;
  const cellRange=b=>[Math.max(0,Math.floor(b.x/cell)),Math.min(cols-1,Math.floor((b.x+b.w)/cell)),Math.max(0,Math.floor(b.y/cell)),Math.min(rows-1,Math.floor((b.y+b.h)/cell))];
  function indexEdge(a,b){
   const left=Math.min(a[0],b[0]),top=Math.min(a[1],b[1]),right=Math.max(a[0],b[0]),bottom=Math.max(a[1],b[1]);
   if(right<0||left>W||bottom<0||top>H)return;
   const edge=[...a,...b],range=cellRange({x:left,y:top,w:right-left,h:bottom-top});
   for(let yy=range[2];yy<=range[3];yy++)for(let xx=range[0];xx<=range[1];xx++){
    const key=yy*cols+xx;if(!routeCells.has(key))routeCells.set(key,[]);routeCells.get(key).push(edge);
   }
  }
  for(const track of visible)for(const segment of track.segments){
   if(!segment.length)continue;
   let previous=point(segment[0]);
   for(let i=1;i<segment.length;i++){
    const next=point(segment[i]);if(i<segment.length-1&&Math.hypot(next[0]-previous[0],next[1]-previous[1])<.75)continue;
    indexEdge(previous,next);previous=next;
   }
  }
  function routeOverlap(box){
   const b={x:box.x-routeGap,y:box.y-routeGap,w:box.w+routeGap*2,h:box.h+routeGap*2},range=cellRange(b),seen=new Set();
   let length=0;
   for(let yy=range[2];yy<=range[3];yy++)for(let xx=range[0];xx<=range[1];xx++)for(const edge of routeCells.get(yy*cols+xx)||[]){
    if(seen.has(edge))continue;seen.add(edge);
    const [x0,y0,x1,y1]=edge,dx=x1-x0,dy=y1-y0;
    let enter=0,leave=1;
    for(const [start,delta,min,max]of [[x0,dx,b.x,b.x+b.w],[y0,dy,b.y,b.y+b.h]]){
     if(Math.abs(delta)<1e-9){if(start<min||start>max){leave=-1;break;}continue;}
     const a=(min-start)/delta,z=(max-start)/delta;
     enter=Math.max(enter,Math.min(a,z));leave=Math.min(leave,Math.max(a,z));
     if(leave<enter)break;
    }
    if(leave>=enter)length+=Math.max(.01,(leave-enter)*Math.hypot(dx,dy));
   }
   return length;
  }
  function label(e,selectedLabel,detail=''){
   const [x,y]=e.xy;if(!onScreen(e.xy))return;
   const emphasized=selectedLabel&&options.endpointEmphasis;
   const size=(emphasized?44:31)*labelScale,lines=wrap(e.name,size),detailSize=18*labelScale;
   const w=Math.max(...lines.map(s=>textWidth(s,size)),detail?textWidth(detail,detailSize):0)+16;
   const h=lines.length*size*1.15+(detail?detailSize*1.65:0)+10,offset=emphasized?42:25;
   const right=x+offset,left=x-offset-w;
   const candidates=[{x:right,y:y-h-18},{x:left,y:y-h-18},{x:right,y:y+22},{x:left,y:y+22},{x:x-w/2,y:y-h-offset},{x:x-w/2,y:y+offset},{x:left,y:y-h/2},{x:right,y:y-h/2}];
   // Nearby endpoints get opposite sides and leader lines, including whole-map views of short passages.
   if(selectedLabel&&e.role==='start')candidates.unshift({x:left,y:y+22});
   let chosen=null,best=Infinity,chosenHits=Infinity,chosenInk=Infinity;
   function consider(c,order){
    const b={x:Math.max(30,Math.min(W-w-30,c.x)),y:Math.max(30,Math.min(H-h-30,c.y)),w,h};
    const overlap=boxes.filter(a=>intersects(a,b,22)).length+markerBoxes.filter(a=>intersects(a,b,10)).length;
    const ink=routeOverlap(b),distance=Math.hypot(x-Math.max(b.x,Math.min(b.x+w,x)),y-Math.max(b.y,Math.min(b.y+h,y)));
    const score=overlap*1e9+(ink>0?1e6+Math.min(ink,1e4)*10:0)+distance+Math.hypot(b.x-c.x,b.y-c.y)+order*.1;
    if(score<best){best=score;chosen=b;chosenHits=overlap;chosenInk=ink;}
   }
   candidates.forEach(consider);
   // Dense harbors may have tracks on every side. Widen the search while
   // preserving the exact marker position and the user's font size.
   for(const gap of [70,130,210,320,480,700]){
    if(chosenHits===0&&chosenInk===0)break;
    for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
     if(!dx&&!dy)continue;
     consider({x:dx<0?x-gap-w:dx>0?x+gap:x-w/2,y:dy<0?y-gap-h:dy>0?y+gap:y-h/2},candidates.length);
    }
   }
   if(!selectedLabel&&chosenHits>0)return;
   boxes.push(chosen);
   const lx=Math.max(chosen.x,Math.min(chosen.x+w,x)),ly=Math.max(chosen.y,Math.min(chosen.y+h,y));
   const leaderLength=Math.hypot(lx-x,ly-y),leaderScale=leaderLength?Math.max(0,(leaderLength-8)/leaderLength):0;
   out.push(`<g data-role="${selectedLabel?'endpoint-label':'port-label'}" ${fixedAttrs(x,y)} data-endpoint="${esc(e.role||'')}" data-name="${esc(e.name)}" data-track-ids="${esc(e.trackIds?.join('|')||'')}" data-box="${[chosen.x,chosen.y,w,h].map(num).join(',')}">`);
   if(emphasized||leaderLength>45)out.push(`<path data-role="label-leader" d="M${num(x)},${num(y)}L${num(x+(lx-x)*leaderScale)},${num(y+(ly-y)*leaderScale)}" fill="none" stroke="${ink}" stroke-width="${emphasized?2:1.4}" opacity=".55"/>`);
   for(const [i,line]of lines.entries())out.push(`<text x="${num(chosen.x+8)}" y="${num(chosen.y+size*(i*1.15+.9))}" font-family="${labelFont}" font-size="${size}" font-weight="${emphasized?600:400}" fill="${ink}" paint-order="stroke" stroke="${halo}" stroke-width="${plainLabels?2:emphasized?9:7}" stroke-linejoin="round">${esc(line)}</text>`);
   if(detail)out.push(`<text x="${num(chosen.x+8)}" y="${num(chosen.y+lines.length*size*1.15+detailSize*.95)}" font-family="${labelFont}" font-size="${detailSize}" letter-spacing="${2*labelScale}" fill="${ink}" paint-order="stroke" stroke="${halo}" stroke-width="${plainLabels?2:6}" stroke-linejoin="round">${detail}</text>`);
   out.push('</g>');
  }
  const grouped=[];
  for(const e of projected){
   const group=grouped.find(g=>g.name===e.name&&Math.hypot(g.xy[0]-e.xy[0],g.xy[1]-e.xy[1])<100&&((g.port&&g.port===e.port)||kmBetween(g.point,e.point)<3));
   if(group){group.roles.add(e.role);group.trackIds.push(e.trackId);}
   else grouped.push({...e,roles:new Set([e.role]),trackIds:[e.trackId]});
  }
  for(const e of grouped){const both=e.roles.size>1;label({...e,role:both?'both':e.role},true,options.endpointEmphasis?(both?'START / FINISH':e.role==='start'?'START':'FINISH'):'');}
  if(context){
   const visited=new Set(visible.flatMap(t=>endpoints(t).map(e=>e.port)).filter(Boolean));
   const anchors=projected.map(e=>e.xy);
   for(const port of [...ports].sort((a,b)=>a.priority-b.priority)){
    if(!visited.has(port.id)||ends.some(e=>e.port===port.id))continue;
    const xy=point(port.point);if(anchors.some(p=>Math.hypot(xy[0]-p[0],xy[1]-p[1])<90))continue;
    const count=boxes.length;label({...port,xy},false);
    if(boxes.length>count){anchors.push(xy);out.push(`<circle ${fixedAttrs(...xy)} data-role="port-marker" cx="${num(xy[0])}" cy="${num(xy[1])}" r="5" fill="${ink}" stroke="${halo}" stroke-width="2"/>`);}
   }
  }
  // Keep the exact endpoints above every route and label leader line.
  for(const e of projected){if(!onScreen(e.xy))continue;out.push(`<circle ${fixedAttrs(...e.xy)} data-role="endpoint-marker" data-endpoint="${e.role}" data-lon="${e.point[0]}" data-lat="${e.point[1]}" data-track-id="${esc(e.trackId)}" cx="${num(e.xy[0])}" cy="${num(e.xy[1])}" r="${options.endpointEmphasis?12:5}" fill="${options.endpointEmphasis?(e.role==='start'?halo:accent):ink}" stroke="${options.endpointEmphasis?ink:halo}" stroke-width="${options.endpointEmphasis?3:2}"/>`);}
  return {markup:`<g id="voyage-places">${out.join('')}</g>`,boxes};
 }
 if(isExpedition){
  const highres=options.background==='satelliteHD';
  const rasterStyle=rasterColors[options.background],raster=highres?(options.hdRaster||root.ROUTE_BACKGROUNDS?.satellite):rasterStyle?root.ROUTE_BACKGROUNDS?.[options.background]:null;
  if(rasterStyle&&!raster)throw new Error('지도 배경 자료를 불러오지 못했습니다. 도구 파일을 다시 여세요.');
  const transparent=Boolean(options.transparentSea);
  const landAlpha=transparent?Math.max(0,Math.min(1,Number(options.landOpacity)/100)):1;
  const dark=options.theme==='dark';
  const colors=dark?{sea:'#254450',land:'#89998b',coast:'#596e67',label:'#233d39',marine:'#b0c4c2',grid:'#9db2b6'}:{sea:'#b8ced3',land:'#e7e4d5',coast:'#8b9f99',label:'#60766e',marine:'#718f97',grid:'#f7f5e8'};
  if(/^#[0-9a-f]{6}$/i.test(options.landColor))colors.land=options.landColor;
  if(/^#[0-9a-f]{6}$/i.test(options.seaColor))colors.sea=options.seaColor;
  colors.label=brightness(colors.land)>145?'#334b56':'#e0ebf0';
  colors.marine=brightness(colors.sea)>145?'#4a6876':'#b7c9ed';
  colors.coast=blend(colors.land,brightness(colors.land)>145?'#183e54':'#c8efff',.32);
  colors.grid=brightness(colors.sea)>145?'#38586b':'#b8d5ff';
  if(options.palette==='navionics'){colors.coast='#575447';colors.label='#242424';colors.marine='#384e60';}
  if(raster){colors.sea=rasterStyle.sea;colors.coast=rasterStyle.coast;colors.grid=rasterStyle.ink;}
  if(customLabelColor){colors.label=customLabelColor;colors.marine=customLabelColor;}
  const stroke=/^#[0-9a-f]{6}$/i.test(options.routeColor)?options.routeColor:'#315e67';
  const accent=/^#[0-9a-f]{6}$/i.test(options.accent)?options.accent:'#d64e32';
  const placeInk=transparent?stroke:raster?rasterStyle.ink:(brightness(colors.sea)>110?'#20343d':plainLabels?'#b7c0b7':'#f1f5f7');
  const placeHalo=transparent?(brightness(placeInk)>145?'#203541':'#f5f7f6'):raster?rasterStyle.halo:colors.sea;
  if(!customLabelColor){
   if(transparent){colors.label=placeInk;colors.marine=placeInk;}
   else if(raster){colors.label=placeInk;colors.marine=placeInk;}
   else if(plainLabels){colors.label=brightness(colors.land)>145?'#20343d':'#b7c0b7';colors.marine=placeInk;}
  }
  const labelOutline=customLabelColor||transparent||raster?`paint-order="stroke" stroke="${customLabelColor?customLabelHalo:placeHalo}" stroke-width="${plainLabels?2:4}" stroke-linejoin="round"`:'';
  const width=Math.max(1,Math.min(20,Number(options.lineWidth)||7));
  const opacity=Math.max(0,Math.min(1,Number(options.opacity)/100));
  const places=placeLabels({ink:placeInk,halo:placeHalo,accent});
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-background="${raster?options.background:'navionics'}" data-viewport="${viewport.join(',')}" role="img" aria-label="${selectedTracks.length?esc(selectedTitle)+' 강조 지도':'전체 항적 지도 · 선택 없음'}">`];
  if(!transparent)out.push(`<rect data-role="sea" width="${W}" height="${H}" fill="${colors.sea}"/>`);
  out.push(mapLayer);
  if(raster){
   const [west,south,east,north]=raster.bounds,[x,y]=point([west,north]),[right,bottom]=point([east,south]);
   if(transparent){
    out.push('<defs><clipPath id="raster-land-clip" clipPathUnits="userSpaceOnUse">');
    for(const poly of data.land)out.push(`<path clip-rule="evenodd" d="${poly.map(r=>path(r,true)).join('')}"/>`);
    out.push('</clipPath></defs>');
   }
   out.push(`<image data-role="raster-background" x="${num(x)}" y="${num(y)}" width="${num(right-x)}" height="${num(bottom-y)}" preserveAspectRatio="none" href="${raster.url}"${transparent?` clip-path="url(#raster-land-clip)" opacity="${landAlpha}"`:''}/>`);
  }
  if(options.grid){
   out.push('<g data-role="grid">');
  for(let lon=65;lon<=180;lon+=5){let x=point([lon,30])[0];out.push(`<path d="M${num(x)},0V${H}" stroke="${colors.grid}" stroke-width="1" opacity=".3"/>`);}
  for(let lat=0;lat<=65;lat+=5){let y=point([120,lat])[1];out.push(`<path d="M0,${num(y)}H${W}" stroke="${colors.grid}" stroke-width="1" opacity=".3"/>`);}
   out.push('</g>');
  }
  if(!raster||transparent){
   out.push(`<g data-role="land" fill="${raster?'none':colors.land}" fill-opacity="${landAlpha}" stroke="${transparent&&!raster?colors.land:colors.coast}" stroke-opacity="${transparent?.55:1}" stroke-width="1.4" fill-rule="evenodd" stroke-linejoin="round">`);
   for(const poly of data.land)out.push(`<path d="${poly.map(r=>path(r,true)).join('')}"/>`);
   out.push('</g>');
  }
  if(options.labels){
   const labels=[['CHINA',108.6,35.8,0],['KOREA',126,40.1,0],['JAPAN',138.8,37.1,-25],['TAIWAN',122.8,23.6,0],['PHILIPPINES',125,12.8,0],['VIETNAM',105.3,19.5,0],['RUSSIA',140,50.6,0]];
   for(const[label,lon,lat,angle]of labels){const[x,y]=point([lon,lat]),name=countryName(label),w=name.length*(countryLabelSize*.7+(plainLabels?0:5*labelScale));if(x>120&&x<W-220&&y>100&&y<H-130&&!places.boxes.some(b=>intersects(b,{x:x-w/2,y:y-countryLabelSize,w,h:countryLabelSize*1.3})))out.push(fixed(x,y,`<text x="${num(x)}" y="${num(y)}" transform="rotate(${plainLabels?0:angle} ${num(x)} ${num(y)})" text-anchor="middle" fill="${colors.label}" ${labelOutline} font-family="${labelFont}" font-size="${countryLabelSize}" letter-spacing="${plainLabels?0:5*labelScale}">${name}</text>`));}
   for(const[label,lon,lat]of [['Pacific Ocean',150,31],['East China Sea',122.4,29.4],['South China Sea',111.8,15.5]]){const[x,y]=point([lon,lat]),w=label.length*22*labelScale;if(!places.boxes.some(b=>intersects(b,{x:x-w/2,y:y-29*labelScale,w,h:38*labelScale})))out.push(fixed(x,y,`<text x="${num(x)}" y="${num(y)}" text-anchor="middle" fill="${colors.marine}" ${labelOutline} font-family="${labelFont}" font-style="${plainLabels?'normal':'italic'}" font-size="${29*labelScale}" letter-spacing="${plainLabels?0:2*labelScale}">${label}</text>`));}
  }
  // All original routes, including history, share the exact same stroke. Only the selected color changes.
  const rest=visible.filter(t=>!selectedIds.has(t.id)).flatMap(t=>t.segments.map(s=>path(s))).join('');
  const highlighted=selectedTracks.flatMap(t=>t.segments.map(s=>path(s))).join('');
  out.push(`<g id="voyage-routes" fill="none" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"><path data-role="all-other-routes" d="${rest}" stroke="${stroke}"/><path data-role="selected-route" data-selected-count="${selectedTracks.length}" d="${highlighted}" stroke="${accent}"/></g>${places.markup}</g>`);
  if(highres&&options.hdRaster){
   out.push('<g data-role="imagery-credit"><text x="42" y="2125" font-family="Arial, Helvetica, sans-serif" font-size="21" fill="#ffffff" paint-order="stroke" stroke="#08212c" stroke-width="4" stroke-linejoin="round">EOxCloudless · cloudless.eox.at · EOX IT Services GmbH · Contains modified Copernicus Sentinel data 2016 · CC BY 4.0</text></g>');
  }
  out.push('</svg>');
  return out.join('');
 }
 if(isOverlay){
  const ink=/^#[0-9a-f]{6}$/i.test(options.accent)?options.accent:'#f2eee6';
  const alpha=Math.max(0,Math.min(1,Number(options.opacity)/100));
  const coastAlpha=Math.max(0,Math.min(1,Number(options.coastOpacity)/100));
  const lineWidth=Math.max(1,Math.min(20,Number(options.lineWidth)||5));
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(selectedTitle)} 투명 항적 오버레이"><defs><linearGradient id="fade-x"><stop stop-color="white" stop-opacity="0"/><stop offset=".08" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><linearGradient id="fade-y" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".1" stop-color="white"/><stop offset=".9" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="mx"><rect width="${W}" height="${H}" fill="url(#fade-x)"/></mask><mask id="my"><rect width="${W}" height="${H}" fill="url(#fade-y)"/></mask></defs>`];
  out.push(mapLayer);
  if(options.style==='coast'){
   out.push(`<g mask="url(#mx)"><g mask="url(#my)" fill="none" stroke="${ink}" stroke-width="1.5" opacity="${coastAlpha}" stroke-linejoin="round">`);
   for(const poly of data.land)out.push(`<path d="${poly.map(r=>path(r,true)).join('')}"/>`);
   out.push('</g></g>');
  }
  // One group per age prevents stationary GPS overlaps from becoming bright blobs.
  for(const historical of [true,false]){
   const d=visible.filter(t=>!selectedIds.has(t.id)&&t.history===historical).flatMap(t=>t.segments.map(s=>path(s))).join('');
   out.push(`<path d="${d}" fill="none" stroke="${ink}" stroke-width="${historical?1.4:1.8}" opacity="${alpha*(historical?.58:1)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  out.push(`<path data-role="selected-route" data-selected-count="${selectedTracks.length}" d="${selectedTracks.flatMap(t=>t.segments.map(s=>path(s))).join('')}" fill="none" stroke="${ink}" stroke-width="${lineWidth}" opacity=".96" stroke-linecap="round" stroke-linejoin="round"/>${placeLabels({ink,halo:'transparent',accent:ink,context:false}).markup}</g></svg>`);
  return out.join('');
 }
 const dark=options.theme==='dark';
 const c=dark?{sea:'#0d252e',land:'#263c3e',coast:'#4b6467',grid:'#28434a',label:'#9bb0b2',text:'#f1f3e9',muted:'#88a3a9',route:'#9ab6bb'}:{sea:'#e4edef',land:'#faf8ee',coast:'#b6c4c0',grid:'#cedcdf',label:'#647976',text:'#1e393b',muted:'#607b7e',route:'#5a797e'};
 if(/^#[0-9a-f]{6}$/i.test(options.landColor))c.land=options.landColor;
 if(/^#[0-9a-f]{6}$/i.test(options.seaColor))c.sea=options.seaColor;
 const accent=/^#[0-9a-f]{6}$/i.test(options.accent)?options.accent:'#ffad66';
 const svg=[];const add=s=>svg.push(s);
 const text=(x,y,label,size,fill=c.text,extra='')=>add(fixed(x,y,`<text x="${num(x)}" y="${num(y)}" font-size="${size}" fill="${fill}" ${extra}>${esc(label)}</text>`));
 add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(selectedTitle)} 항적 지도"><defs><clipPath id="frame"><rect x="80" y="80" width="3680" height="2000" rx="4"/></clipPath><linearGradient id="shade"><stop stop-color="${c.sea}" stop-opacity=".98"/><stop offset="1" stop-color="${c.sea}" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${c.sea}"/><g font-family="Arial, Helvetica, sans-serif" clip-path="url(#frame)">`);
 add(mapLayer);
 // Graticule is drawn in projected geographic coordinates.
 if(options.grid){
  add('<g data-role="grid">');
 for(let lon=85;lon<=175;lon+=5){let x=point([lon,30])[0];add(`<path d="M${num(x)},80V2080" stroke="${c.grid}" stroke-width="1.1" opacity=".65"/>`);if(x>110&&x<3700)text(x+12,2040,lon+'° E',21,c.muted);}
 for(let lat=5;lat<=60;lat+=5){let y=point([120,lat])[1];add(`<path d="M80,${num(y)}H3760" stroke="${c.grid}" stroke-width="1.1" opacity=".65"/>`);if(y>130&&y<1960)text(3690,y-12,lat+'° N',21,c.muted,'text-anchor="end"');}
  add('</g>');
 }
 add(`<g fill="${c.land}" stroke="${c.coast}" stroke-width="1.4" fill-rule="evenodd" stroke-linejoin="round">`);
 for(const poly of data.land){add(`<path d="${poly.map(r=>path(r,true)).join('')}"/>`);} add('</g>');
 const countryLabels=[['CHINA',109,34],['KOREA',128.4,36.5],['JAPAN',138,37.4],['TAIWAN',122.3,23.7],['PHILIPPINES',124.8,12.6],['VIETNAM',105.5,18.8],['RUSSIA',143,51]];
 if(customLabelColor)c.label=customLabelColor;
 if(options.labels){for(const[name,lon,lat]of countryLabels){let[x,y]=point([lon,lat]);if(x>100&&x<3650&&y>150&&y<1950)text(x,y,countryName(name),countryLabelSize,c.label,`text-anchor="middle" font-family="${labelFont}" letter-spacing="${plainLabels?0:6*labelScale}" font-weight="${plainLabels?400:500}" ${customLabelColor?`paint-order="stroke" stroke="${customLabelHalo}" stroke-width="4"`: ''}`);}}
 add(`<g fill="none" stroke="${c.route}" stroke-linecap="round" stroke-linejoin="round">`);
 for(const t of visible){if(selectedIds.has(t.id))continue;add(`<path d="${t.segments.map(s=>path(s)).join('')}" stroke-width="${t.history?3.2:4.2}" opacity="${Math.max(0,Math.min(1,options.opacity/100))*(t.history?.62:1)}"/>`);}add('</g>');
 let selectedPath=selectedTracks.flatMap(t=>t.segments.map(s=>path(s))).join('');
 add(`<path d="${selectedPath}" fill="none" stroke="${c.sea}" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/><path data-role="selected-route" data-selected-count="${selectedTracks.length}" d="${selectedPath}" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`);
 const begin=selected.segments[0][0], lastSegment=selected.segments.at(-1),end=lastSegment.at(-1);
 add(placeLabels({ink:c.text,halo:c.sea,accent}).markup);
 add('</g>');
 // A restrained left-side gradient keeps the editorial text legible.
 add('<rect x="80" y="80" width="1130" height="2000" fill="url(#shade)"/>');
 if(options.title){
 text(180,214,'RANDOM  /  VOYAGE ARCHIVE',25,c.muted,'letter-spacing="5"');
 const title=options.customTitle||selectedTitle.replace(/\s+-\s+/g,' → ');
 const maxLength=20;let lines=title.length>maxLength&&title.includes(' → ')?title.split(' → ').map((s,i)=>i?'→ '+s:s):[title];
 lines.forEach((line,i)=>text(174,365+i*118,line,Math.min(112,Math.floor(1250/(Math.max(1,line.length)*.58))),c.text,'font-weight="600" letter-spacing="-3"'));
 let textY=lines.length>1?550:445;
 add(`<path d="M180,${textY-28}H270" stroke="${accent}" stroke-width="5"/>`);
 const date=iso=>{let d=new Date(new Date(iso).getTime()+9*3600000);return isNaN(d)?'':d.toISOString().slice(0,10).replaceAll('-','.');};
 const dates=(selectedTracks.length?selectedTracks:visible).flatMap(t=>[t.start,t.end]).filter(Boolean).sort();
 if(dates.length)text(180,textY+44,`${date(dates[0])} — ${date(dates.at(-1))}`,28,c.muted);
 if(selected.start)text(180,textY+85,'UTC+09  ·  GPX RECORDED TRACK',19,c.muted,'letter-spacing="2"');
 const km=(selectedTracks.length?selectedTracks:visible).reduce((total,t)=>total+distance(t),0),nm=km/1.852;
 text(180,1690,'RECORDED DISTANCE',22,c.muted,'letter-spacing="4"');
 text(176,1795,Math.round(nm).toLocaleString('en-US'),100,c.text,'font-weight="500"');
 text(176+String(Math.round(nm)).length*60+22,1795,'NM',31,c.muted);
 text(180,1850,`${Math.round(km).toLocaleString('en-US')} km`,28,c.muted);
 }
 const legendY=1958;
 add(`<path d="M180,${legendY}h62" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>`);text(266,legendY+8,(selectedTracks.length?'SELECTED PASSAGES':'NO HIGHLIGHT'),23,c.text,'letter-spacing="2"');
 add(`<path d="M650,${legendY}h62" stroke="${c.route}" stroke-width="5" opacity=".45"/>`);text(736,legendY+8,'VOYAGE TRACKS',23,c.muted,'letter-spacing="2"');
 // North indicator and a true Mercator scale at the route's middle latitude.
 text(3610,190,'N',27,c.label,'text-anchor="middle"');add(`<path d="M3610,213l-13,43 13,-9 13,9Z" fill="${c.label}"/>`);
 const midLat=(begin[1]+end[1])/2;const scaleKm=options.mode==='focus'?100:500;const bar=scaleKm/(111.195*Math.cos(midLat*rad))*scale*camera.zoom;
 const bx=3540-Math.min(bar,700);const barWidth=Math.min(bar,700); // choose fallback number if clipping the scale bar
 const actualKm=scaleKm*barWidth/bar;
 add(`<path d="M${num(bx)},1925v12h${num(barWidth)}v-12" stroke="${c.muted}" stroke-width="3" fill="none"/>`);text(3540,1902,`${Math.round(actualKm)} km at ${midLat.toFixed(1)}° N`,22,c.muted,'text-anchor="end"');
 text(3540,1990,'Natural Earth  ·  GPX original coordinates',21,c.muted,'text-anchor="end"');
 add('</g><rect x="80" y="80" width="3680" height="2000" fill="none" stroke="'+c.grid+'" stroke-width="2"/></svg>');
 return svg.join('');
}
root.RouteRenderer={render,distance,endpoints,selection,toggleSelection,palettes,backgroundLooks,width:W,height:H,maxZoom:MAX_ZOOM};
})(typeof window==='undefined'?globalThis:window);

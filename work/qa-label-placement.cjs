// Regression: place names must clear the actual drawn paths, including dense Hong Kong tracks.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c={window:{}};vm.createContext(c);
for(const file of ['data.js','backgrounds.js','renderer.js'])vm.runInContext(fs.readFileSync('work/route-studio/dist/'+file,'utf8'),c);
const {ROUTE_DATA:data,RouteRenderer:r}=c.window,tracks=data.groups.flatMap(g=>g.tracks),naha=tracks.find(t=>t.name==='Naha - Jeju');
const hk=tracks.filter(t=>r.endpoints(t).some(e=>e.name==='Hong Kong'));
const tags=svg=>[...svg.matchAll(/<g data-role="(?:endpoint|port)-label"[^>]+>/g)].map(m=>m[0]);
const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'="([^"]+)"'))?.[1];
const box=tag=>{const[x,y,w,h]=attr(tag,'data-box').split(',').map(Number);return{x,y,w,h};};
function edges(svg){
 const result=[];
 for(const match of svg.matchAll(/<path data-role="(?:all-other-routes|selected-route)"[^>]*\bd="([^"]*)"/g)){
  let previous;
  for(const m of match[1].matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)){
   const p=[Number(m[2]),Number(m[3])];if(m[1]==='L'&&previous)result.push([previous,p]);previous=p;
  }
 }
 return result;
}
// Independent orientation-based intersection check on the final SVG geometry.
function touches([a,b],rect,gap=8){
 const l=rect.x-gap,rr=rect.x+rect.w+gap,t=rect.y-gap,bb=rect.y+rect.h+gap;
 if(Math.max(a[0],b[0])<l||Math.min(a[0],b[0])>rr||Math.max(a[1],b[1])<t||Math.min(a[1],b[1])>bb)return false;
 const inside=p=>p[0]>=l&&p[0]<=rr&&p[1]>=t&&p[1]<=bb;
 if(inside(a)||inside(b))return true;
 const cross=(p,q,s)=>(q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0]);
 const intersects=(p,q)=>{
  if(Math.max(a[0],b[0])<Math.min(p[0],q[0])||Math.min(a[0],b[0])>Math.max(p[0],q[0])||Math.max(a[1],b[1])<Math.min(p[1],q[1])||Math.min(a[1],b[1])>Math.max(p[1],q[1]))return false;
  return cross(a,b,p)*cross(a,b,q)<=0&&cross(p,q,a)*cross(p,q,b)<=0;
 };
 return [[[l,t],[rr,t]],[[rr,t],[rr,bb]],[[rr,bb],[l,bb]],[[l,bb],[l,t]]].some(([p,q])=>intersects(p,q));
}
const centeredView=(options,zoom,location=[114.1835,22.2835])=>{
 const svg=r.render(data,{...options,view:{zoom:1,panX:0,panY:0}}),[x0,y0,x1,y1]=svg.match(/data-bounds="([^"]+)"/)[1].split(',').map(Number);
 const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 const x=x0+(location[0]-65)/115*(x1-x0),y=y0+(merc(65)-merc(location[1]))/merc(65)*(y1-y0);
 return {zoom,panX:-(x-1920)*zoom,panY:-(y-1080)*zoom};
};
let count=0;
function check(options,description){
 const svg=r.render(data,options),labels=tags(svg),hong=labels.filter(tag=>attr(tag,'data-name')==='Hong Kong');
 assert(hong.length>0,description+': Hong Kong must remain visible');
 const routeEdges=edges(svg);
 for(const label of hong){const b=box(label);assert(!routeEdges.some(edge=>touches(edge,b)),description+': Hong Kong overlaps a route');}
 for(const label of labels){const b=box(label);assert(b.x>=0&&b.y>=0&&b.x+b.w<=3840.2&&b.y+b.h<=2160.2,description+': name outside frame');}
 count++;return svg;
}
// Context label, selected arrival/departure, roundtrip, and several selected passages.
check({selectedIds:[naha.id]},'Hong Kong context label');
check({selectedIds:[]},'no selection');
for(const track of hk)for(const mode of ['all','focus'])check({selectedIds:[track.id],mode},track.name+' '+mode);
check({selectedIds:hk.map(t=>t.id)},'all Hong Kong passages');
check({selectedIds:tracks.map(t=>t.id)},'all 81 tracks');
for(const zoom of [2,16,256])for(const labelScale of [50,100,250]){
 const options={selectedIds:[hk[0].id],labelScale,lineWidth:20};
 check({...options,view:centeredView(options,zoom)},'zoom '+zoom+' labels '+labelScale);
}
for(const background of ['navionics','satellite','relief','satelliteHD'])check({selectedIds:[naha.id],background},background);
for(const labelFont of ['arial','georgia','courier'])check({selectedIds:hk.map(t=>t.id),labelFont,labelScale:150},labelFont);
const full=check({selectedIds:[hk[0].id]},'font baseline'),zoomed=check({selectedIds:[hk[0].id],view:centeredView({selectedIds:[hk[0].id]},16)},'font zoom');
const font=svg=>svg.match(/data-name="Hong Kong"[\s\S]*?font-size="([^"]+)"/)[1];assert.equal(font(full),font(zoomed));
const transparent=check({selectedIds:[hk[0].id],transparentSea:true},'overlay');assert(!transparent.includes('<rect data-role="sea"'));
assert(!r.render(data,{labels:false}).includes('data-role="endpoint-label"'));
console.log(`PASS: ${count} real-map cases; Hong Kong names avoid actual GPX lines, remain visible/in frame; context, arrival, departure, multiple/all selections, 2–256x zoom, 50–250% fonts, thick routes, all backgrounds and transparency.`);

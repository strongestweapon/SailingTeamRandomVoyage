/* On-demand, attributed EOX Sentinel-2 cloudless 2016 imagery (CC BY 4.0).
   Only visible tiles are requested; GPX data never leaves this document. */
(function(root){
'use strict';
const tileSize=256,maxLevel=14,maxTiles=320,cacheLimit=256,cache=new Map();
const rad=Math.PI/180;
const abortError=()=>new DOMException('지도 요청이 취소되었습니다.','AbortError');
const check=signal=>{if(signal?.aborted)throw abortError();};
function plan(bounds,width=3840,height=2160){
 const [west,south,east,north]=bounds;
 if(!bounds.every(Number.isFinite)||west>=east||south>=north||west< -180||east>180||south< -85||north>85)throw new Error('위성 지도 범위를 벗어났습니다.');
 const x=lon=>(lon+180)/360,y=lat=>(1-Math.log(Math.tan(Math.PI/4+lat*rad/2))/Math.PI)/2;
 const unit={left:x(west),right:x(east),top:y(north),bottom:y(south)};
 let z=Math.max(0,Math.min(maxLevel,Math.ceil(Math.log2(width/((unit.right-unit.left)*tileSize)))));
 let grid;
 do{
  const n=2**z,size=n*tileSize;
  grid={z,left:unit.left*size,top:unit.top*size,right:unit.right*size,bottom:unit.bottom*size,
   x0:Math.max(0,Math.floor(unit.left*n)),x1:Math.min(n-1,Math.ceil(unit.right*n)-1),
   y0:Math.max(0,Math.floor(unit.top*n)),y1:Math.min(n-1,Math.ceil(unit.bottom*n)-1)};
  if((grid.x1-grid.x0+1)*(grid.y1-grid.y0+1)<=maxTiles||z===0)break;
  z--;
 }while(true);
 const tiles=[];
 for(let ty=grid.y0;ty<=grid.y1;ty++)for(let tx=grid.x0;tx<=grid.x1;tx++)tiles.push({x:tx,y:ty,z,key:`${z}/${ty}/${tx}`});
 return {...grid,tiles,bounds:[...bounds],width,height,key:JSON.stringify([bounds,width,height,z])};
}
function tileURL(tile){return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${tile.key}.jpg`;}
async function tileImage(tile,signal){
 check(signal);
 if(cache.has(tile.key)){const image=cache.get(tile.key);cache.delete(tile.key);cache.set(tile.key,image);return image;}
 const controller=new AbortController(),abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,20000);
 let url;
 try{
  const response=await fetch(tileURL(tile),{mode:'cors',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(`위성 지도 서버 응답 ${response.status}`);
  const blob=await response.blob();check(signal);
  if(!blob.type.startsWith('image/'))throw new Error('위성 지도 이미지가 아닌 응답을 받았습니다.');
  url=URL.createObjectURL(blob);
  const image=new Image();image.src=url;await image.decode();check(signal);
  if(image.naturalWidth!==tileSize||image.naturalHeight!==tileSize)throw new Error('위성 지도 타일 크기가 올바르지 않습니다.');
  cache.set(tile.key,image);
  while(cache.size>cacheLimit)cache.delete(cache.keys().next().value);
  return image;
 }catch(error){
  check(signal);
  if(error.name==='AbortError')throw new Error('위성 지도 응답 시간이 초과되었습니다. 다시 시도하세요.');
  throw error;
 }finally{
  clearTimeout(timeout);signal?.removeEventListener('abort',abort);if(url)URL.revokeObjectURL(url);
 }
}
async function load(bounds,{width=1920,height=1080,signal,onProgress=()=>{}}={}){
 check(signal);const p=plan(bounds,width,height),controller=new AbortController();
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('위성 지도를 그릴 수 없습니다.');
 ctx.fillStyle='#082d48';ctx.fillRect(0,0,width,height);
 // A shared affine transform aligns every tile edge exactly, including fractional crops.
 const sx=width/(p.right-p.left),sy=height/(p.bottom-p.top);
 ctx.setTransform(sx,0,0,sy,-p.left*sx,-p.top*sy);
 let next=0,done=0,failure=null;
 onProgress(0,p.tiles.length);
 const worker=async()=>{
  try{
   while(next<p.tiles.length){
    check(controller.signal);const tile=p.tiles[next++],image=await tileImage(tile,controller.signal);
    check(controller.signal);ctx.drawImage(image,tile.x*tileSize,tile.y*tileSize,tileSize,tileSize);
    onProgress(++done,p.tiles.length);
   }
  }catch(error){if(!failure)failure=error;controller.abort();}
 };
 try{
  await Promise.all(Array.from({length:Math.min(4,p.tiles.length)},worker));
  check(signal);if(failure)throw failure;
  return {bounds:[...bounds],url:canvas.toDataURL('image/jpeg',.95),level:p.z,width,height};
 }finally{signal?.removeEventListener('abort',abort);}
}
root.SatelliteHD={plan,load,tileURL,maxLevel};
})(typeof window==='undefined'?globalThis:window);

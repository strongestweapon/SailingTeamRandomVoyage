'use strict';
const $=id=>document.getElementById(id),data=window.ROUTE_DATA;
const initialTrack=data.groups.flatMap(g=>g.tracks).find(t=>t.name==='Naha - Jeju').id;
const state={selectedIds:[initialTrack],editingId:initialTrack,selected:initialTrack};
const defaults={mode:'all',history:true,opacity:100,...RouteRenderer.palettes.navionics,palette:'navionics',background:'navionics',grid:false,labels:true,title:false,customTitle:'',style:'expedition',lineWidth:7,coastOpacity:14,labelFont:'arial',labelStyle:'plain',labelScale:100,labelColor:'#f1f5f7',labelColorAuto:true,endpointEmphasis:false,transparentSea:false,landOpacity:20};
Object.assign(state,defaults);state.endpointNames={};state.view={zoom:1,panX:0,panY:0};let currentSVG='',timer;
const backgroundColorKeys=['palette','theme','landColor','seaColor','routeColor','accent','labelColor','labelColorAuto'];
let backgroundColorStates={};
let hdPreview=null,hdRequest=null,hdEpoch=0,hdExporting=false;
const usesHD=options=>options.style==='expedition'&&options.background==='satelliteHD';
const viewportOf=svg=>svg.match(/data-viewport="([^"]+)"/)[1].split(',').map(Number);
const viewportKey=bounds=>JSON.stringify(bounds);
function cancelHDPreview(){hdEpoch++;hdRequest?.abort();hdRequest=null;}
function refreshHDPreview(){
 const active=usesHD(state);
 $('imagery-credit').hidden=!active;$('background-retry').hidden=true;
 if(!active){$('background-status').textContent='';return;}
 const bounds=viewportOf(currentSVG),key=viewportKey(bounds);
 if(hdPreview?.key===key){
  currentSVG=RouteRenderer.render(data,{...state,hdRaster:hdPreview.raster});map.innerHTML=currentSVG;
  $('background-status').textContent='고해상도 위성 준비됨 · 2016년 합성';return;
 }
 if(hdExporting){$('background-status').textContent='4K 저장용 위성 자료를 불러오는 중…';return;}
 const epoch=hdEpoch,controller=new AbortController();hdRequest=controller;
 const progress=(done,total)=>{if(epoch===hdEpoch)$('background-status').textContent=`위성 자료 불러오는 중 ${Math.round(done/total*100)}% · 임시로 전체 지도 표시`;};
 SatelliteHD.load(bounds,{signal:controller.signal,onProgress:progress}).then(raster=>{
  if(epoch!==hdEpoch)return;
  hdPreview={key,raster};hdRequest=null;update();
 }).catch(error=>{
  if(epoch!==hdEpoch||error.name==='AbortError')return;
  hdRequest=null;$('background-status').textContent='고해상도를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요. 현재는 저해상도 미리보기입니다.';
  $('background-retry').hidden=false;
 });
}
function changeBackground(next){
 if(!['navionics','satellite','relief','satelliteHD'].includes(next))return;
 if(next!==state.background){
  backgroundColorStates[state.background]=Object.fromEntries(backgroundColorKeys.map(key=>[key,state[key]]));
  Object.assign(state,backgroundColorStates[next]||RouteRenderer.backgroundLooks[next]||RouteRenderer.palettes.navionics);
  state.background=next;
  for(const key of backgroundColorKeys){if(typeof state[key]==='boolean')$(key).checked=state[key];else $(key).value=state[key];}
 }
 $('background').value=next;
 state.style='expedition';$('style').value=state.style;
 clearTimeout(timer);update();
}
let renderedView={...state.view},cameraFrame=0,cameraTimer=0,baseBounds=null;
const map=$('map'),pointers=new Map();let lastGesture=null;
let destinationCopyPending=false;
function selectedTracks(){return RouteRenderer.selection(data,state);}
function selected(){return selectedTracks().find(t=>t.id===state.editingId)||null;}
function formatDestinationCoordinates(endpoint){
 const [lon,lat]=endpoint?.point||[];
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)return '';
 return `${Math.abs(lat).toFixed(6)}° ${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(6)}° ${lon<0?'W':'E'}`;
}
function syncDestinationCoordinates(track,endpoint){
 const input=$('destination-coordinates'),value=formatDestinationCoordinates(endpoint),key=track?.id||'';
 if(input.value!==value||input.dataset.trackId!==key){
  input.value=value;input.dataset.trackId=key;$('coordinates-status').textContent='';
 }
 input.disabled=!value;
 syncCoordinateCopyButtons();
}
function syncCoordinateCopyButtons(){
 for(const [inputId,buttonId]of [['destination-coordinates','copy-destination-coordinates'],['all-destination-coordinates','copy-all-coordinates']]){
  $(buttonId).disabled=destinationCopyPending||!$(inputId).value;
 }
}
function syncAllDestinationCoordinates(tracks){
 const input=$('all-destination-coordinates'),groupNames=new Map(data.groups.flatMap(g=>g.tracks.map(t=>[t.id,g.name])));
 const clean=value=>String(value||'').replace(/[\t\r\n]+/g,' ');
 const rows=tracks.flatMap(track=>{
  const endpoint=RouteRenderer.endpoints(track,state.endpointNames[track.id])[1],coordinates=formatDestinationCoordinates(endpoint);
  return coordinates?[[groupNames.get(track.id),track.name,endpoint.name,...coordinates.split(', ')].map(clean).join('\t')]:[];
 });
 const value=rows.length?['기록\t구간\t목적지\tLatitude\tLongitude',...rows].join('\n'):'';
 const key=tracks.map(t=>t.id).join('|');
 if(input.value!==value||input.dataset.trackId!==key){input.value=value;input.dataset.trackId=key;$('all-coordinates-status').textContent='';}
 input.disabled=!value;$('select-all-coordinates').disabled=!value;
 $('coordinates-count').textContent=`${rows.length}개 구간`;
 syncCoordinateCopyButtons();
}
async function copyCoordinateText(inputId,statusId){
 const input=$(inputId),status=$(statusId);
 const value=input.value,key=input.dataset.trackId;
 if(!value||destinationCopyPending)return;
 destinationCopyPending=true;syncCoordinateCopyButtons();status.textContent='';
 const unchanged=()=>input.value===value&&input.dataset.trackId===key;
 let copied=false;
 try{
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);copied=true;}}catch{}
  // Local-file browsers may not support Clipboard API; keep manual copying available.
  if(!copied&&unchanged()){
   input.focus({preventScroll:true});input.select();
   try{copied=typeof document.execCommand==='function'&&document.execCommand('copy');}catch{}
  }
  if(unchanged())status.textContent=copied?'좌표를 복사했습니다.':'선택된 좌표를 ⌘C 또는 Ctrl+C로 복사하세요.';
 }finally{destinationCopyPending=false;syncCoordinateCopyButtons();}
}
function copyDestinationCoordinates(){
 return copyCoordinateText('destination-coordinates','coordinates-status');
}
function setSelection(ids,preferredId){
 state.selectedIds=[...new Set(ids)];
 if(preferredId&&state.selectedIds.includes(preferredId))state.editingId=preferredId;
 if(!state.selectedIds.includes(state.editingId))state.editingId=state.selectedIds.at(-1)||null;
 state.selected=state.editingId;
 if(state.mode==='focus')resetView();
 state.customTitle='';$('customTitle').value='';update();
}
function tree(){
 const nav=$('tree');nav.replaceChildren();
 for(const group of data.groups){
  const details=document.createElement('details');details.open=!group.history;
  const summary=document.createElement('summary');summary.append(document.createTextNode(group.name));let count=document.createElement('span');count.className='count';count.textContent=group.tracks.length;summary.append(count);details.append(summary);
  for(const track of group.tracks){const btn=document.createElement('button');btn.className='track';btn.dataset.trackId=track.id;btn.textContent=track.name;btn.title=track.name;btn.onclick=()=>setSelection(RouteRenderer.toggleSelection(state.selectedIds,track.id),track.id);details.append(btn);}
  nav.append(details);
 }
 const groups=data.groups;const foot=document.querySelector('.aside-foot');foot.replaceChildren();const dot=document.createElement('span');dot.className='dot';foot.append(dot,document.createTextNode(`${groups.length}개 기록 · ${groups.reduce((n,g)=>n+g.tracks.length,0)}개 구간`),document.createElement('br'),document.createTextNode('새로 추가한 GPX는 서버로 전송되지 않습니다.'));
}
function update(){
 cancelHDPreview();
 clearTimeout(cameraTimer);cancelAnimationFrame(cameraFrame);cameraFrame=0;
 currentSVG=RouteRenderer.render(data,state);map.innerHTML=currentSVG;
 renderedView={...state.view};baseBounds=map.querySelector('[data-map-layer]').dataset.bounds.split(',').map(Number);syncCameraControls();
 const chosen=selectedTracks(),t=selected();
 $('selected-name').textContent=chosen.length===1?chosen[0].name:chosen.length?`${chosen.length}개 구간 선택`:'전체 항적 · 선택 없음';
 $('selection-count').textContent=`${chosen.length}개 선택`;$('clear-selection').disabled=!chosen.length;
 document.querySelectorAll('.track').forEach(btn=>{const active=state.selectedIds.includes(btn.dataset.trackId);btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
 const edit=$('edit-route'),signature=state.selectedIds.join('|');
 if(edit.dataset.selectionKey!==signature){
  edit.replaceChildren();
  for(const track of chosen){const option=document.createElement('option');option.value=track.id;option.textContent=track.name;edit.append(option);}
  if(!chosen.length){const option=document.createElement('option');option.value='';option.textContent='선택한 구간 없음';edit.append(option);}
  edit.dataset.selectionKey=signature;
 }
 edit.value=t?.id||'';edit.disabled=!t;
 const ends=t?RouteRenderer.endpoints(t,state.endpointNames[t.id]):[];
 for(const [i,id]of ['start-name','end-name'].entries()){
  if(document.activeElement!==$(id))$(id).value=ends[i]?.name||'';
  $(id).disabled=!state.labels||!t;$(id).closest('.control').classList.toggle('inactive',!state.labels||!t);
 }
 syncDestinationCoordinates(t,ends[1]);
 syncAllDestinationCoordinates(chosen);
 const measured=chosen.length?chosen:data.groups.filter(g=>state.history||!g.history).flatMap(g=>g.tracks);
 const km=measured.reduce((n,t)=>n+RouteRenderer.distance(t),0),n=measured.reduce((n,t)=>n+t.segments.reduce((n,s)=>n+s.length,0),0);
 $('stats').textContent=`${chosen.length?'선택':'전체'} ${measured.length}개 구간 · ${Math.round(km).toLocaleString()} km · ${Math.round(km/1.852).toLocaleString()} NM · ${n.toLocaleString()}개 좌표`;
 if(state.labelColorAuto){
  const v=parseInt(state.seaColor.slice(1),16),light=.2126*(v>>16)+.7152*((v>>8)&255)+.0722*(v&255)>110;
  state.labelColor=state.style==='expedition'&&state.transparentSea?state.routeColor:['coast','trace'].includes(state.style)?state.accent:state.style==='expedition'&&RouteRenderer.backgroundLooks[state.background]?RouteRenderer.backgroundLooks[state.background].labelColor:light?'#20343d':state.style==='expedition'&&state.labelStyle==='plain'?'#b7c0b7':'#f1f5f7';$('labelColor').value=state.labelColor;
 }
 $('opacity-value').textContent=state.opacity+'%';
 $('width-value').textContent=state.lineWidth+' px';$('coast-value').textContent=state.coastOpacity+'%';
 $('label-scale-value').textContent=state.labelScale+'%';
 $('land-opacity-value').textContent=state.landOpacity+'%';
 for(const key of ['labelFont','labelStyle','labelScale','labelColor','labelColorAuto','endpointEmphasis']){
  $(key).disabled=!state.labels;
  $(key).closest('.control').classList.toggle('inactive',!state.labels);
 }
 const overlay=state.style==='coast'||state.style==='trace';
 const expedition=state.style==='expedition',transparent=expedition&&state.transparentSea;
 const raster=expedition&&state.background!=='navionics';
 $('background').value=expedition?state.background:'';
 const backgroundHelp={navionics:'Navionics 색상 지도 · 땅과 바다 색상을 직접 조절',satellite:'NASA Blue Marble · 위성 합성 + 해저 음영 · 2004년 자료',relief:'Natural Earth II · 지형 + 해저 음영',satelliteHD:'Sentinel-2 / EOX · 2016년 위성 합성 · 인터넷 연결 필요 · 4K 저장 시 원본을 다시 불러옵니다.'};
 $('background-help').textContent=expedition?backgroundHelp[state.background]+(raster&&state.background!=='satelliteHD'?' · 크게 확대하면 원본 해상도 한계가 보입니다.':'')+(usesHD(state)&&transparent?' · 바다 투명은 기존 해안선으로 잘라내므로 항구의 세부 윤곽과 차이가 납니다.':''):'배경을 선택하면 탐험 지도로 전환합니다.';
 for(const key of ['palette','landColor']){$(key).disabled=raster;$(key).closest('.control').classList.toggle('inactive',raster);}
 document.body.classList.toggle('transparent-map',transparent);
 $('landOpacity').disabled=!transparent;$('landOpacity').closest('.control').classList.toggle('inactive',!transparent);
 $('seaColor').disabled=transparent||raster;$('seaColor').closest('.control').classList.toggle('inactive',transparent||raster);
 document.body.classList.toggle('expedition-mode',expedition);
 $('line-width-label').textContent=expedition?'전체 항적 두께':'선택 구간 두께';
 $('color-label').textContent=expedition?'선택 구간 색상':'선 색상';
 $('opacity-label').textContent=expedition?'전체 항적 농도':'배경 항적';
 document.body.classList.toggle('overlay-mode',overlay);
 $('alpha-badge').hidden=!(overlay||transparent);
 document.querySelector('.coast-control').classList.toggle('inactive',state.style==='trace');$('coastOpacity').disabled=state.style==='trace';
 $('preview-note').textContent=transparent?'바다 투명 PNG · 미리보기 배경은 저장되지 않습니다.':overlay?'배경은 미리보기용입니다. PNG에는 선만 저장됩니다.':'미리보기와 동일한 구도로 저장됩니다.';
 refreshHDPreview();
}
for(const key of Object.keys(defaults)){
 const onChange=()=>{
  if(key==='background'){changeBackground($('background').value);return;}
  state[key]=$(key).type==='checkbox'?$(key).checked:$(key).type==='range'?Number($(key).value):$(key).value;
  if(['mode','style','history'].includes(key))resetView();
  if(key==='palette'&&RouteRenderer.palettes[state.palette]){
   const preset=RouteRenderer.palettes[state.palette];
   Object.assign(state,preset);
   for(const [name,value]of Object.entries(preset))$(name).value=value;
  }
  if(['landColor','seaColor','routeColor','accent','theme'].includes(key)){
   state.palette='custom';$('palette').value='custom';
  }
  if(key==='theme'){
   const editorial=state.style==='editorial',dark=state.theme==='dark';
   state.landColor=editorial?(dark?'#263c3e':'#faf8ee'):(dark?'#89998b':'#e7e4d5');
   state.seaColor=editorial?(dark?'#0d252e':'#e4edef'):(dark?'#254450':'#b8ced3');
   $('landColor').value=state.landColor;$('seaColor').value=state.seaColor;
  }
  if(key==='labelColor'){state.labelColorAuto=false;$('labelColorAuto').checked=false;}
  if(key==='labelScale')$('label-scale-value').textContent=state.labelScale+'%';
  if(key==='landOpacity')$('land-opacity-value').textContent=state.landOpacity+'%';
  clearTimeout(timer);timer=setTimeout(update,key==='customTitle'?160:$(key).type==='color'||key==='labelScale'||key==='landOpacity'?60:0);
 };
 $(key).addEventListener(key==='customTitle'?'input':'change',onChange);
 if($(key).type==='color'||key==='labelScale'||key==='landOpacity')$(key).addEventListener('input',onChange);
}
for(const [id,role]of [['start-name','start'],['end-name','end']]){
 $(id).addEventListener('input',()=>{
  const t=selected();if(!t)return;state.endpointNames[t.id]??={};state.endpointNames[t.id][role]=$(id).value;
  clearTimeout(timer);timer=setTimeout(update,120);
 });
 $(id).addEventListener('blur',()=>{if(!$(id).value.trim())update();});
}
$('edit-route').onchange=()=>{state.editingId=$('edit-route').value;state.selected=state.editingId;update();};
$('copy-destination-coordinates').onclick=copyDestinationCoordinates;
$('copy-all-coordinates').onclick=()=>copyCoordinateText('all-destination-coordinates','all-coordinates-status');
$('select-all-coordinates').onclick=()=>{const input=$('all-destination-coordinates');if(input.value){input.focus({preventScroll:true});input.select();}};
$('background-retry').onclick=()=>update();
$('clear-selection').onclick=()=>setSelection([]);
$('select-all').onclick=()=>setSelection(data.groups.flatMap(g=>g.tracks.map(t=>t.id)));
$('opacity').addEventListener('input',()=>{$('opacity-value').textContent=$('opacity').value+'%';});
$('reset').onclick=()=>{Object.assign(state,defaults);state.endpointNames={};backgroundColorStates={};resetView();for(const [key,value]of Object.entries(defaults)){if(typeof value==='boolean')$(key).checked=value;else $(key).value=value;}update();$('status').textContent='기본 지도 설정으로 돌아왔습니다.';};
async function pngBlob(snapshot=JSON.parse(JSON.stringify(state))){
 // Render anew so export always reflects the latest input, even during debounce.
 const snapshotData={...data,groups:[...data.groups]};
 let url,svg=RouteRenderer.render(snapshotData,snapshot);const highres=usesHD(snapshot);
 try{
  if(highres){
   hdExporting=true;cancelHDPreview();
   const bounds=viewportOf(svg),key=viewportKey(bounds);
   const raster=hdPreview?.key===key&&hdPreview.raster.width===3840?hdPreview.raster:await SatelliteHD.load(bounds,{width:3840,height:2160,onProgress:(done,total)=>{$('status').textContent=`4K 위성 자료 불러오는 중 ${Math.round(done/total*100)}%…`;}});
   hdPreview={key,raster};svg=RouteRenderer.render(snapshotData,{...snapshot,hdRaster:raster});
  }
  url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=2160;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 인코딩 실패')),'image/png'));
 }finally{if(url)URL.revokeObjectURL(url);if(highres){hdExporting=false;update();}}
}
$('export').onclick=async()=>{const btn=$('export'),snapshot=JSON.parse(JSON.stringify(state));btn.disabled=true;$('status').textContent='3840 × 2160 PNG를 만들고 있습니다…';try{const blob=await pngBlob(snapshot),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;const chosen=RouteRenderer.selection(data,snapshot),filename=chosen.length===1?chosen[0].name:chosen.length?'Selected_'+chosen.length+'_Passages':'All_Voyages';a.download=filename.replace(/[^\p{L}\p{N}_-]+/gu,'_')+(snapshot.style==='expedition'&&snapshot.background!=='navionics'?'_'+({satellite:'Satellite',relief:'Relief',satelliteHD:'Satellite_HD_2016'}[snapshot.background]):'')+(snapshot.style==='expedition'?(snapshot.transparentSea?'_Overlay_4K.png':'_Expedition_4K.png'):snapshot.style==='editorial'?'_4K.png':'_overlay_'+snapshot.style+'_4K.png');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('status').textContent='4K PNG가 준비되었습니다. 브라우저 다운로드를 확인하세요.';}catch(e){$('status').textContent='저장하지 못했습니다: '+e.message+(usesHD(snapshot)?' 고해상도 자료가 모두 준비된 뒤 다시 저장하세요.':'');}finally{btn.disabled=false;}};
$('files').onchange=async event=>{
 let added=0,failures=[];
 for(const file of event.target.files){try{
  if(file.size>40*1024*1024)throw new Error('40MB 이하의 파일을 사용하세요.');
  const doc=new DOMParser().parseFromString(await file.text(),'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='gpx')throw new Error('올바른 GPX가 아닙니다.');
  const direct=(e,n)=>Array.from(e.children).filter(x=>x.localName===n);const tracks=[];
  for(const [i,t]of Array.from(doc.getElementsByTagNameNS('*','trk')).entries()){
   const times=[];let segments=[];
   for(const seg of direct(t,'trkseg')){const pts=[];for(const p of direct(seg,'trkpt')){
    if(!p.hasAttribute('lon')||!p.hasAttribute('lat'))throw new Error('좌표가 누락되었습니다.');
    let x=Number(p.getAttribute('lon')),y=Number(p.getAttribute('lat'));
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('유효하지 않은 좌표입니다.');
    if(x<85||x>175||y<5||y>60)throw new Error('현재 지도 지원 범위(동아시아)를 벗어납니다.');
    pts.push([x,y]);let tm=direct(p,'time')[0]?.textContent;if(tm&&!isNaN(new Date(tm)))times.push(tm);
   }if(pts.length)segments.push(pts);}
   if(segments.length)tracks.push({id:'import:'+crypto.randomUUID(),name:direct(t,'name')[0]?.textContent||`Track ${i+1}`,segments,start:times[0]||null,end:times.at(-1)||null});
  }
  if(!tracks.length)throw new Error('trk/trkseg 형식의 트랙이 없습니다.');
  data.groups.push({name:file.name.replace(/\.gpx$/i,''),history:false,tracks});added+=tracks.length;
 }catch(e){failures.push(file.name+': '+e.message);}}
 if(added)resetView();tree();update();$('status').textContent=[added?`${added}개 구간을 추가했습니다. 새로고침하면 추가한 파일은 초기화됩니다.`:'',...failures].filter(Boolean).join(' ');event.target.value='';
};

// Camera values use the 3840×2160 export coordinate system, independent of preview size.
function resetView(){state.view={zoom:1,panX:0,panY:0};clearTimeout(cameraTimer);}
function syncCameraControls(){
 $('zoom-level').textContent=Math.round(state.view.zoom*100)+'%';
 $('zoom-in').disabled=state.view.zoom>=RouteRenderer.maxZoom-1e-6;$('zoom-out').disabled=state.view.zoom<=1+1e-6;
}
function constrainView(){
 const v=state.view;v.zoom=Math.max(1,Math.min(RouteRenderer.maxZoom,v.zoom));
 if(!baseBounds)return;
 for(const [axis,a,b,extent]of [['panX',baseBounds[0],baseBounds[2],3840],['panY',baseBounds[1],baseBounds[3],2160]]){
  const min=extent/2-(b-extent/2)*v.zoom,max=-extent/2-(a-extent/2)*v.zoom;
  v[axis]=min<=max?Math.max(min,Math.min(max,v[axis])):(min+max)/2;
 }
}
function showCamera(){
 cancelHDPreview();
 constrainView();syncCameraControls();
 if(cameraFrame)return;
 cameraFrame=requestAnimationFrame(()=>{
  cameraFrame=0;const layer=map.querySelector('[data-map-layer]');if(!layer)return;
  const r=state.view.zoom/renderedView.zoom;
  const x=1920+state.view.panX-r*(1920+renderedView.panX),y=1080+state.view.panY-r*(1080+renderedView.panY);
  layer.setAttribute('transform',`matrix(${r} 0 0 ${r} ${x} ${y})`);
  // Keep label dimensions and offsets constant while their geographic anchors move.
  // The final render uses the same font sizes, so settling the camera cannot shrink text.
  const inverse=1/r;
  for(const label of layer.querySelectorAll('[data-fixed-size]')){
   const ax=Number(label.dataset.anchorX),ay=Number(label.dataset.anchorY);
   label.setAttribute('transform',`matrix(${inverse} 0 0 ${inverse} ${ax*(1-inverse)} ${ay*(1-inverse)})`);
  }
 });
}
function commitCameraSoon(){clearTimeout(cameraTimer);cameraTimer=setTimeout(()=>{if(!pointers.size)update();},130);}
function localPoint(x,y){const r=map.getBoundingClientRect();return{x:(x-r.left)*3840/r.width,y:(y-r.top)*2160/r.height};}
function zoomAt(factor,anchor={x:1920,y:1080}){
 const v=state.view,z=Math.max(1,Math.min(RouteRenderer.maxZoom,v.zoom*factor)),ratio=z/v.zoom;
 v.panX=anchor.x-1920-(anchor.x-1920-v.panX)*ratio;
 v.panY=anchor.y-1080-(anchor.y-1080-v.panY)*ratio;v.zoom=z;
}
function gesture(){
 const ps=[...pointers.values()];if(!ps.length)return null;
 if(ps.length===1)return{...ps[0],distance:0};
 return{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2,distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)};
}
map.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 e.preventDefault();clearTimeout(cameraTimer);map.focus({preventScroll:true});
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastGesture=gesture();map.setPointerCapture(e.pointerId);map.classList.add('is-dragging');
});
map.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gesture();
 if(lastGesture){
  if(g.distance>0&&lastGesture.distance>0)zoomAt(g.distance/lastGesture.distance,localPoint(lastGesture.x,lastGesture.y));
  const r=map.getBoundingClientRect();state.view.panX+=(g.x-lastGesture.x)*3840/r.width;state.view.panY+=(g.y-lastGesture.y)*2160/r.height;
 }
 lastGesture=g;showCamera();
});
function endPointer(e){
 if(!pointers.has(e.pointerId))return;
 pointers.delete(e.pointerId);lastGesture=gesture();
 if(!pointers.size){map.classList.remove('is-dragging');update();}
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])map.addEventListener(event,endPointer);
window.addEventListener('blur',()=>{if(pointers.size){pointers.clear();lastGesture=null;map.classList.remove('is-dragging');update();}});
map.addEventListener('wheel',e=>{
 e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?map.clientHeight:1);
 zoomAt(Math.exp(Math.max(-1,Math.min(1,-delta*.002))),localPoint(e.clientX,e.clientY));showCamera();commitCameraSoon();
},{passive:false});
map.addEventListener('dblclick',e=>{e.preventDefault();zoomAt(e.shiftKey?.5:2,localPoint(e.clientX,e.clientY));showCamera();commitCameraSoon();});
map.addEventListener('keydown',e=>{
 const step=e.shiftKey?180:60,r=map.getBoundingClientRect();
 if(e.key==='ArrowLeft')state.view.panX+=step*3840/r.width;
 else if(e.key==='ArrowRight')state.view.panX-=step*3840/r.width;
 else if(e.key==='ArrowUp')state.view.panY+=step*2160/r.height;
 else if(e.key==='ArrowDown')state.view.panY-=step*2160/r.height;
 else if(e.key==='+'||e.key==='=')zoomAt(1.3);
 else if(e.key==='-')zoomAt(1/1.3);
 else if(e.key==='Home'){$('fit-all').click();e.preventDefault();return;}
 else return;
 e.preventDefault();showCamera();commitCameraSoon();
});
$('zoom-in').onclick=()=>{zoomAt(1.3);showCamera();commitCameraSoon();};
$('zoom-out').onclick=()=>{zoomAt(1/1.3);showCamera();commitCameraSoon();};
$('fit-all').onclick=()=>{state.mode='all';$('mode').value='all';resetView();update();};

$('overlay-reset').onclick=()=>$('reset').click();
for(const [id,tone] of [['preview-dark','dark'],['preview-light','light']])$(id).onclick=()=>{
 $('map').classList.toggle('preview-light',tone==='light');
 $('preview-dark').setAttribute('aria-pressed',String(tone==='dark'));$('preview-light').setAttribute('aria-pressed',String(tone==='light'));
};
for(const [key,out,suffix]of [['lineWidth','width-value',' px'],['coastOpacity','coast-value','%']])$(key).addEventListener('input',()=>{$(out).textContent=$(key).value+suffix;});
tree();update();
window.MapStudio={state,data,pngBlob,update,resetView,setSelection};

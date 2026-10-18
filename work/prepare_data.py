from pathlib import Path
import argparse, json, math, xml.etree.ElementTree as E
parser=argparse.ArgumentParser(description='Rebuild the bundled voyage data from the ten original GPX files.')
parser.add_argument('--gpx-dir',type=Path,required=True,help='Directory containing the original GPX files; files are read only.')
root=parser.parse_args().gpx_dir.expanduser().resolve()
if not root.is_dir():parser.error('GPX directory does not exist: '+str(root))
workspace=Path(__file__).resolve().parent.parent
out=workspace/'work/route-studio/dist'; ns={'g':'http://www.topografix.com/GPX/1/1'}
data=[]
for filename in ['Random()2025A.gpx','Random()2025B.gpx','RCSR2024.gpx',
                 '2024-06-16-08-26-16.gpx','2024-06-24-06-50-50.gpx','2024-06-27-09-07-05.gpx',
                 '2024-06-29-10-05-06.gpx','2024-07-02-14-38-54.gpx','Race3.gpx','Start-20220625.gpx']:
 f=root/filename; r=E.parse(f).getroot(); tracks=[]
 for index,t in enumerate(r.findall('g:trk',ns)):
  segments=[]; times=[]
  for s in t.findall('g:trkseg',ns):
   pts=[]
   for p in s.findall('g:trkpt',ns):
    pts.append([round(float(p.attrib['lon']),7),round(float(p.attrib['lat']),7)])
    tm=p.findtext('g:time',namespaces=ns)
    if tm: times.append(tm)
   if pts:segments.append(pts)
  if segments: tracks.append({'id':filename+':'+str(index),'name':t.findtext('g:name',default='Track '+str(index+1),namespaces=ns),'segments':segments,'start':times[0] if times else None,'end':times[-1] if times else None})
 data.append({'name':f.stem,'history':filename.startswith('Start'),'tracks':tracks})
# Clip land polygons to the supported East Asian area; retain islands and holes.
land=json.loads((workspace/'work/land-10m.geojson').read_text())
def clip(poly, axis, bound, lower):
 if not poly:return []
 result=[]; a=poly[-1]; ai=(a[axis]>=bound if lower else a[axis]<=bound)
 for b in poly:
  bi=(b[axis]>=bound if lower else b[axis]<=bound)
  if ai!=bi:
   t=(bound-a[axis])/(b[axis]-a[axis]); result.append([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])])
  if bi:result.append(b)
  a=b;ai=bi
 return result
polygons=[]
for f in land['features']:
 for poly in (f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]):
  rings=[]
  for ring in poly:
   for axis,bound,lower in [(0,65,True),(0,180,False),(1,0,True),(1,65,False)]:ring=clip(ring,axis,bound,lower)
   if len(ring)>=3:rings.append([[round(p[0],4),round(p[1],4)] for p in ring])
  if rings:polygons.append(rings)
content={'groups':data,'land':polygons,'coverage':[85,5,175,60]}
(out/'data.js').write_text('window.ROUTE_DATA='+json.dumps(content,separators=(',',':'),ensure_ascii=False)+';\n')
print('GPX tracks',sum(len(g['tracks']) for g in data),'land polygons',len(polygons),'data bytes',(out/'data.js').stat().st_size)

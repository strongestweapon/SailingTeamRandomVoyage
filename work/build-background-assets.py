"""Bundle offline Mercator rasters for the map's complete supported viewport."""
from pathlib import Path
from PIL import Image
import base64
import json
import math

Image.MAX_IMAGE_PIXELS = None
workspace = Path(__file__).resolve().parent.parent
base = workspace / 'work/map-backgrounds'
west, south, east, north = 65, 0, 180, 65
merc_north = math.degrees(math.log(math.tan(math.pi / 4 + math.radians(north) / 2)))
width = 6900
height = round(width * merc_north / (east - west))
assets = {}
for kind, filename in [('satellite', 'nasa-june-2004.jpg'), ('relief', 'NE2_HR_LC_SR_W.tif')]:
    with Image.open(base / filename) as image:
        sw, sh = image.size
        lon_to_x = lambda lon: (lon + 180) / 360 * sw
        lat_to_y = lambda lat: (90 - lat) / 180 * sh
        crop_box = (math.floor(lon_to_x(west)) - 2, math.floor(lat_to_y(north)) - 2,
                    sw, math.ceil(lat_to_y(south)) + 2)
        cropped = image.crop(crop_box).convert('RGB')
    left, right = lon_to_x(west) - crop_box[0], lon_to_x(east) - crop_box[0]
    source_y = lambda y: lat_to_y(math.degrees(math.atan(math.sinh(math.radians(merc_north * (1 - y / height)))))) - crop_box[1]
    mesh = []
    for y in range(0, height, 8):
        bottom = min(height, y + 8)
        top_y, bottom_y = source_y(y), source_y(bottom)
        mesh.append(((0, y, width, bottom), (left, top_y, left, bottom_y, right, bottom_y, right, top_y)))
    projected = cropped.transform((width, height), Image.Transform.MESH, mesh, Image.Resampling.BICUBIC)
    path = base / (kind + '-mercator.jpg')
    projected.save(path, quality=89, subsampling=0, optimize=True)
    assets[kind] = {'bounds': [west, south, east, north], 'width': width, 'height': height,
                    'url': 'data:image/jpeg;base64,' + base64.b64encode(path.read_bytes()).decode('ascii')}
    print(kind, width, height, round(path.stat().st_size / 1024**2, 2), 'MiB', flush=True)
(workspace / 'work/route-studio/dist/backgrounds.js').write_text('window.ROUTE_BACKGROUNDS=' + json.dumps(assets, separators=(',', ':')) + ';\n')

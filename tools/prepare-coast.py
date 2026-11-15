#!/usr/bin/env python3
"""Compile OSM coastline vector data, not visual assets. Requires Shapely >=2.1.
Input: Overpass JSON with way geometry for natural=coastline.
Projection matches EMPRISE: x east, z south from 43.2962 N, 5.3734 E.
Only 2-D cartography and shoreline distances are stored; terrain heights are
procedural at runtime and must never be described as measured elevation.
"""
import argparse,json,math,hashlib
from pathlib import Path
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString,Point,box
from shapely.ops import unary_union,polygonize,nearest_points
from shapely.strtree import STRtree
p=argparse.ArgumentParser();p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,default=Path('src/coast-data.js'));a=p.parse_args()
raw=a.input.read_bytes();source=json.loads(raw);lat0,lon0=43.2962,5.3734;mx=111320*math.cos(math.radians(lat0));mz=111320
project=lambda lon,lat:((lon-lon0)*mx,(lat0-lat)*mz)
# Inset inside queried bounds: every open mainland coastline crosses this box.
x0,z1=project(5.22,43.15);x1,z0=project(5.54,43.40);extent=box(x0,z0,x1,z1)
ways=[];segments=[]
for way in source['elements']:
 if way.get('tags',{}).get('natural')!='coastline':continue
 coords=[project(q['lon'],q['lat']) for q in way.get('geometry',[])];
 if len(coords)<2:continue
 line=LineString(coords);ways.append(line)
 for a0,b0 in zip(coords,coords[1:]):
  if a0!=b0:segments.append(LineString([a0,b0]))
coast=unary_union(ways).intersection(extent);split=unary_union([coast,extent.boundary]);parts=list(polygonize(split));tree=STRtree(segments)
land=[]
for part in parts:
 # Use an actual boundary segment with a tiny directed-side probe. Testing the
 # sign of the closest segment to an arbitrary interior representative can be
 # wrong at concave coast corners (Riou is a regression fixture for that case).
 choices=[]
 for ring in [part.exterior,*part.interiors]:
  coords=list(ring.coords)
  for aa,bb in zip(coords,coords[1:]):
   length=math.hypot(bb[0]-aa[0],bb[1]-aa[1]);mid=Point((aa[0]+bb[0])/2,(aa[1]+bb[1])/2)
   if length<.1:continue
   seg=segments[int(tree.nearest(mid))]
   if seg.distance(mid)>.005:continue
   choices.append((length,mid,seg))
 if not choices:continue
 _,q,seg=max(choices,key=lambda c:c[0]);aa,bb=list(seg.coords);dx,dz=bb[0]-aa[0],bb[1]-aa[1];length=math.hypot(dx,dz)
 # Land-right in xEast/zSouth coordinates.
 probe=Point(q.x+dz/length*.04,q.y-dx/length*.04)
 if part.covers(probe):land.append(part)

land=unary_union(land).buffer(0).simplify(2.0,preserve_topology=True)
polys=list(land.geoms) if hasattr(land,'geoms') else [land]
rings=[]
for poly in polys:
 if poly.area<2:continue
 rings.append({'outer':[[round(x,2),round(z,2)] for x,z in poly.exterior.coords], 'holes':[[[round(x,2),round(z,2)] for x,z in r.coords] for r in poly.interiors]})
# Tiles are triangulated from clipped vector polygons. Geographic distance to
# shore is retained so runtime height generation needs no expensive all-edge scan.
chunks={};step=80;chunk_size=480;shore_tree=STRtree([g for g in (list(coast.geoms) if hasattr(coast,'geoms') else [coast])])
for iz in range(math.floor(z0/step),math.ceil(z1/step)):
 for ix in range(math.floor(x0/step),math.ceil(x1/step)):
  cell=box(ix*step,iz*step,(ix+1)*step,(iz+1)*step)
  if not land.intersects(cell):continue
  clipped=land.intersection(cell);groups=list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]
  key=(math.floor(ix*step/chunk_size),math.floor(iz*step/chunk_size));chunk=chunks.setdefault(key,{'vertices':[],'triangles':[],'lookup':{}})
  for poly in groups:
   if poly.geom_type!='Polygon' or poly.area<.1:continue
   for tri in constrained_delaunay_triangles(poly).geoms:
    indices=[]
    for x,z in list(tri.exterior.coords)[:3]:
     vkey=(round(x,2),round(z,2));vi=chunk['lookup'].get(vkey)
     if vi is None:
      point=Point(x,z);nearest=shore_tree.geometries[int(shore_tree.nearest(point))];dist=point.distance(nearest);vi=len(chunk['vertices']);chunk['lookup'][vkey]=vi;chunk['vertices'].append([*vkey,round(dist,1)])
     indices.append(vi)
    if len(set(indices))==3:chunk['triangles'].append(indices)
result=[]
for key,chunk in chunks.items():
 if not chunk['triangles']:continue
 result.append({'cell':key,'v':chunk['vertices'],'t':chunk['triangles']})
named=[]
for way in source['elements']:
 name=way.get('tags',{}).get('name');coords=way.get('geometry',[])
 if not name or not coords:continue
 x,z=project(sum(q['lon'] for q in coords)/len(coords),sum(q['lat'] for q in coords)/len(coords))
 if extent.covers(Point(x,z)):named.append({'name':name,'x':round(x,1),'z':round(z,1),'osmWay':way['id']})
meta={'source':'OpenStreetMap coastline / Overpass','license':'ODbL-1.0','sourceSha256':hashlib.sha256(raw).hexdigest(),'origin':[lat0,lon0],'projection':'local equirectangular metres, x east / z south','bounds':{'minX':round(x0,2),'maxX':round(x1,2),'minZ':round(z0,2),'maxZ':round(z1,2)},'ways':len(ways),'polygons':len(rings),'triangles':sum(len(c['t']) for c in result),'elevation':'No measured elevations. Runtime procedural relief only.'}
data={'meta':meta,'land':rings,'chunks':result,'places':named}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text('/* OSM geographic vectors, ODbL. Generated by tools/prepare-coast.py. */\nglobalThis.RADE=globalThis.RADE||{};globalThis.RADE.coastData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n');print(json.dumps({**meta,'bytes':a.output.stat().st_size,'chunks':len(result)},indent=2))
# Known fixture coordinates taken from coastline centroids in this very dataset.
for name in ["Île d'If",'Riou','Ratonneau','Maïre']:
 candidates=[n for n in named if n['name']==name]
 print(name,[(n['x'],n['z'],land.covers(Point(n['x'],n['z']))) for n in candidates])

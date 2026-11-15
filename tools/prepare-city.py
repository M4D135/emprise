#!/usr/bin/env python3
"""Build Marseille's procedural city geometry from OpenStreetMap vector tiles.

Build-only dependencies: Shapely 2 and the Point de rupture MVT parser, supplied
with --parser. No model, image or texture is downloaded. The existing ±550 m
centre is left to core-data. Geometry is WGS84 local metres, x east / z south.

python tools/prepare-city.py --parser /path/to/point-de-rupture/Jeu/outils/plans/extraire.py

Input snapshots are cached outside the deliverable in work/tiles. A cached
TileJSON pins a dated tile release; --refresh explicitly selects a new release.
OSM geometry is tile-quantized (approximately 0.44 m here), not surveyed CAD.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import time
import urllib.request

from shapely import make_valid
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = (43.2962, 5.3734)
CHUNK = 512
CORE = box(-550, -550, 550, 550)
TILEJSON = "https://tiles.openfreemap.org/planet"
BOUNDARY = "https://geo.api.gouv.fr/communes/13055?format=geojson&geometry=contour"
AGENT = "EMPRISE-procedural-city-builder/1.0"
ATTRIBUTION = "© OpenStreetMap contributors, ODbL 1.0 — OpenFreeMap / OpenMapTiles. Commune boundary: API Découpage administratif, data.gouv.fr / IGN, Licence Ouverte 2.0."


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def fetch(url, path):
    if path.exists():
        return path.read_bytes()
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=55) as response:
                data = response.read()
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_bytes(data)
            tmp.replace(path)
            return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def members(geometry, kind):
    if geometry.is_empty:
        return
    if geometry.geom_type == kind:
        yield geometry
    elif hasattr(geometry, "geoms"):
        for g in geometry.geoms:
            yield from members(g, kind)


def q(value):
    result = round(float(value), 1)
    return int(result) if result.is_integer() else result


def points(coords, ring=False):
    out = []
    for x, z, *_ in coords:
        p = [q(x), q(z)]
        if not out or p != out[-1]:
            out.append(p)
    if ring and len(out) > 1 and out[-1] == out[0]:
        out.pop()
    return out


def rings(poly):
    return [points(poly.exterior.coords, True)] + [points(r.coords, True) for r in poly.interiors]


def encode(data):
    """Lossless decimetre varints, pooled labels, lazy per-cell JS decoding."""
    strings, string_ids = [""], {"": 0}
    def string_id(value):
        value = str(value or "")
        if value not in string_ids:
            string_ids[value] = len(strings)
            strings.append(value)
        return string_ids[value]
    packed = {}
    total_bytes = 0
    for key, tile in data["tiles"].items():
        ix, iz = map(int, key.split(","))
        blob = bytearray()
        def u(value):
            value = int(value)
            assert value >= 0
            while value > 127:
                blob.append((value & 127) | 128)
                value >>= 7
            blob.append(value)
        def signed(value):
            value = int(value)
            u(value * 2 if value >= 0 else -value * 2 - 1)
        def label(value):
            u(string_id(value))
        def line(coords):
            u(len(coords))
            px, pz = ix * CHUNK * 10, iz * CHUNK * 10
            for x, z in coords:
                x, z = round(x * 10), round(z * 10)
                signed(x - px)
                signed(z - pz)
                px, pz = x, z
        def polygon(parts):
            u(len(parts))
            for ring in parts:
                line(ring)
        u(len(tile["buildings"]))
        for b in tile["buildings"]:
            u(int(b["id"][1:]))
            signed(round(b["height"] * 10))
            signed(round(b["minHeight"] * 10))
            is_ign = b.get("heightSource") == "IGN BD TOPO"
            u(int(b["heightKnown"]) | (2 if is_ign else 0))
            label(b.get("colour"))
            if is_ign:
                u(int(b["heightRef"].removeprefix("BATIMENT")))
                signed(round(b.get("groundAltitude", -9999) * 10))
                signed(round(b.get("heightPrecision", -1) * 10))
                u(round(b.get("heightMatch", 0) * 1000))
                label(b.get("heightMethod"))
            polygon([b["points"], *b["holes"]])
        u(len(tile["roads"]))
        for r in tile["roads"]:
            u(int(r["id"][1:]))
            for field in ("class", "subclass", "name", "surface"):
                label(r.get(field))
            signed(r.get("layer", 0))
            signed(r.get("oneway", 0))
            u(int(r["bridge"]) | (int(r["tunnel"]) << 1))
            line(r["points"])
        for group in ("water", "green"):
            u(len(tile[group]))
            for p in tile[group]:
                u(int(p["id"][1:]))
                for field in ("class", "sourceLayer", "name"):
                    label(p.get(field))
                polygon(p["rings"])
        packed[key] = base64.b64encode(blob).decode("ascii")
        total_bytes += len(blob)
    metadata = {key: value for key, value in data.items() if key != "tiles"}
    metadata["source"]["encoding"] = "Lossless0.1m delta zigzag varints, string table, independently lazy-decoded512m chunks"
    metadata["stats"]["encodedBytes"] = total_bytes
    metadata["stats"]["pooledStrings"] = len(strings)
    decoder = r"""
const cache=new Map(),tiles={};
function decode(key){
 if(cache.has(key))return cache.get(key);
 const encoded=packed[key];if(encoded===undefined)return null;
 const raw=atob(encoded);let offset=0;
 const u=()=>{let n=0,m=1,b;do{b=raw.charCodeAt(offset++);n+=(b&127)*m;m*=128;}while(b&128);return n;};
 const s=()=>{const n=u();return n%2?-(n+1)/2:n/2;};
 const str=()=>strings[u()];
 const [ix,iz]=key.split(',').map(Number),bx=ix*5120,bz=iz*5120;
 const line=()=>{const n=u(),a=[];let x=bx,z=bz;for(let i=0;i<n;i++){x+=s();z+=s();a.push([x/10,z/10]);}return a;};
 const rings=()=>{const n=u(),a=[];for(let i=0;i<n;i++)a.push(line());return a;};
 const tile={bounds:[ix*512,iz*512,(ix+1)*512,(iz+1)*512],buildings:[],roads:[],water:[],green:[]};
 for(let n=u(),i=0;i<n;i++){
  const id='b'+u(),height=s()/10,minHeight=s()/10,flags=u(),heightKnown=!!(flags&1),colour=str();
  const provenance=flags&2?{heightSource:'IGN BD TOPO',heightRef:'BATIMENT'+String(u()).padStart(16,'0'),groundAltitude:s()/10,heightPrecision:s()/10,heightMatch:u()/1000,heightMethod:str()}:{};
  if(flags&2)provenance.heightQuality=provenance.heightMethod.toLowerCase().includes('interpolation')?'interpolated':'source-measured';
  const p=rings(),bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const [x,z]of p[0]){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],z);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],z);}
  const b={id,points:p[0],holes:p.slice(1),bounds,height,minHeight,heightKnown,...provenance};if(colour)b.colour=colour;tile.buildings.push(b);
 }
 for(let n=u(),i=0;i<n;i++){
  const id='r'+u(),cls=str(),subclass=str(),name=str(),surface=str(),layer=s(),oneway=s(),flags=u(),points=line();
  const r={id,points,class:cls,subclass,name,bridge:!!(flags&1),tunnel:!!(flags&2),layer,oneway};if(surface)r.surface=surface;tile.roads.push(r);
 }
 for(const group of ['water','green'])for(let n=u(),i=0;i<n;i++){
  const id=(group==='water'?'w':'g')+u(),cls=str(),sourceLayer=str(),name=str(),p=rings();
  const item={id,rings:p,class:cls,sourceLayer};if(name)item.name=name;tile[group].push(item);
 }
 if(offset!==raw.length)throw Error('Invalid city chunk '+key);
 cache.set(key,tile);return tile;
}
for(const key of Object.keys(packed))Object.defineProperty(tiles,key,{enumerable:true,get:()=>decode(key)});
data.tiles=tiles;data.decode=decode;data.release=key=>cache.delete(key);data.loaded=()=>cache.size;R.cityData=data;
"""
    return ("/* Generated by tools/prepare-city.py. Geographic data: " + ATTRIBUTION + " */\n"
            "(()=>{'use strict';const R=globalThis.RADE=globalThis.RADE||{};const data=" + compact(metadata)
            + ",strings=" + compact(strings) + ",packed=" + compact(packed) + ";\n" + decoder + "})();\n")


def run(args):
    spec = importlib.util.spec_from_file_location("pdr_mvt", args.parser)
    parser = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parser)
    selected = ("building", "transportation", "transportation_name", "water", "landcover", "landuse", "park")
    original_reader = parser.lire_tuile
    parser.lire_tuile = lambda data: original_reader(data, selected)
    cache = args.cache.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    manifest = cache / "city-tilejson.json"
    boundary_file = cache / "marseille-boundary.geojson"
    if args.refresh:
        for p in (manifest, boundary_file):
            p.unlink(missing_ok=True)
    tilejson_bytes = fetch(TILEJSON, manifest)
    tilejson = json.loads(tilejson_bytes)
    boundary_bytes = fetch(BOUNDARY, boundary_file)
    boundary_geojson = json.loads(boundary_bytes)
    proj = parser.Projection(*ORIGIN)
    commune = transform(lambda lon, lat, z=None: ((lon - ORIGIN[1]) * proj.kx, -(lat - ORIGIN[0]) * proj.kz), shape(boundary_geojson["geometry"]))
    commune = make_valid(commune)
    area = commune.difference(CORE)
    bounds = tuple(math.floor(v) if i < 2 else math.ceil(v) for i, v in enumerate(commune.bounds))
    version = tilejson["tiles"][0].split("/planet/")[-1].split("/")[0]
    snapshot = cache / version
    snapshot.mkdir(exist_ok=True)
    _, _, requests = parser.tuiles_utiles("marseille-city", ORIGIN, snapshot, zone=bounds)
    template = tilejson["tiles"][0]
    def download(item):
        tx, ty, path = item
        data = fetch(template.format(z=14, x=tx, y=ty), path)
        return {"tile": [14, tx, ty], "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    print(f"Fetching {len(requests)} tiles, max 3 workers, snapshot {version}", flush=True)
    receipts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for index, receipt in enumerate(pool.map(download, requests), 1):
            receipts.append(receipt)
            if index % 20 == 0 or index == len(requests):
                print(f"Tiles {index}/{len(requests)}", flush=True)
    _, raw, source_stats = parser.charger("marseille-city", ORIGIN, snapshot, zone=bounds, journal=lambda s: print(s, flush=True))
    print("Decoded features:", {k: len(v) for k, v in raw.items()}, flush=True)
    tiles = {}
    counts = {"buildings": 0, "roads": 0, "water": 0, "green": 0, "knownHeights": 0, "unknownHeights": 0, "coreBuildingsExcluded": 0}
    feature_id = 0
    def chunk(ix, iz):
        key = f"{ix},{iz}"
        if key not in tiles:
            tiles[key] = {"bounds": [ix * CHUNK, iz * CHUNK, (ix + 1) * CHUNK, (iz + 1) * CHUNK], "buildings": [], "roads": [], "water": [], "green": []}
        return tiles[key]
    def identity(kind, geometry):
        nonlocal feature_id
        feature_id += 1
        return f"{kind}{feature_id}"
    def split_grid(geometry, kind):
        x0, z0, x1, z1 = geometry.bounds
        for iz in range(math.floor(z0 / CHUNK), math.floor(z1 / CHUNK) + 1):
            for ix in range(math.floor(x0 / CHUNK), math.floor(x1 / CHUNK) + 1):
                clipped = geometry.intersection(box(ix * CHUNK, iz * CHUNK, (ix + 1) * CHUNK, (iz + 1) * CHUNK))
                for part in members(clipped, kind):
                    if part.area > .5 if kind == "Polygon" else part.length > .15:
                        yield ix, iz, part
    for attrs, poly in raw.get("building", []):
        geometry = make_valid(Polygon(poly[0], poly[1:]))
        for building in members(geometry, "Polygon"):
            if building.area < 1 or not commune.covers(building.representative_point()):
                continue
            if building.intersects(CORE):
                counts["coreBuildingsExcluded"] += 1
                continue
            height = float(attrs.get("render_height", 5))
            base = max(0, float(attrs.get("render_min_height", 0)))
            if height <= base or attrs.get("hide_3d"):
                continue
            known = "render_height" in attrs and not (height == 5 and base == 0)
            # OpenMapTiles' default 5 m cannot be distinguished from a measured 5 m.
            # Conservatively mark both unknown instead of claiming a surveyed height.
            center = building.centroid
            all_rings = rings(building)
            data = {"id": identity("b", building), "points": all_rings[0], "holes": all_rings[1:], "bounds": [q(v) for v in building.bounds], "height": q(height), "minHeight": q(base), "heightKnown": known}
            if attrs.get("colour"):
                data["colour"] = attrs["colour"]
            chunk(math.floor(center.x / CHUNK), math.floor(center.y / CHUNK))["buildings"].append(data)
            counts["buildings"] += 1
            counts["knownHeights" if known else "unknownHeights"] += 1
    print(f"Buildings: {counts['buildings']} outside the core", flush=True)
    # A name is transferred only from geometrically matching same-class road
    # labels. Roads without a safe match stay unnamed; no address is invented.
    name_lines, name_attrs = [], []
    for attrs, line in raw.get("transportation_name", []):
        if attrs.get("name") and len(line) >= 2:
            name_lines.append(LineString(line))
            name_attrs.append(attrs)
    name_tree = STRtree(name_lines) if name_lines else None
    for attrs, line in raw.get("transportation", []):
        if len(line) < 2 or attrs.get("indoor"):
            continue
        source_line = LineString(line)
        clipped = source_line.intersection(area)
        if clipped.is_empty:
            continue
        name = ""
        if name_tree:
            midpoint = source_line.interpolate(.5, normalized=True)
            candidates = name_tree.query(midpoint.buffer(4))
            matches = [(name_lines[int(i)].distance(midpoint), name_attrs[int(i)]["name"]) for i in candidates if name_attrs[int(i)].get("class") == attrs.get("class") and name_lines[int(i)].distance(midpoint) <= 2]
            if matches:
                name = min(matches)[1]
        source_id = identity("r", source_line)
        for part in members(clipped, "LineString"):
            for ix, iz, segment in split_grid(part, "LineString"):
                data = {"id": source_id, "points": points(segment.coords), "class": attrs.get("class", "minor"), "subclass": attrs.get("subclass", ""), "name": name, "bridge": attrs.get("brunnel") == "bridge", "tunnel": attrs.get("brunnel") == "tunnel", "layer": attrs.get("layer", 0), "oneway": attrs.get("oneway", 0)}
                if attrs.get("surface"):
                    data["surface"] = attrs["surface"]
                chunk(ix, iz)["roads"].append(data)
                counts["roads"] += 1
    print(f"Road segments: {counts['roads']}", flush=True)
    for layer, target in (("water", "water"), ("landcover", "green"), ("landuse", "green"), ("park", "green"), ("transportation_aire", "green")):
        for attrs, poly in raw.get(layer, []):
            if layer == "landuse" and attrs.get("class") not in {"grass", "forest", "park", "garden", "cemetery", "recreation_ground", "pitch", "playground", "beach", "village_green", "orchard", "vineyard", "farmland"}:
                continue
            geometry = make_valid(Polygon(poly[0], poly[1:])).intersection(area)
            if geometry.is_empty:
                continue
            source_id = identity("w" if target == "water" else "g", geometry)
            for part in members(geometry, "Polygon"):
                for ix, iz, section in split_grid(part, "Polygon"):
                    data = {"id": source_id, "rings": rings(section), "class": attrs.get("subclass") or attrs.get("class") or layer, "sourceLayer": layer}
                    if attrs.get("name"):
                        data["name"] = attrs["name"]
                    chunk(ix, iz)[target].append(data)
                    counts[target] += 1
        print(f"Layer {layer}: {counts[target]} {target} chunks", flush=True)
    ordered = dict(sorted(tiles.items(), key=lambda item: tuple(map(int, item[0].split(",")))))
    source = {"tileJSON": TILEJSON, "tileTemplate": template, "snapshot": version, "zoom": 14, "boundaryURL": BOUNDARY, "boundarySha256": hashlib.sha256(boundary_bytes).hexdigest(), "copyrightURL": "https://www.openstreetmap.org/copyright", "licence": "ODbL 1.0", "geometryPrecision": "Source zoom14 vector-tile geometry, local coordinates rounded to 0.1 m; no invented footprint or street.", "heightPolicy": "OpenMapTiles render_height. Default5m+base0 is conservatively unknown; all heights remain provider-derived, not survey-verified.", "projection": "WGS84 ellipsoid local east/south linear metres, origin43.2962N5.3734E", "corePolicy": "Any building overlapping ±550m core excluded. Roads, water and ground polygons clipped outside core; original core data unchanged.", "chunkPolicy": "Buildings owned by centroid chunk and retain full footprint/bounds. Other geometry clipped to512m cells. Load neighbouring cells for cross-boundary buildings."}
    stats = {**counts, "chunks": len(ordered), "sourceTiles": len(receipts), "sourceBytes": sum(r["bytes"] for r in receipts), "communeAreaKm2": round(commune.area / 1e6, 3)}
    data = {"origin": {"lat": ORIGIN[0], "lon": ORIGIN[1]}, "chunkSize": CHUNK, "bounds": list(bounds), "coreBounds": [-550, -550, 550, 550], "attribution": ATTRIBUTION, "source": source, "stats": stats, "tiles": ordered}
    output = encode(data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    report = {"source": source, "stats": stats, "outputBytes": len(output.encode()), "outputSha256": hashlib.sha256(output.encode()).hexdigest(), "parserSha256": hashlib.sha256(args.parser.read_bytes()).hexdigest(), "tileReceipts": receipts, "parserStats": source_stats}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"stats": stats, "outputBytes": report["outputBytes"], "output": str(args.output)}, indent=2), flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--parser", type=Path, default=Path("/Users/david/Projects/point-de-rupture/Jeu/outils/plans/extraire.py"))
    ap.add_argument("--cache", type=Path, default=ROOT.parents[1] / "work" / "tiles")
    ap.add_argument("--output", type=Path, default=ROOT / "src" / "city-data.js")
    ap.add_argument("--report", type=Path, default=ROOT / "docs" / "city-data-report.json")
    ap.add_argument("--refresh", action="store_true")
    run(ap.parse_args())

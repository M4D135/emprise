#!/usr/bin/env python3
"""Match the unchanged core PDR snapshot to the cached official IGN heights.

Run city-heights.py first. This writes a guarded override module, never edits
src/pdr/villes/marseille.js. Requires the same build-only Shapely2 and Node.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import subprocess
from shapely import make_valid
from shapely.geometry import Polygon, shape, box
from shapely.ops import transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]


def main(args):
    code = "import{pathToFileURL}from'node:url';await import(pathToFileURL(process.argv[1]).href);const p=PDR.plans.marseille;console.log(JSON.stringify({hash:p.empreinte,centre:p.centre,buildings:p.batiments.map(b=>({...b,points:Array.from(b.points),trous:b.trous.map(p=>Array.from(p))}))}));"
    original = json.loads(subprocess.check_output([args.node, "--input-type=module", "-e", code, str(ROOT / "src/pdr/villes/marseille.js")]))
    lat0, lon0 = original["centre"]["lat"], original["centre"]["lon"]
    earth, flattening = 6378137, 1 / 298.257223563
    e2 = flattening * (2 - flattening)
    w = math.sqrt(1 - e2 * math.sin(math.radians(lat0)) ** 2)
    kx = earth / w * math.cos(math.radians(lat0)) * math.pi / 180
    kz = earth * (1 - e2) / w**3 * math.pi / 180
    def local(lon, lat, z=None):
        return (lon - lon0) * kx, -(lat - lat0) * kz
    def pairs(flat):
        return list(zip(flat[::2], flat[1::2]))
    bounds = box(-650, -650, 650, 650)
    records, polygons = [], []
    seen = set()
    for page in sorted(args.cache.glob("page-*.geojson")):
        for feature in json.loads(page.read_bytes())["features"]:
            p = feature["properties"]
            ref, method, h = p.get("cleabs"), p.get("methode_d_acquisition_altimetrique") or "Unspecified", p.get("hauteur")
            if ref in seen or not isinstance(h, (int, float)) or not 0 < h < 1000 or p.get("etat_de_l_objet") != "En service" or any(word in method.casefold() for word in ["forfait", "impos", "estim", "inconn", "pas de z", "unspecified"]):
                continue
            seen.add(ref)
            geo = feature["geometry"]
            coords = geo["coordinates"]
            polys = coords if geo["type"] == "MultiPolygon" else [coords]
            outer = [pt for poly in polys for pt in poly[0]]
            if not outer:
                continue
            xs, zs = [(pt[0] - lon0) * kx for pt in outer], [-(pt[1] - lat0) * kz for pt in outer]
            if max(xs) < -650 or min(xs) > 650 or max(zs) < -650 or min(zs) > 650:
                continue
            g = make_valid(transform(local, shape(geo)))
            if g.area > 1 and g.intersects(bounds):
                records.append(p)
                polygons.append(g)
    index = STRtree(polygons)
    rows, rejection, methods = [], collections.Counter(), collections.Counter()
    total_area = known_area = new_area = 0
    original_known = 0
    for i, b in enumerate(original["buildings"]):
        osm = make_valid(Polygon(pairs(b["points"]), [pairs(p) for p in b["trous"]]))
        total_area += osm.area
        if b["connue"]:
            original_known += 1
            known_area += osm.area
            continue
        candidates = []
        if osm.area < 1:
            rejection["smallGeometry"] += 1
            continue
        for ix in index.query(osm):
            ix = int(ix)
            intersection = osm.intersection(polygons[ix]).area
            coverage = intersection / osm.area
            if coverage >= .2:
                candidates.append((intersection / (osm.area + polygons[ix].area - intersection), coverage, ix))
        candidates.sort(reverse=True)
        if not candidates or candidates[0][0] < .6 or candidates[0][1] < .8:
            rejection["noReliableMatch"] += 1
            continue
        score, coverage, ix = candidates[0]
        p = records[ix]
        if any(records[j]["cleabs"] != p["cleabs"] and cov >= .2 and abs(records[j]["hauteur"] - p["hauteur"]) > 2 for _, cov, j in candidates[1:]):
            rejection["ambiguousHeights"] += 1
            continue
        if p["hauteur"] <= b["base"] + .1:
            rejection["belowBase"] += 1
            continue
        method = p["methode_d_acquisition_altimetrique"]
        methods[method] += 1
        ground, precision = p.get("altitude_minimale_sol"), p.get("precision_altimetrique")
        rows.append([i, round(p["hauteur"], 1), p["cleabs"], round(ground, 1) if isinstance(ground, (float, int)) else -9999, round(precision, 1) if isinstance(precision, (float, int)) else -1, round(score, 3), method])
        new_area += osm.area
    report = {"originalCount": len(original["buildings"]), "originalKnown": original_known, "originalUnknown": len(original["buildings"]) - original_known, "matched": len(rows), "knownAfter": original_known + len(rows), "unknownAfter": len(original["buildings"]) - original_known - len(rows), "knownAreaFractionBefore": round(known_area / total_area, 4), "knownAreaFractionAfter": round((known_area + new_area) / total_area, 4), "methods": dict(methods), "rejections": dict(rejection), "planFingerprint": original["hash"], "source": "IGN BD TOPO WFS BDTOPO_V3:batiment", "licence": "Licence Ouverte 2.0", "coordinatesUnchanged": True, "groundApplied": False}
    source = """/* Generated by tools/core-heights.py. Heights: © IGN BD TOPO, Licence Ouverte2.0.
OSM/PDR footprints and original height values marked known are preserved. */
(function(R){'use strict';
const rows=ROWS,stats=STATS;
function apply(plan){
 if(!plan||plan.empreinte!==stats.planFingerprint||plan.batiments?.length!==stats.originalCount||plan.centre?.lat!==43.2962||plan.centre?.lon!==5.3734)return {applied:0,reason:'incompatible-plan'};
 let applied=0;
 for(const [i,height,ref,ground,precision,match,method]of rows){
  const b=plan.batiments[i];if(!b||b.connue||!Number.isFinite(b.base)||height<=b.base)continue;
  Object.assign(b,{hauteur:height,connue:true,heightSource:'IGN BD TOPO',heightRef:ref,groundAltitude:ground,heightPrecision:precision,heightMatch:match,heightMethod:method,heightQuality:method.toLowerCase().includes('interpolation')?'interpolated':'source-measured'});applied++;
 }
 if(Object.isExtensible(plan))plan.heightEnrichment={...stats};
 return {applied,known:plan.batiments.filter(b=>b.connue).length};
}
R.coreHeights={apply,stats};
})(globalThis.RADE=globalThis.RADE||{});
""".replace("ROWS", json.dumps(rows, ensure_ascii=False, separators=(",", ":"))).replace("STATS", json.dumps(report, ensure_ascii=False, separators=(",", ":")))
    output = ROOT / "src/core-heights.js"
    output.write_text(source)
    report.update(outputBytes=len(source.encode()), outputSha256=hashlib.sha256(source.encode()).hexdigest())
    (ROOT / "docs/core-height-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cache", type=Path, default=ROOT.parents[1] / "work/ign-buildings")
    ap.add_argument("--node", default="/Users/david/.local/node/bin/node")
    main(ap.parse_args())

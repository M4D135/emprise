#!/usr/bin/env python3
"""Enrich OSM city footprints with conservative IGN BD TOPO height matches.

Build-only: Shapely2, Node24 and prepare-city.py. Source geometry stays OSM.
Run after prepare-city.py. The WFS pages are cached under work/ign-buildings,
never bundled. Heights are gutter heights, not ridge heights or surveyed truth.
Measured ground altitude is retained as metadata, never applied to game ground.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import time
import urllib.parse
import urllib.request

from shapely import make_valid
from shapely.geometry import Polygon, shape
from shapely.ops import transform
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
URL = "https://data.geopf.fr/wfs/ows"
BBOX = "5.228751,43.169636,5.532543,43.391057,EPSG:4326"
FIELDS = "cleabs,hauteur,altitude_minimale_sol,methode_d_acquisition_altimetrique,precision_altimetrique,etat_de_l_objet,geometrie"
PAGE_SIZE = 2000


def download(cache, start):
    path = cache / f"page-{start:06d}.geojson"
    params = dict(service="WFS", version="2.0.0", request="GetFeature", typeNames="BDTOPO_V3:batiment", outputFormat="application/json", srsName="EPSG:4326", bbox=BBOX, count=PAGE_SIZE, startIndex=start, sortBy="cleabs", propertyName=FIELDS)
    if not path.exists():
        for retry in range(3):
            try:
                request = urllib.request.Request(URL + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "EMPRISE-geography-build/1.0"})
                with urllib.request.urlopen(request, timeout=90) as response:
                    data = response.read()
                decoded = json.loads(data)
                if not isinstance(decoded.get("features"), list):
                    raise ValueError("Not a GeoJSON FeatureCollection")
                temp = path.with_suffix(".tmp")
                temp.write_bytes(data)
                temp.replace(path)
                break
            except Exception:
                if retry == 2:
                    raise
                time.sleep(retry + 1)
    data = path.read_bytes()
    decoded = json.loads(data)
    return {"path": path.name, "startIndex": start, "count": len(decoded["features"]), "matched": decoded.get("numberMatched"), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "timestamp": decoded.get("timeStamp")}


def main(args):
    spec = importlib.util.spec_from_file_location("city_builder", ROOT / "tools" / "prepare-city.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    cache = args.cache.resolve()
    cache.mkdir(parents=True, exist_ok=True)
    first = download(cache, 0)
    total = int(first["matched"])
    assert first["count"] == min(PAGE_SIZE, total), first
    starts = list(range(PAGE_SIZE, total, PAGE_SIZE))
    receipts = [first]
    print(f"IGN WFS: {total} buildings, {len(starts)+1} pages, max3 workers", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for i, receipt in enumerate(pool.map(lambda start: download(cache, start), starts), 2):
            assert receipt["count"] == min(PAGE_SIZE, total - receipt["startIndex"]), receipt
            assert receipt["matched"] == total, "WFS changed during snapshot; retry from a fresh cache"
            receipts.append(receipt)
            if i % 10 == 0 or i == len(starts) + 1:
                print(f"IGN pages {i}/{len(starts)+1}", flush=True)
    if args.download_only:
        return
    # Decode one cell at a time, releasing its JS cache immediately. This avoids
    # creating the whole JS object graph at once just to feed the offline matcher.
    unpacked = cache / "city-before-heights.ndjson"
    code = """import fs from 'node:fs';import{pathToFileURL}from'node:url';await import(pathToFileURL(process.argv[1]).href);const d=RADE.cityData,{tiles,...meta}=d;fs.writeFileSync(process.argv[2],JSON.stringify(meta)+'\\n');for(const key of Object.keys(tiles)){fs.appendFileSync(process.argv[2],JSON.stringify([key,d.decode(key)])+'\\n');d.release(key);}"""
    subprocess.run([args.node, "--input-type=module", "-e", code, str(args.source.resolve()), str(unpacked)], check=True)
    with unpacked.open() as handle:
        data = json.loads(next(handle))
        data["tiles"] = dict(json.loads(line) for line in handle)
    origin = data["origin"]
    lat0, lon0 = origin["lat"], origin["lon"]
    earth, flattening = 6378137, 1 / 298.257223563
    eccentricity = flattening * (2 - flattening)
    w = math.sqrt(1 - eccentricity * math.sin(math.radians(lat0)) ** 2)
    kx = earth / w * math.cos(math.radians(lat0)) * math.pi / 180
    kz = earth * (1 - eccentricity) / w**3 * math.pi / 180
    def local(lon, lat, z=None):
        return (lon - lon0) * kx, -(lat - lat0) * kz
    polygons, records = [], []
    methods, rejections, source_seen = collections.Counter(), collections.Counter(), set()
    landmarks = []
    for page in receipts:
        for feature in json.loads((cache / page["path"]).read_bytes())["features"]:
            p = feature["properties"]
            identity = p.get("cleabs", "")
            if identity in source_seen:
                rejections["duplicateSourceId"] += 1
                continue
            source_seen.add(identity)
            method = p.get("methode_d_acquisition_altimetrique") or "Unspecified"
            methods[method] += 1
            height = p.get("hauteur")
            if not isinstance(height, (int, float)) or not math.isfinite(height) or not 0 < height < 1000:
                rejections["missingOrInvalidHeight"] += 1
                continue
            if any(word in method.casefold() for word in ["forfait", "impos", "estim", "inconn", "pas de z", "unspecified"]):
                rejections["nonMeasuredMethod"] += 1
                continue
            if p.get("etat_de_l_objet") != "En service":
                rejections["notInService"] += 1
                continue
            if not identity.startswith("BATIMENT") or not identity[8:].isdigit() or int(identity[8:]) > 2**53 - 1:
                rejections["unsupportedSourceId"] += 1
                continue
            geometry = make_valid(transform(local, shape(feature["geometry"])))
            if geometry.area < 1:
                rejections["emptyGeometry"] += 1
                continue
            p = {"id": identity, "height": height, "ground": p.get("altitude_minimale_sol"), "precision": p.get("precision_altimetrique"), "method": method}
            polygons.append(geometry)
            records.append(p)
            center = geometry.centroid
            lat, lon = lat0 - center.y / kz, lon0 + center.x / kx
            if abs(lat - 43.2840) < .0007 and abs(lon - 5.371) < .001:
                landmarks.append({**p, "lat": lat, "lon": lon, "area": round(geometry.area, 1)})
    print(f"IGN usable: {len(records)}, methods={dict(methods)}", flush=True)
    index = STRtree(polygons)
    matched = unchanged = considered = 0
    match_methods, height_histogram = collections.Counter(), collections.Counter()
    examples = []
    for number, (key, tile) in enumerate(data["tiles"].items(), 1):
        for building in tile["buildings"]:
            # Re-running against an enriched file re-evaluates the same original
            # unknown5m footprints, rather than silently discarding provenance.
            if building.get("heightSource") == "IGN BD TOPO":
                building.update(height=5, heightKnown=False)
                for field in ("heightSource", "heightRef", "heightMethod", "heightQuality", "heightMatch", "groundAltitude", "heightPrecision"):
                    building.pop(field, None)
            if building["heightKnown"]:
                unchanged += 1
                continue
            considered += 1
            osm = make_valid(Polygon(building["points"], building["holes"]))
            if osm.area < 1:
                rejections["degenerateQuantizedOSM"] += 1
                continue
            candidates = []
            for raw_i in index.query(osm):
                i = int(raw_i)
                ign = polygons[i]
                shared = osm.intersection(ign).area
                coverage = shared / osm.area
                if coverage < .2:
                    continue
                iou = shared / (osm.area + ign.area - shared)
                candidates.append((iou, coverage, i))
            candidates.sort(reverse=True)
            if not candidates or candidates[0][0] < .6 or candidates[0][1] < .8:
                rejections["noReliableFootprintMatch"] += 1
                continue
            score, coverage, i = candidates[0]
            source = records[i]
            if any(records[other]["id"] != source["id"] and cov >= .2 and abs(records[other]["height"] - source["height"]) > 2 for _, cov, other in candidates[1:]):
                rejections["ambiguousAdjacentHeights"] += 1
                continue
            if source["height"] <= building["minHeight"] + .1:
                rejections["heightBelowOSMBase"] += 1
                continue
            ground, precision = source["ground"], source["precision"]
            building.update(height=builder.q(source["height"]), heightKnown=True, heightSource="IGN BD TOPO", heightRef=source["id"], heightMethod=source["method"], heightQuality="interpolated" if "interpolation" in source["method"].casefold() else "source-measured", heightMatch=round(score, 3), groundAltitude=builder.q(ground) if isinstance(ground, (int, float)) and math.isfinite(ground) else -9999, heightPrecision=builder.q(precision) if isinstance(precision, (int, float)) and math.isfinite(precision) else -1)
            matched += 1
            match_methods[source["method"]] += 1
            height_histogram[str(int(source["height"] // 5) * 5)] += 1
            if len(examples) < 20 or score > .99 and source["height"] > 45:
                examples.append({"chunk": key, "building": building["id"], **source, "iou": round(score, 4), "osmCoverage": round(coverage, 4)})
        if number % 200 == 0:
            print(f"Matched {matched}/{considered}, chunks {number}/{len(data['tiles'])}", flush=True)
    height_source = {"name": "IGN BD TOPO", "url": URL, "typeName": "BDTOPO_V3:batiment", "licence": "Licence Ouverte 2.0", "licenceSource": "https://www.data.gouv.fr/datasets/bd-topo-r", "bbox": BBOX, "fields": FIELDS, "definition": "Height from lowest ground to highest gutter, not roof ridge. Source field hauteur; no derived or invented heights.", "matchPolicy": "Unknown OSM heights only. OSM intersection coverage>=0.80 and intersection/union>=0.60. Competing footprint with>=20% OSM coverage and height difference>2m rejected. Height must exceed retained OSM minHeight.", "uncertainty": "Source precision_altimetrique retained in metres; -1 means unspecified. Ground altitude retained as metadata only (-9999 unknown). Acquisition-method estimates/forced values rejected. Each matched footprint retains IGN cleabs reference. Geometry remains original OSM.", "firstPageTimestamp": receipts[0]["timestamp"], "lastPageTimestamp": receipts[-1]["timestamp"]}
    data["source"]["heightEnrichment"] = height_source
    if "Building heights: © IGN" not in data["attribution"]:
        data["attribution"] += " Building heights: © IGN BD TOPO, Licence Ouverte 2.0."
    known = sum(b["heightKnown"] for t in data["tiles"].values() for b in t["buildings"])
    interpolated = sum(b.get("heightQuality") == "interpolated" for t in data["tiles"].values() for b in t["buildings"])
    data["stats"].update(knownHeights=known, unknownHeights=data["stats"]["buildings"] - known, ignHeightMatches=matched, ignInterpolatedHeights=interpolated, ignSourceMeasuredHeights=matched-interpolated, ignMatchRate=round(matched / max(1, considered), 4), ignSourceBuildings=len(source_seen))
    output = builder.encode(data)
    temp = args.source.with_suffix(".js.tmp")
    temp.write_text(output)
    temp.replace(args.source)
    report = {"source": height_source, "stats": data["stats"], "consideredUnknown": considered, "existingKnownPreserved": unchanged, "rejections": dict(rejections), "sourceMethods": dict(methods), "matchedMethods": dict(match_methods), "heightHistogram5m": dict(height_histogram), "examples": examples, "notreDameCandidates": landmarks, "outputBytes": len(output.encode()), "outputSha256": hashlib.sha256(output.encode()).hexdigest(), "pages": receipts}
    (ROOT / "docs" / "city-height-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    existing_report = ROOT / "docs" / "city-data-report.json"
    original = json.loads(existing_report.read_text())
    original.update(source=data["source"], stats=data["stats"], outputBytes=report["outputBytes"], outputSha256=report["outputSha256"])
    existing_report.write_text(json.dumps(original, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"stats": data["stats"], "rejections": dict(rejections), "bytes": report["outputBytes"], "landmarks": landmarks}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cache", type=Path, default=ROOT.parents[1] / "work" / "ign-buildings")
    ap.add_argument("--source", type=Path, default=ROOT / "src" / "city-data.js")
    ap.add_argument("--node", default="/Users/david/.local/node/bin/node")
    ap.add_argument("--download-only", action="store_true")
    main(ap.parse_args())

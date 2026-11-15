#!/usr/bin/env python3
"""Build src/places-data.js from the offline OpenStreetMap snapshots.

The tool is deterministic: no clock, network, random seed or filesystem ordering
is used. It reads assets/places/osm-pois.json, optionally an OSM address
snapshot (assets/places/osm-addresses.json), and the BAN address snapshot that
is present in this repository (assets/places/ban-addresses.json).

OSM data © OpenStreetMap contributors, ODbL 1.0:
https://www.openstreetmap.org/copyright
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "places"
DEFAULT_OUTPUT = ROOT / "src" / "places-data.js"

ORIGIN_LAT = 43.2962
ORIGIN_LON = 5.3734
EARTH_RADIUS = 6378137.0
BOUNDS = 550.0
FLATTENING = 1 / 298.257223563
E2 = FLATTENING * (2 - FLATTENING)
W = math.sqrt(1 - E2 * math.sin(math.radians(ORIGIN_LAT)) ** 2)
KX = EARTH_RADIUS / W * math.cos(math.radians(ORIGIN_LAT)) * math.pi / 180
KZ = EARTH_RADIUS * (1 - E2) / W ** 3 * math.pi / 180
OSM_COPYRIGHT = "© OpenStreetMap contributors"
OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"
OSM_LICENCE = "ODbL 1.0"
BAN_DOCUMENTATION = (
    "https://cartes.gouv.fr/aide/fr/guides-utilisateur/"
    "utiliser-les-services-de-la-geoplateforme/geocodage/"
)

RESTAURANT_AMENITIES = {
    "restaurant", "fast_food", "cafe", "bar", "pub", "food_court", "ice_cream",
}
PUBLIC_AMENITIES = {
    "townhall", "library", "theatre", "cinema", "museum", "police",
    "fire_station", "hospital", "place_of_worship", "school",
    "bank", "post_office",
}
HOTEL_TOURISM = {"hotel", "hostel", "guest_house"}
GROCERY_SHOPS = {"supermarket", "convenience"}
GARAGE_SHOPS = {"car", "car_repair", "motorcycle"}

TAG_KEYS = {
    "amenity", "shop", "tourism", "office", "healthcare", "cuisine", "brand",
    "opening_hours", "website", "phone", "wheelchair", "takeaway",
    "outdoor_seating", "indoor_seating", "level", "building",
    "building:levels", "description", "operator", "network",
    "public_transport", "dispensing", "old_name",
}
TAG_PREFIXES = ("addr:", "contact:")

GENERIC_ROAD = re.compile(
    r"^(rue|avenue|boulevard|cours|quai|place|traverse|impasse|all[ée]e|"
    r"chemin|mont[ée]e|route|square|esplanade|corniche|passage|rond-point)$",
    re.IGNORECASE,
)

OFFICIAL = {
    "node/8731323039": {
        "checked": "2026-11-15",
        "override": True,
        "sourceURL": "https://www.carrefour.fr/magasin/city-marseille-sainte",
        "address": "87 Rue Sainte, Marseille",
        "website": "https://www.carrefour.fr/magasin/city-marseille-sainte",
        "fields": ["address", "website"],
    },
    "node/9697856682": {
        "checked": "2026-11-15",
        "override": True,
        "sourceURL": "https://shawarmaxfrance.fr/",
        "address": "32 Rue Caisserie, Marseille",
        "website": "https://shawarmaxfrance.fr/",
        "fields": ["address", "website"],
    },
    "node/6967474368": {
        "checked": "2026-11-15",
        "override": True,
        "sourceURL": "https://www.carrefour.fr/magasin/market-marseille-centre-bourse",
        "address": "28 Rue Bir Hakeim, 13001 Marseille",
        "website": "https://www.carrefour.fr/magasin/market-marseille-centre-bourse",
        "fields": ["address"],
        "note": (
            "OSM has addr:housenumber=28 without a street; the official "
            "Carrefour page supplies the full address. Declared override."
        ),
    },
}

OFFICIAL_CHECKS = [
    {
        "osm": "node/8731323039",
        "name": "Carrefour City",
        "officialAddress": "87 Rue Sainte",
        "sourceURL": "https://www.carrefour.fr/magasin/city-marseille-sainte",
        "checked": "2026-11-15",
        "status": "verified; outside ±325 m, not relocated",
    },
    {
        "osm": "node/9697856682",
        "name": "Shawarmax",
        "officialAddress": "32 Rue Caisserie",
        "sourceURL": "https://shawarmaxfrance.fr/",
        "checked": "2026-11-15",
        "status": "verified; outside ±325 m, not relocated",
    },
    {
        "osm": "node/6967474368",
        "name": "Carrefour Market",
        "officialAddress": "28 Rue Bir Hakeim, 13001 Marseille",
        "sourceURL": "https://www.carrefour.fr/magasin/market-marseille-centre-bourse",
        "checked": "2026-11-15",
        "status": "verified; OSM has 28 without a street, official address kept as declared override",
    },
    {
        "name": "Istanbul Grill",
        "officialAddress": "132 Quai du Port",
        "status": (
            "No matching OSM entity in the snapshot; no source coordinate was "
            "fabricated and no place was added."
        ),
    },
]


def rounded(value: float) -> float:
    """Round to 0.01 m, away from zero on exact halves, independent of locale."""
    scaled = abs(value) * 100.0
    result = math.floor(scaled + 0.5) / 100.0
    return result if value >= 0 else -result


def rounded_geo(value: float) -> float:
    """Keep geographic coordinates readable without losing address precision."""
    return float(f"{value:.7f}")


def project(lat: float, lon: float) -> tuple[float, float]:
    """Local tangent-plane approximation used by the game, in metres."""
    x = (lon - ORIGIN_LON) * KX
    z = -(lat - ORIGIN_LAT) * KZ
    return rounded(x), rounded(z)


def in_bounds(x: float, z: float) -> bool:
    return abs(x) <= BOUNDS and abs(z) <= BOUNDS


def tags_of(element: dict) -> dict:
    return element.get("tags") or {}


def coordinates(element: dict) -> tuple[float, float]:
    if "lat" in element and "lon" in element:
        return float(element["lat"]), float(element["lon"])
    center = element.get("center")
    if center:
        return float(center["lat"]), float(center["lon"])
    bounds = element.get("bounds")
    if bounds:
        return (
            (float(bounds["minlat"]) + float(bounds["maxlat"])) / 2.0,
            (float(bounds["minlon"]) + float(bounds["maxlon"])) / 2.0,
        )
    raise ValueError(f"element {element.get('type')}/{element.get('id')} has no coordinates")


def osm_url(element: dict) -> str:
    return f"https://www.openstreetmap.org/{element['type']}/{element['id']}"


def selected_tags(tags: dict) -> dict:
    keep = {}
    for key, value in tags.items():
        if key in TAG_KEYS or key.startswith(TAG_PREFIXES):
            keep[key] = value
    return {key: keep[key] for key in sorted(keep)}


def kind_of(tags: dict) -> str:
    for key in ("amenity", "shop", "tourism", "office", "healthcare"):
        value = tags.get(key)
        if value:
            return value
    return "unknown"


def classify(tags: dict) -> str | None:
    amenity = tags.get("amenity")
    shop = tags.get("shop")
    tourism = tags.get("tourism")

    if amenity in RESTAURANT_AMENITIES:
        return "restaurant"
    if shop in GROCERY_SHOPS:
        return "supermarche"
    if tourism == "apartment":
        return "logement"
    if tourism in HOTEL_TOURISM:
        return "hotel"
    if shop in GARAGE_SHOPS:
        return "garage"
    if shop == "weapons":
        return "armurerie"
    if shop:
        return "commerce"
    if tags.get("office"):
        return "bureau"
    if amenity in PUBLIC_AMENITIES:
        return "public"
    if tourism == "museum":
        return "public"
    if amenity == "internet_cafe":
        return "commerce"
    if amenity == "pharmacy" or tags.get("healthcare") == "pharmacy":
        return "commerce"
    return None


def services_for(category: str, tags: dict) -> list[str]:
    amenity = tags.get("amenity")
    shop = tags.get("shop")
    if amenity in RESTAURANT_AMENITIES:
        return ["food"]
    if shop in GROCERY_SHOPS:
        return ["food", "supplies"]
    if amenity == "pharmacy" or tags.get("healthcare") == "pharmacy":
        return ["medical"]
    if shop in GARAGE_SHOPS:
        return ["repair"]
    if shop == "weapons":
        return ["weapons"]
    if shop or category == "commerce":
        return ["supplies"]
    return []


def exclusion_reason(tags: dict, name: str) -> str | None:
    shop = tags.get("shop")
    if shop in {"vacant", "closed"} or tags.get("opening_hours") == "closed":
        return "closed"
    if any(
        key in {"disused", "abandoned", "was", "construction"}
        or key.startswith(("disused:", "abandoned:", "was:", "construction:"))
        for key in tags
    ):
        return "closed"
    if not name:
        return "unnamed"
    street = (tags.get("addr:street") or tags.get("contact:street") or "").strip()
    if name and (name.casefold() == street.casefold() or GENERIC_ROAD.fullmatch(name)):
        return "generic-road-name"
    if classify(tags) is None:
        return "unsupported"
    return None


def address_components(tags: dict, prefix: str) -> dict:
    return {
        key: (tags.get(f"{prefix}:{key}") or "").strip()
        for key in ("housenumber", "street", "place", "city", "postcode")
    }


def has_full_address(parts: dict) -> bool:
    return bool(parts.get("housenumber") and (parts.get("street") or parts.get("place")))


def has_street(parts: dict) -> bool:
    return bool(parts.get("street") or parts.get("place"))


def address_label(parts: dict) -> str:
    housenumber = parts.get("housenumber", "")
    street = parts.get("street") or parts.get("place") or ""
    first = f"{housenumber} {street}".strip() if housenumber else street
    tail = " ".join(value for value in (parts.get("postcode"), parts.get("city")) if value)
    label = " ".join(value for value in (first, tail) if value).strip()
    return label or "Adresse non renseignée"


def compose_address(tags: dict, source_url: str) -> dict:
    """Use only direct addr:* or contact:* components, never inferred values."""
    addr = address_components(tags, "addr")
    contact = address_components(tags, "contact")

    if has_full_address(addr):
        parts, namespace, confidence = addr, "addr", "osm-address"
    elif has_full_address(contact):
        parts, namespace, confidence = contact, "contact", "osm-address"
    elif has_street(addr):
        parts, namespace, confidence = addr, "addr", "osm-street"
    elif has_street(contact):
        parts, namespace, confidence = contact, "contact", "osm-street"
    else:
        parts, namespace, confidence = {"housenumber": "", "street": "", "place": "",
                                        "city": "", "postcode": ""}, None, "unknown"

    label = address_label(parts)
    raw = {
        f"{namespace}:{key}": value
        for key, value in parts.items()
        if namespace and value
    }
    return {
        "label": label,
        "confidence": confidence,
        "source": namespace,
        "housenumber": parts.get("housenumber") or None,
        "street": parts.get("street") or None,
        "place": parts.get("place") or None,
        "city": parts.get("city") or None,
        "postcode": parts.get("postcode") or None,
        "raw": raw,
        "sourceURL": source_url,
    }


def make_place(element: dict) -> dict:
    tags = tags_of(element)
    name = (tags.get("name") or "").strip()
    lat, lon = coordinates(element)
    x, z = project(lat, lon)
    category = classify(tags)
    reason = exclusion_reason(tags, name)
    place_id = f"{element['type']}/{element['id']}"
    kind = kind_of(tags)
    source_url = osm_url(element)

    base = {
        "id": place_id,
        "osmType": element["type"],
        "osmId": element["id"],
        "name": name or None,
        "type": category,
        "kind": kind,
        "lat": rounded_geo(lat),
        "lon": rounded_geo(lon),
        "x": x,
        "z": z,
        "inBounds": in_bounds(x, z),
        "eligible": reason is None,
        "excludeReason": reason,
        "sourceURL": source_url,
    }

    if reason is not None:
        return {"source": base, "place": None}

    place = dict(base)
    place["services"] = services_for(category, tags)
    place["cuisine"] = tags.get("cuisine")
    place["sourceUrl"] = source_url
    place["shop"] = category in {"restaurant", "supermarche", "garage", "armurerie", "commerce"}
    address = compose_address(tags, source_url)
    place["address"] = address["label"]
    place["addressDetail"] = address
    place["tags"] = selected_tags(tags)

    official = OFFICIAL.get(place_id)
    if official:
        place["official"] = dict(official)
        if official.get("website") and not place["tags"].get("website"):
            place["tags"]["website"] = official["website"]
            if "website" not in place["official"].get("fields", []):
                place["official"]["fields"] = list(place["official"].get("fields", [])) + ["website"]
    return {"source": base, "place": place}


def parse_osm_addresses(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    elements = payload.get("elements", payload if isinstance(payload, list) else [])
    addresses = []
    for element in elements:
        tags = tags_of(element)
        addr = address_components(tags, "addr")
        contact = address_components(tags, "contact")
        parts = addr if has_full_address(addr) else contact
        if not has_full_address(parts):
            continue
        lat, lon = coordinates(element)
        x, z = project(lat, lon)
        label = address_label(parts)
        addresses.append({
            "id": f"osm-address-{element['type']}-{element['id']}",
            "source": "osm",
            "sourceURL": osm_url(element),
            "licence": OSM_LICENCE,
            "label": label,
            "housenumber": parts.get("housenumber") or None,
            "street": parts.get("street") or parts.get("place") or None,
            "city": parts.get("city") or None,
            "postcode": parts.get("postcode") or None,
            "lat": rounded_geo(lat),
            "lon": rounded_geo(lon),
            "x": x,
            "z": z,
            "inBounds": in_bounds(x, z),
            "confidence": "osm-address",
        })
    return addresses


def parse_ban_addresses(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    addresses = []
    for feature in payload.get("features", []):
        properties = feature.get("properties") or {}
        if properties.get("type") != "housenumber":
            continue
        housenumber = (properties.get("housenumber") or "").strip()
        street = (properties.get("street") or "").strip()
        if not housenumber or not street:
            continue
        lon, lat = feature["geometry"]["coordinates"][:2]
        x, z = project(float(lat), float(lon))
        label = (properties.get("label") or "").strip() or address_label({
            "housenumber": housenumber,
            "street": street,
            "city": properties.get("city") or "",
            "postcode": properties.get("postcode") or "",
        })
        addresses.append({
            "id": f"ban-address-{properties.get('id') or properties.get('banId')}",
            "source": "ban",
            "sourceURL": feature.get("sourceUrl") or BAN_DOCUMENTATION,
            "licence": "Licence Ouverte 2.0",
            "label": label,
            "housenumber": housenumber,
            "street": street,
            "city": properties.get("city") or None,
            "postcode": properties.get("postcode") or None,
            "lat": rounded_geo(float(lat)),
            "lon": rounded_geo(float(lon)),
            "x": x,
            "z": z,
            "inBounds": in_bounds(x, z),
            "confidence": "official-address",
            "override": True,
            "overrideReason": "Actual BAN address point, not inferred from a place",
        })
    return addresses


def load_addresses() -> tuple[list[dict], dict | None]:
    osm_path = ASSETS / "osm-addresses.json"
    ban_path = ASSETS / "ban-addresses.json"
    if osm_path.exists():
        addresses = parse_osm_addresses(osm_path)
        return addresses, {
            "id": "osm-addresses",
            "file": str(osm_path.relative_to(ROOT)),
            "licence": OSM_LICENCE,
            "copyrightURL": OSM_COPYRIGHT_URL,
            "count": len(addresses),
        }
    if ban_path.exists():
        addresses = parse_ban_addresses(ban_path)
        payload = json.loads(ban_path.read_text(encoding="utf-8"))
        return addresses, {
            "id": "ban-addresses",
            "file": str(ban_path.relative_to(ROOT)),
            "retrievedAt": payload.get("retrievedAt"),
            "source": payload.get("source"),
            "licence": payload.get("licence"),
            "documentationURL": payload.get("documentationUrl") or BAN_DOCUMENTATION,
            "queryCount": len(payload.get("queries") or []),
            "count": len(addresses),
        }
    return [], None


def counts_for(places: list[dict], source_places: list[dict], addresses: list[dict],
               address_source: dict | None) -> dict:
    active = [record for record in source_places if record["eligible"]]
    excluded = [record for record in source_places if not record["eligible"]]
    in_bounds_places = [place for place in places if place["inBounds"]]
    by_type: dict[str, int] = {}
    by_type_in_bounds: dict[str, int] = {}
    for place in places:
        by_type[place["type"]] = by_type.get(place["type"], 0) + 1
    for place in in_bounds_places:
        by_type_in_bounds[place["type"]] = by_type_in_bounds.get(place["type"], 0) + 1
    excluded_reasons: dict[str, int] = {}
    for record in excluded:
        reason = record["excludeReason"] or "unknown"
        excluded_reasons[reason] = excluded_reasons.get(reason, 0) + 1
    full_addresses = [address for address in addresses if address.get("housenumber")]
    return {
        "sourceElements": len(source_places),
        "activePlaces": len(active),
        "excludedPlaces": len(excluded),
        "activeInBounds": len(in_bounds_places),
        "activeOutOfBounds": len(active) - len(in_bounds_places),
        "placedByType": dict(sorted(by_type.items())),
        "placedByTypeInBounds": dict(sorted(by_type_in_bounds.items())),
        "excludedByReason": dict(sorted(excluded_reasons.items())),
        "addressSource": (address_source or {}).get("id"),
        "addressPoints": len(addresses),
        "addressPointsInBounds": sum(1 for address in addresses if address["inBounds"]),
        "fullAddressPoints": len(full_addresses),
        "fullAddressPointsInBounds": sum(1 for address in full_addresses if address["inBounds"]),
    }


def build() -> dict:
    pois_path = ASSETS / "osm-pois.json"
    payload = json.loads(pois_path.read_text(encoding="utf-8"))
    elements = payload.get("elements") or []
    if not elements:
        raise SystemExit(f"no OSM elements in {pois_path}")

    source_places = []
    places = []
    for element in elements:
        record = make_place(element)
        source_places.append(record["source"])
        if record["place"] is not None:
            places.append(record["place"])

    # Official checks enrich labels only; all coordinates remain original OSM points.
    official_snapshot = json.loads((ASSETS / "official-checks.json").read_text(encoding="utf-8"))
    checks = {q["osmId"]: q for q in official_snapshot["checks"] if q.get("osmId")}
    for place in places:
        check = checks.get(place["id"])
        if not check:
            continue
        label = " ".join(filter(None, [check.get("number"), check.get("street"), check.get("postcode"), check.get("city")]))
        place["address"] = label
        place["addressDetail"] = {
            "label": label, "confidence": "official-address", "source": "official-website",
            "housenumber": check.get("number"), "street": check.get("street"),
            "postcode": check.get("postcode"), "city": check.get("city"),
            "sourceURL": check["sourceUrl"], "sourceUrl": check["sourceUrl"],
            "checkedAt": official_snapshot["checkedAt"], "override": True,
        }
        place["official"] = {"address": label, "override": True, "sourceURL": check["sourceUrl"], "checkedAt": official_snapshot["checkedAt"]}
    addresses, address_source = load_addresses()
    counts = counts_for(places, source_places, addresses, address_source)

    timestamp = (payload.get("osm3s") or {}).get("timestamp_osm_base")
    bbox = (payload.get("osm3s") or {}).get("bbox") or "43.2907,5.3666,43.3017,5.3802"
    sources = [{
        "id": "osm-pois",
        "name": "OpenStreetMap POI snapshot",
        "file": str(pois_path.relative_to(ROOT)),
        "sourceURL": "https://www.openstreetmap.org/",
        "copyright": OSM_COPYRIGHT,
        "copyrightURL": OSM_COPYRIGHT_URL,
        "licence": OSM_LICENCE,
        "timestamp": timestamp,
        "bbox": bbox,
        "query": "Overpass POIs in bbox 43.2907,5.3666,43.3017,5.3802",
        "elementCount": len(elements),
        "generator": payload.get("generator"),
    }]
    if address_source:
        sources.append(address_source)

    metadata = {
        "schema": "rade-places/1",
        "generator": "tools/prepare-places.py",
        "deterministic": True,
        "sources": sources,
        "sourceTimestamp": timestamp,
        "bbox": bbox,
        "query": {
            "description": "Overpass POIs in the bbox below; frozen snapshot committed with the game",
            "bbox": bbox,
            "timestamp": timestamp,
        },
        "attribution": f"{OSM_COPYRIGHT} · {OSM_LICENCE} · {OSM_COPYRIGHT_URL}",
        "projection": {
            "originLat": ORIGIN_LAT,
            "originLon": ORIGIN_LON,
            "earthRadius": EARTH_RADIUS,
            "kx": KX, "kz": KZ,
            "source": "Point de rupture/Jeu/outils/plans/extraire.py:Projection",
            "units": "metres",
            "xAxis": "east",
            "zAxis": "south",
            "approximation": (
                "Same WGS84 ellipsoidal local scale as source city extractor: "
                "x=(lon-originLon)*kx; z=-(lat-originLat)*kz. "
                "kx=N0*cos(lat0)*PI/180; kz=M0*PI/180."
            ),
            "rounding": 0.01,
        },
        "bounds": {
            "minX": -BOUNDS,
            "maxX": BOUNDS,
            "minZ": -BOUNDS,
            "maxZ": BOUNDS,
            "rule": "Default ±550 m; assignment uses supplied world.bounds dynamically; no relocation",
        },
        "addressRules": {
            "sources": ["addr:*", "contact:*"],
            "confidence": ["osm-address", "osm-street", "official-address", "unknown"],
            "missingLabel": "Adresse non renseignée",
            "note": (
                "A partial street never receives an invented number. addr:city "
                "does not imply a postcode. BAN points are official actual "
                "address points, declared with override and sourceURL; they are "
                "never inferred from a nearby establishment."
            ),
        },
        "counts": counts,
        "officialChecks": OFFICIAL_CHECKS,
        "interiors": {
            "layout": "fictional",
            "note": (
                "Place names and geographic coordinates come from the OSM "
                "snapshot; the interiors' room layout is fictional and is not "
                "surveyed OSM geometry."
            ),
        },
    }

    return {
        "metadata": metadata,
        "places": places,
        "addresses": addresses,
        "sourcePlaces": source_places,
        "excluded": [record for record in source_places if not record["eligible"]],
    }


def render(data: dict) -> str:
    header = (
        "/* Generated by tools/prepare-places.py — do not edit by hand.\n"
        "   " + OSM_COPYRIGHT + " · " + OSM_LICENCE + " · " + OSM_COPYRIGHT_URL + "\n"
        "   Deterministic offline build; source snapshot date is in metadata. */\n"
    )
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return header + "(globalThis.RADE=globalThis.RADE||{}).placesData=" + body + ";\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help=f"output JS file (default: {DEFAULT_OUTPUT})")
    args = parser.parse_args()
    data = build()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render(data), encoding="utf-8")
    counts = data["metadata"]["counts"]
    print(
        f"{args.output}: {counts['activePlaces']} active places "
        f"({counts['activeInBounds']} in bounds), "
        f"{counts['excludedPlaces']} excluded, "
        f"{counts['fullAddressPointsInBounds']} full in-bounds address points"
    )


if __name__ == "__main__":
    main()

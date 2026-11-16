/* RADE — real geospatial places (OSM names/coordinates) matched to urban footprints.
   This module never invents a building address and never moves a place to fit the city.
   Data: © OpenStreetMap contributors · ODbL 1.0 · https://www.openstreetmap.org/copyright */
(function (G) {
  'use strict';
  const R = G.RADE = G.RADE || {};
  const DEFAULT_ORIGIN_LAT = 43.2962;
  const DEFAULT_ORIGIN_LON = 5.3734;
  const DEFAULT_RADIUS = 6378137;
  const DEFAULT_BOUNDS = 550;
  const TOLERANCE = 0.3; // small allowance for quantized/simplified source footprints
  const UNKNOWN_ADDRESS = 'Adresse non renseignée';
  const EMPTY = Object.freeze({ metadata: {}, places: [], addresses: [] });

  const data = () => R.placesData || EMPTY;
  const finite = value => typeof value === 'number' && Number.isFinite(value);

  // Fictional presentation only. Raw geodata, IDs, URLs and attribution stay intact.
  function displayLabel(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/marseill(?:aises|aise|ais|e)/gi, word => {
      const label = ({marseille:'Seille',marseillais:'Local',marseillaise:'Locale',marseillaises:'Locales'})[word.toLowerCase()];
      return word === word.toUpperCase() ? label.toUpperCase() : word[0] === word[0].toLowerCase() ? label.toLowerCase() : label;
    });
  }

  function round2(value) {
    const sign = value < 0 ? -1 : 1;
    return sign * Math.floor(Math.abs(value) * 100 + 0.5) / 100;
  }

  function projectionMeta() {
    return (data().metadata && data().metadata.projection) || {};
  }

  function boundsLimit() {
    const bounds = (data().metadata && data().metadata.bounds) || {};
    return finite(bounds.maxX) ? Math.min(Math.abs(bounds.maxX), Math.abs(bounds.minX)) : DEFAULT_BOUNDS;
  }

  function scales() {
    const meta = projectionMeta(), lat = finite(meta.originLat) ? meta.originLat : DEFAULT_ORIGIN_LAT;
    const a = DEFAULT_RADIUS, f = 1 / 298.257223563, e2 = f * (2 - f), w = Math.sqrt(1 - e2 * Math.sin(lat * Math.PI / 180) ** 2);
    return { kx: finite(meta.kx) ? meta.kx : a / w * Math.cos(lat * Math.PI / 180) * Math.PI / 180,
      kz: finite(meta.kz) ? meta.kz : a * (1 - e2) / w ** 3 * Math.PI / 180 };
  }
  function project(lat, lon) {
    const meta = projectionMeta(), scale = scales();
    return { x: round2((lon - (meta.originLon ?? DEFAULT_ORIGIN_LON)) * scale.kx),
      z: round2(-(lat - (meta.originLat ?? DEFAULT_ORIGIN_LAT)) * scale.kz) };
  }
  function unproject(x, z) {
    const meta = projectionMeta(), scale = scales();
    return { lat: (meta.originLat ?? DEFAULT_ORIGIN_LAT) - z / scale.kz,
      lon: (meta.originLon ?? DEFAULT_ORIGIN_LON) + x / scale.kx };
  }
  function effectiveBounds(world) {
    const b = world?.bounds || data().metadata?.bounds;
    if (b && ['minX','maxX','minZ','maxZ'].every(k => finite(b[k]))) return b;
    return { minX:-DEFAULT_BOUNDS, maxX:DEFAULT_BOUNDS, minZ:-DEFAULT_BOUNDS, maxZ:DEFAULT_BOUNDS };
  }
  function inBounds(x, z, world) {
    const b = effectiveBounds(world);
    return finite(x) && finite(z) && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }
  function isInBounds(place, world) {
    return !!place && inBounds(place.x, place.z, world);
  }

  /** Oriented-box test. cap = -lacet, as required by the city footprint contract. */
  function contains(box, x, z, tolerance) {
    if (!box) return false;
    const tol = tolerance === undefined ? 0 : tolerance;
    const cap = -(box.lacet || 0);
    const c = Math.cos(cap), s = Math.sin(cap);
    const dx = x - box.x, dz = z - box.z;
    const u = dx * c + dz * s;
    const v = -dx * s + dz * c;
    const hx = Math.abs(box.lx || 0) / 2;
    const hz = Math.abs(box.lz || 0) / 2;
    const eps = 1e-9;
    return Math.abs(u) <= hx + tol + eps && Math.abs(v) <= hz + tol + eps;
  }

  function containsEntry(entry, x, z, tolerance) {
    const boxes = entry && entry.boxes;
    if (!Array.isArray(boxes)) return false;
    for (const box of boxes) if (contains(box, x, z, tolerance)) return true;
    return false;
  }

  function boxScore(box, x, z, tolerance) {
    if (!contains(box, x, z, tolerance)) return null;
    const cap = -(box.lacet || 0);
    const c = Math.cos(cap), s = Math.sin(cap);
    const dx = x - box.x, dz = z - box.z;
    const u = dx * c + dz * s;
    const v = -dx * s + dz * c;
    const hx = Math.max(Math.abs(box.lx || 0) / 2, 1e-9);
    const hz = Math.max(Math.abs(box.lz || 0) / 2, 1e-9);
    const nu = u / hx, nv = v / hz;
    return {
      distance: nu * nu + nv * nv,
      area: Math.abs((box.lx || 0) * (box.lz || 0)),
      u,
      v,
      hx,
      hz,
      box,
    };
  }

  function betterScore(candidate, best) {
    if (!best) return true;
    if (candidate.distance < best.distance - 1e-12) return true;
    if (Math.abs(candidate.distance - best.distance) <= 1e-12) {
      if (candidate.area < best.area - 1e-12) return true;
      if (Math.abs(candidate.area - best.area) <= 1e-12) return candidate.order < best.order;
    }
    return false;
  }

  function bestContaining(boxRecords, x, z) {
    let best = null;
    for (const record of boxRecords) {
      const score = boxScore(record.box, x, z, TOLERANCE);
      if (!score) continue;
      const candidate = {
        entry: record.entry,
        entryIndex: record.entryIndex,
        box: record.box,
        boxIndex: record.boxIndex,
        distance: score.distance,
        area: score.area,
        u: score.u,
        v: score.v,
        hx: score.hx,
        hz: score.hz,
        order: record.order,
      };
      if (betterScore(candidate, best)) best = candidate;
    }
    return best;
  }

  function boxRecords(entries) {
    const records = [];
    let order = 0;
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      const entry = entries[entryIndex];
      if (!entry || !Array.isArray(entry.boxes)) continue;
      for (let boxIndex = 0; boxIndex < entry.boxes.length; boxIndex++) {
        records.push({ entry, entryIndex, box: entry.boxes[boxIndex], boxIndex, order: order++ });
      }
    }
    return records;
  }

  function isFullAddress(address) {
    return !!address && !!address.housenumber && !!address.street &&
      (address.confidence === 'osm-address' || address.confidence === 'official-address');
  }

  function summarize(entries, matches, statsAddress, world) {
    const places = data().places || [];
    const inBoundsPlaces = places.filter(place => isInBounds(place, world));
    const matchedIds = new Set(matches.map(match => match.place && match.place.id));
    const matchedByType = {};
    const unmatchedInBounds = [];
    for (const place of inBoundsPlaces) {
      if (matchedIds.has(place.id)) {
        const type = place.type || 'unknown';
        matchedByType[type] = (matchedByType[type] || 0) + 1;
      } else {
        unmatchedInBounds.push({
          id: place.id,
          name: place.name || null,
          type: place.type || 'unknown',
          kind: place.kind || 'unknown',
          x: place.x,
          z: place.z,
        });
      }
    }
    const entriesWithPlaces = entries.filter(entry => entry.places && entry.places.length > 0);
    const entriesWithAddress = entries.filter(entry => typeof entry.address === 'string' && entry.address.length > 0);
    let maxPlacesPerEntry = 0;
    for (const entry of entries) {
      const count = entry.places ? entry.places.length : 0;
      if (count > maxPlacesPerEntry) maxPlacesPerEntry = count;
    }
    return {
      entries: entries.length,
      entriesWithPlaces: entriesWithPlaces.length,
      entriesWithAddress: entriesWithAddress.length,
      maxPlacesPerEntry,
      places: {
        total: places.length,
        inBounds: inBoundsPlaces.length,
        outOfBounds: places.length - inBoundsPlaces.length,
        matched: matches.length,
        matchedUnique: matchedIds.size,
        unmatchedInBounds: unmatchedInBounds.length,
        matchedByType,
        unmatchedInBoundsNames: unmatchedInBounds,
      },
      addresses: statsAddress,
      methods: { footprint: matches.length },
      bounds: effectiveBounds(world),
      projection: { originLat: projectionMeta().originLat, originLon: projectionMeta().originLon, earthRadius: projectionMeta().earthRadius },
    };
  }

  function assign(entries, world) {
    if (!Array.isArray(entries)) throw new TypeError('places.assign expects an array of entries');
    const records = boxRecords(entries);
    const places = data().places || [];
    const addresses = data().addresses || [];
    const matches = [];
    const matchedIds = new Set();

    for (const entry of entries) {
      entry.places = [];
      entry.addresses = [];
      entry.addressPoints = [];
      entry.address = null;
      entry.addressDetail = {
        label: UNKNOWN_ADDRESS,
        confidence: 'unknown',
        source: null,
        method: 'footprint',
      };
    }

    for (const place of places) {
      if (!place || !isInBounds(place, world) || matchedIds.has(place.id)) continue;
      if (!finite(place.x) || !finite(place.z)) continue;
      const best = bestContaining(records, place.x, place.z);
      if (!best) continue; // no nearest unrelated-building fallback
      entryPushPlace(best.entry, place);
      matchedIds.add(place.id);
      matches.push({
        place,
        entry: best.entry,
        buildingId: best.entry.id,
        method: 'footprint',
      });
    }

    const perEntry = new Map();
    for (const address of addresses) {
      if (!isFullAddress(address) || !isInBounds(address, world)) continue;
      if (!finite(address.x) || !finite(address.z)) continue;
      const best = bestContaining(records, address.x, address.z);
      if (!best) continue;
      let list = perEntry.get(best.entry);
      if (!list) { list = []; perEntry.set(best.entry, list); }
      list.push({ address, score: best });
    }

    for (const [entry, list] of perEntry) {
      list.sort((a, b) => {
        if (a.score.distance !== b.score.distance) return a.score.distance - b.score.distance;
        if (a.score.area !== b.score.area) return a.score.area - b.score.area;
        return String(a.address.id).localeCompare(String(b.address.id));
      });
      const labels = [];
      for (const item of list) if (!labels.includes(item.address.label)) labels.push(item.address.label);
      const chosen = list[0];
      entry.addresses = labels;
      entry.addressPoints = list.map(item => item.address);
      entry.address = chosen.address.label;
      entry.addressDetail = {
        label: chosen.address.label,
        confidence: chosen.address.confidence,
        source: chosen.address.source || null,
        sourceURL: chosen.address.sourceURL || null,
        sourceUrl: chosen.address.sourceURL || null,
        addressId: chosen.address.id,
        lat: chosen.address.lat,
        lon: chosen.address.lon,
        override: !!chosen.address.override,
        method: 'footprint',
      };
    }

    const statsAddress = {
      total: addresses.length,
      inBounds: addresses.filter(address => isInBounds(address, world)).length,
      matched: [...perEntry.values()].reduce((total, list) => total + list.length, 0),
      entriesWithAddress: perEntry.size,
      fullLabels: new Set([...perEntry.values()].flat().map(item => item.address.label)).size,
    };
    const stats = summarize(entries, matches, statsAddress, world);
    stats.world = world ? { bounds: world.bounds || null } : null;
    R.places.lastStats = stats;
    if (!R.places.stats) R.places.stats = {};
    R.places.stats.last = stats;
    R.places.stats.data = (data().metadata && data().metadata.counts) || null;
    return matches;
  }

  function entryPushPlace(entry, place) {
    if (!Array.isArray(entry.places)) entry.places = [];
    entry.places.push(place);
  }

  const projection = {
    originLat: DEFAULT_ORIGIN_LAT,
    originLon: DEFAULT_ORIGIN_LON,
    earthRadius: DEFAULT_RADIUS,
    get bounds() { return boundsLimit(); },
    project,
    unproject,
    inBounds,
  };

  R.places = {
    data,
    displayLabel,
    get metadata() { return data().metadata || {}; },
    get places() { return data().places || []; },
    get addresses() { return data().addresses || []; },
    projection,
    project,
    unproject,
    inBounds,
    contains,
    containsEntry,
    isInBounds,
    assign,
    stats: {},
    lastStats: null,
    tolerance: TOLERANCE,
    unknownAddress: UNKNOWN_ADDRESS,
    placeById(id) {
      for (const place of data().places || []) if (place.id === id) return place;
      return null;
    },
  };
})(globalThis);

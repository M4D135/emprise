import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../src/pdr/villes/marseille.js');
await import('../src/pdr/ville-reelle.js');
await import('../src/places-data.js');
await import('../src/places.js');
const P=RADE.places,data=RADE.placesData,bounds={minX:-550,maxX:550,minZ:-550,maxZ:550},world={bounds};
assert.deepEqual(P.project(43.2962,5.3734),{x:0,z:0});
assert.deepEqual(P.project(43.2972,5.3744),{x:81.15,z:-111.1});
assert.equal(data.metadata.projection.kx,81148.19357771498);
assert.equal(data.metadata.projection.kz,111098.50934829589);
for(const p of data.places){assert.deepEqual(P.project(p.lat,p.lon),{x:p.x,z:p.z});assert.equal(p.inBounds,P.inBounds(p.x,p.z));assert(/^https:\/\/www.openstreetmap.org\/(node|way|relation)\/\d+$/.test(p.sourceUrl));assert.equal(typeof p.address,'string');if(p.addressDetail.confidence==='unknown')assert.equal(p.address,'Adresse non renseignée');}
// Rotated containment must use cap=-lacet; AABB or opposite rotation must fail.
const box={x:3,z:-2,lx:10,lz:4,lacet:Math.PI/3},cap=-box.lacet;
const at=(u,v)=>[box.x+u*Math.cos(cap)-v*Math.sin(cap),box.z+u*Math.sin(cap)+v*Math.cos(cap)];
for(const uv of [[4.9,1.9],[-4.9,-1.9],[4.9,-1.9],[-4.9,1.9]])assert(P.contains(box,...at(...uv)));
assert(!P.contains(box,...at(5.31,0),.3));assert(P.contains(box,...at(5.3,0),.3));
// All explicit assignments stay on the source point, including boundary buildings.
const city=PDR.villeReelle.creerVille('marseille',{ilots:15});
const intersects=q=>{const c=Math.cos(q.lacet),s=Math.sin(q.lacet),hx=(Math.abs(c*q.lx)+Math.abs(s*q.lz))/2,hz=(Math.abs(s*q.lx)+Math.abs(c*q.lz))/2;return q.x+hx>=-550&&q.x-hx<=550&&q.z+hz>=-550&&q.z-hz<=550;};
const entries=city.batiments.map(b=>({id:'building-'+b.id,boxes:b.boites.filter(intersects)})).filter(b=>b.boxes.length);
const matches=P.assign(entries,world),stats=P.lastStats;
assert(matches.length>800);assert.equal(new Set(matches.map(m=>m.place.id)).size,matches.length);
for(const m of matches){assert.equal(m.method,'footprint');assert.equal(m.buildingId,m.entry.id);assert(m.entry.places.includes(m.place));assert(P.containsEntry(m.entry,m.place.x,m.place.z,.3));assert(P.isInBounds(m.place,world));}
assert(entries.some(b=>b.places.length>3));
for(const id of ['node/8731323039','node/9697856682','node/12120449600','node/6967474368'])assert(matches.some(m=>m.place.id===id),'real priority POI '+id);
assert.equal(P.placeById('node/12120449600').address,'42 La Canebière 13001 Marseille');
assert.equal(P.placeById('node/6967474368').address,'28 Rue Bir Hakeim 13001 Marseille');
assert.equal(P.placeById('node/7730268545').kind,'car_repair');
assert.deepEqual(P.placeById('node/7730268545').services,['repair']);
assert(!data.places.some(p=>p.type==='armurerie'||p.kind==='car'));
for(const p of data.places.filter(p=>p.tags.tourism==='apartment'))assert.equal(p.type,'logement');
// Residential numbers must come from contained full address points, never a shop fallback.
for(const b of entries){if(!b.addresses.length){assert.equal(b.address,null);assert.equal(b.addressDetail.confidence,'unknown');}else{assert(b.addresses.includes(b.address));assert(b.addressPoints.some(a=>a.label===b.address));for(const a of b.addressPoints){assert(a.housenumber&&a.street);assert(P.containsEntry(b,a.x,a.z,.3));}}}
assert(stats.entriesWithAddress>750);
// World bounds override snapshot flags; multiple establishments remain separately reachable.
RADE.placesData={metadata:data.metadata,places:[{id:'one',x:4,z:0,inBounds:false},{id:'two',x:-4,z:0,inBounds:false},{id:'nearby',x:10.31,z:0,inBounds:true},{id:'outside',x:400,z:0,inBounds:true}],addresses:[]};
const fixture={id:'synthetic',name:'Immeuble',type:'logement',boxes:[{x:0,z:0,lx:20,lz:10,lacet:0}]};
assert.deepEqual(P.assign([fixture],world).map(m=>m.place.id),['one','two']);assert.equal(fixture.name,'Immeuble');assert.equal(fixture.type,'logement');assert.equal(fixture.address,null);
assert.equal(P.assign([fixture],{bounds:{minX:-2,maxX:2,minZ:-2,maxZ:2}}).length,0);
const boundary={id:'outside-small-world',boxes:[{x:400,z:0,lx:10,lz:10,lacet:0}]};
assert.equal(P.assign([boundary],{bounds:{minX:-325,maxX:325,minZ:-325,maxZ:325}}).length,0);assert.equal(P.assign([boundary],world).length,1);
RADE.placesData=data;P.assign(entries,world);
assert.equal(data.sourcePlaces.length,1093);assert(data.metadata.attribution.includes('OpenStreetMap'));assert(data.metadata.sources.some(s=>s.id==='ban-addresses'));
const report={bounds,sourceTimestamp:data.metadata.sourceTimestamp,sourceElements:1093,activePlaces:data.places.length,inBounds:stats.places.inBounds,matched:matches.length,buildings:entries.length,buildingsWithPlaces:stats.entriesWithPlaces,buildingsWithAddress:stats.entriesWithAddress,addressPointsMatched:stats.addresses.matched,types:stats.places.matchedByType,multiPlaceBuildings:entries.filter(b=>b.places.length>1).length,priority:matches.filter(m=>['node/8731323039','node/9697856682','node/12120449600','node/6967474368'].includes(m.place.id)).map(m=>({id:m.place.id,name:m.place.name,address:m.place.address,buildingId:m.buildingId,x:m.place.x,z:m.place.z})),checks:['WGS84 source projection','rotated source containment','dynamic world bounds','multiple POIs per building','no nearby-building fallback','direct residential address points only','official priority addresses','no invented arms dealer or car dealer']};
fs.writeFileSync(new URL('../assets/places/matching-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

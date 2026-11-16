import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../src/places-data.js');
await import('../src/places.js');
const label=RADE.places.displayLabel,before=JSON.stringify(RADE.placesData);
for(const [input,expected] of [['Marseille','Seille'],['MARSEILLE','SEILLE'],['marseille','seille'],['Savonnerie Marseillaise','Savonnerie Locale'],['Le Marseillais','Le Local'],['maisons marseillaises','maisons locales'],['Boulevard de Marseilleveyre','Boulevard de Seilleveyre'],['Vieux-Port','Vieux-Port']])assert.equal(label(input),expected);
let reviewed=0;
for(const collection of [RADE.placesData.places,RADE.placesData.addresses])for(const item of collection)for(const key of ['name','label','address'])if(typeof item[key]==='string'){assert(!/marseill/i.test(label(item[key])),key+': '+item[key]);reviewed++;}
assert.equal(JSON.stringify(RADE.placesData),before,'Raw IDs, positions, names, addresses, tags, sources and attribution remain byte-for-byte unchanged');
assert.equal(RADE.places.placeById('node/12120449600').address,'42 La Canebière 13001 Marseille','Data API remains the factual source');
const source=fs.readFileSync(new URL('../src/interiors.js',import.meta.url),'utf8'),start=source.indexOf('const font='),end=source.indexOf('function knownAddress(',start),context=vm.createContext({R:RADE});vm.runInContext(source.slice(start,end),context);
const sign=text=>{const meshes=[];context.lettering(text,(x,y)=>[x,y,0],(...v)=>meshes.push(v));return meshes;};
assert.deepEqual(sign('MARSEILLE'),sign('SEILLE'),'Actual procedural signs use the fictional label before building glyph geometry');
const html=fs.readFileSync(new URL('../src/index.html',import.meta.url),'utf8'),game=fs.readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
// Execute the actual mobile HUD branch: its label comes from raw place data.
const touchLine=game.split('\n').find(line=>line.includes("if(touchActive){const target=context();$('touch-interact')"));assert(touchLine);
const cityLabelSource=game.slice(game.indexOf('function cityLabel('),game.indexOf('function rememberLive(')),nodes=new Map(),ui=vm.createContext({R:RADE,touchActive:true,session:{mode:'foot'},context:()=>({label:'E · Opéra de Marseille'}),$:id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(){}});return nodes.get(id);}});
vm.runInContext(cityLabelSource+touchLine,ui);assert.equal(nodes.get('touch-interact').textContent,'Opéra de Seille');assert.equal(nodes.get('touch-interact').disabled,false);
ui.context=()=>null;vm.runInContext(touchLine,ui);assert.equal(nodes.get('touch-interact').textContent,'INTERAGIR');assert.equal(nodes.get('touch-interact').disabled,true);
assert(!/marseille|masséra|43°17|5°22/i.test(html+game));assert(html.includes('<div class="eyebrow">SEILLE</div>'));assert(html.includes('<h1>EMPRISE<span>.</span></h1>'));
assert(html.includes('OpenStreetMap')&&html.includes('ODbL'));
console.log('PASS Seille presentation: '+reviewed+' place/address labels, old names and derivatives sanitized, actual procedural signage, discrete title, unchanged source geodata and attribution.');

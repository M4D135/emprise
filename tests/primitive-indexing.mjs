// Exact indexing changes vertex reuse, never triangle data or drawing order.
import assert from 'node:assert/strict';
import '../src/ferro/renderer.js';
import '../src/ferro/webgpu-shaders.js';
const S=FRender.shared,bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function expanded(source,indices){const words=new Uint32Array(source.vertices.buffer,source.vertices.byteOffset,source.vertices.length),out=new Uint32Array(indices.length*6);for(let i=0;i<indices.length;i++)out.set(words.subarray(indices[i]*6,indices[i]*6+6),i*6);return out;}
const n=[0,0,1],free=[[[0,0,0],[1,0,0],[0,1,0],n,n,n],[[0,0,0],[1,0,0],[0,1,0],n,n,n]];
FRender.forme('test.index.mutable',free);
const reports=[];
for(const low of [undefined,true,2]){
 const source=S.geometry(low),originalIndices=source.indices.slice(),originalVertices=source.vertices.slice(),ranges=JSON.stringify(source.ranges),indexed=S.indexPrimitiveVertices(source);
 assert.deepEqual(bytes(source.indices),bytes(originalIndices),'source indices are an unchanged independent snapshot');
 assert.deepEqual(bytes(source.vertices),bytes(originalVertices),'expanded vertex storage remains unchanged');
 assert.equal(JSON.stringify(source.ranges),ranges,'ranges and draw counts unchanged');
 assert.notEqual(indexed.indices.buffer,source.indices.buffer);
 assert.deepEqual(bytes(expanded(source,indexed.indices)),bytes(expanded(source,originalIndices)),'every expanded triangle word and its order is exact');
 const shapeReports={};for(const [name,r] of Object.entries(source.ranges)){const start=r.offset/4,used=indexed.indices.subarray(start,start+r.count);shapeReports[name]=[r.count,new Set(used).size];}
 assert.deepEqual(shapeReports.box,[36,24]);
 const custom=source.ranges['test.index.mutable'];assert.deepEqual(indexed.indices.slice(custom.offset/4,custom.offset/4+custom.count),originalIndices.slice(custom.offset/4,custom.offset/4+custom.count),'free/animated shapes stay expanded');
 assert.equal(indexed.restore('test.index.mutable'),null);
 const r=source.ranges.box,restored=indexed.restore('box');assert.equal(restored.offset,r.offset);assert.deepEqual(restored.indices,originalIndices.slice(r.offset/4,r.offset/4+r.count));assert.equal(indexed.restore('box'),null,'restore occurs only once');
 if(low===2)assert.equal(indexed.restore('bevel'),null,'aliased coarse bevel and box share a single restored range');
 assert.deepEqual(indexed.indices.slice(r.offset/4,r.offset/4+r.count),restored.indices);
 assert.deepEqual(bytes(source.indices),bytes(originalIndices),'restoring does not mutate source snapshots');
 reports.push({detail:low??'full',primitiveCounts:shapeReports,...indexed.stats});
 for(const name of Object.keys(source.ranges))indexed.restore(name);
 assert.deepEqual(indexed.indices,originalIndices,'All restored primitive ranges exactly recover the original index buffer');
}
// Equality is six Float32 WORDS, not position-only, rounded decimal or epsilon.
const raw=new Uint32Array([
 0,0,0,0,0,0x3f800000,
 0,0,0,0,0,0x3f800000,
 0x80000000,0,0,0,0,0x3f800000,
 0,0,0,0,0,0xbf800000,
 1,0,0,0,0,0x3f800000,
 0x7fc00001,0,0,0,0,0x3f800000,
 0x7fc00002,0,0,0,0,0x3f800000,
 0x7fc00001,0,0,0,0,0x3f800000,
]);
const synthetic={vertices:new Float32Array(raw.buffer),indices:Uint32Array.from([0,1,2,3,4,5,6,7]),ranges:{box:{offset:0,count:8}}},exact=S.indexPrimitiveVertices(synthetic);
assert.deepEqual([...exact.indices],[0,0,2,3,4,5,6,5],'signed zero, distinct normal, subnormal and NaN payload remain distinct');
assert.deepEqual(bytes(expanded(synthetic,exact.indices)),bytes(expanded(synthetic,synthetic.indices)));
for(const name of ['world','depth','fx'])assert(!/\b(?:vertex_index|instance_index)\b/.test(FRenderWebGPUShaders.programs[name].vertex),name+' shader must not derive output from remapped builtins');
console.log(JSON.stringify({status:'PASS',checks:'Exact triangle bytes/order, source snapshots, animated exclusions, restoration/aliases, six-word equality and shader builtins',reports},null,2));

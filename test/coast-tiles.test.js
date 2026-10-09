import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as B from '../public/vendor/babylon/babylon.module.js';
import {CoastTiles} from '../public/flight/coast-tiles.js';
import {COAST_KEYS} from '../public/flight/coast-config.js';
import {marseilleTerrain} from '../lib/marseille-data.js';
import {sampleGrid,toLocal} from '../public/flight/geo.js';
import {pwaAssets} from '../lib/pwa-assets.js';
const dir=new URL('../public/geodata/corniche-v1/',import.meta.url);

test('pilot relief is served locally and removes the spurious coastal elevation',async()=>{
 for(const [lon,lat,key]of [[5.35315,43.2789,'16871/12005'],[5.3471,43.2805,'16870/12005']]){
  const grid=await marseilleTerrain(...key.split('/').map(Number));
  assert.equal(grid.size,257);assert.equal(grid.heights.length,257**2);assert.ok(grid.lidar_samples>60000);assert.ok(grid.sample_spacing_m<3.5);
  assert.ok(sampleGrid(grid,...toLocal(lon,lat))<1);assert.ok(grid.heights.every(h=>Number.isFinite(h)&&h>=0&&h<100));
 }
});
test('3D Tiles LOD meshes match physics vertices, axes and photographic UVs',async()=>{
 const tileset=JSON.parse(await readFile(new URL('tileset.json',dir),'utf8'));
 assert.equal(tileset.asset.version,'1.1');assert.equal(tileset.root.children.length,COAST_KEYS.size);
 for(const coarse of tileset.root.children){let tile=coarse;const counts=[];
  while(tile){const bytes=await readFile(new URL(tile.content.uri,dir));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
   const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),p=doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION],uv=doc.accessors[doc.meshes[0].primitives[0].attributes.TEXCOORD_0],binStart=28+bytes.readUInt32LE(12),pv=doc.bufferViews[p.bufferView],uvv=doc.bufferViews[uv.bufferView];
   counts.push(p.count);assert.equal(bytes.readFloatLE(binStart+uvv.byteOffset+4),0);
   const matrix=B.Matrix.FromArray(tileset.root.transform),axis=B.Matrix.RotationX(Math.PI/2),v=new B.Vector3(...tile.extras.bounds.slice(0,2),0);
   const round=B.Vector3.TransformCoordinates(B.Vector3.TransformCoordinates(v,axis),matrix);assert.ok(B.Vector3.Distance(v,round)<1e-5);
   if(!tile.children){const grid=await marseilleTerrain(...tile.extras.key.split('/').map(Number));assert.equal(bytes.readFloatLE(binStart+pv.byteOffset),Math.fround(grid.bounds[0]));assert.equal(bytes.readFloatLE(binStart+pv.byteOffset+4),Math.fround(grid.heights[0]));assert.equal(p.count,grid.heights.length);}
   tile=tile.children?.[0];
  }
  assert.deepEqual(counts,[65**2,129**2,257**2]);
 }
});
test('fallback is masked only under visible, shader-ready native tiles and returns on removal',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);scene.useRightHandedSystem=true;const coast=new CoastTiles(scene);
 try{coast.tiles.update=()=>{};const bounds=[0,0,100,100];let ready=false;
  const tile={extras:{bounds},engineData:{scene:{getChildMeshes:()=>[{getTotalVertices:()=>4,isReady:()=>ready}]}}};
  coast.tiles.visibleTiles.add(tile);coast.update('mobile');assert.deepEqual(coast.bounds,[]);assert.equal(coast.tiles.errorTarget,16);
  ready=true;coast.update('high');assert.deepEqual(coast.bounds,[bounds]);assert.equal(coast.tiles.errorTarget,6);
  coast.tiles.visibleTiles.delete(tile);coast.update();assert.deepEqual(coast.bounds,[]);
 }finally{coast.dispose();scene.dispose();engine.dispose();}
});
test('geodata streams on demand rather than bloating PWA shell installation',()=>{
 const config=pwaAssets(new URL('../public',import.meta.url).pathname);
 assert.ok(config.assets.includes('/flight/coast-tiles.js'));assert.ok(!config.assets.some(path=>path.startsWith('/geodata/')));
 assert.ok(!config.assets.some(path=>path.endsWith('.gz')));
});
test('photographic replacement materials belong to the tile container for GPU cleanup',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);scene.useRightHandedSystem=true;const coast=new CoastTiles(scene),mesh=new B.Mesh('photo',scene),old=new B.StandardMaterial('original',scene);
 const container={materials:[old]};mesh.material=old;
 try{coast.tiles.dispatchEvent({type:'load-model',scene:{getChildMeshes:()=>[mesh]},tile:{engineData:{container}}});
  assert.equal(mesh.renderingGroupId,1);assert.deepEqual(container.materials,[mesh.material]);assert.ok(!scene.materials.includes(old));
 }finally{coast.dispose();scene.dispose();engine.dispose();}
});
test('glTF sRGB photos are reloaded in gamma space for the photographic StandardMaterial',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);scene.useRightHandedSystem=true;const coast=new CoastTiles(scene),mesh=new B.Mesh('photo',scene),old=new B.StandardMaterial('original',scene);
 const original=new B.Texture(null,scene,{useSRGBBuffer:true,gammaSpace:false});old.albedoTexture=original;mesh.material=old;
 const container={materials:[old],textures:[original]},tile={engineData:{container,metadata:{images:[{uri:'16871-12005.jpg'}]}}};
 try{coast.tiles.dispatchEvent({type:'load-model',scene:{getChildMeshes:()=>[mesh]},tile,url:'https://gabian.example/geodata/corniche-v1/16871-12005-1.glb'});
  const texture=mesh.material.diffuseTexture;assert.notEqual(texture,original);assert.equal(texture.gammaSpace,true);assert.equal(texture._useSRGBBuffer,false);assert.equal(texture.invertY,false);
  assert.equal(texture.url,'https://gabian.example/geodata/corniche-v1/16871-12005.jpg');assert.deepEqual(container.textures,[texture]);assert.equal(mesh.material.twoSidedLighting,true);
 }finally{coast.dispose();scene.dispose();engine.dispose();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as B from '../public/vendor/babylon/babylon.module.js';
import {CoastTiles} from '../public/flight/coast-tiles.js';
import {COAST_KEYS,COAST_DIR} from '../public/flight/coast-config.js';
import {marseilleTerrain} from '../lib/marseille-data.js';
import {gunzipSync} from 'node:zlib';
import {coastModel} from '../lib/coast-store.js';
import {sampleGrid,toLocal,tileAt} from '../public/flight/geo.js';
import {pwaAssets} from '../lib/pwa-assets.js';
const dir=new URL('../public'+COAST_DIR,import.meta.url);

test('pilot relief is served locally and removes the spurious coastal elevation',async()=>{
 for(const [lon,lat,key]of [[5.35315,43.2789,'16871/12005'],[5.3471,43.2805,'16870/12005']]){
  const grid=await marseilleTerrain(...key.split('/').map(Number));
  assert.equal(grid.size,513);assert.equal(grid.heights.length,513**2);assert.ok(grid.lidar_samples>60000);assert.ok(grid.sample_spacing_m<1.75);
  assert.ok(sampleGrid(grid,...toLocal(lon,lat))<1);assert.ok(grid.heights.every(h=>Number.isFinite(h)&&h>=0&&h<100));
 }
});
test('3D Tiles LOD meshes match physics vertices, axes and photographic UVs',async()=>{
 const tileset=JSON.parse(await readFile(new URL('tileset.json',dir),'utf8'));
 assert.equal(tileset.asset.version,'1.1');assert.equal(tileset.root.refine,'ADD');assert.equal(tileset.root.children.length,COAST_KEYS.size);
 const walk=async tile=>{
  const bytes=gunzipSync(await coastModel(tile.content.uri));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),p=doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION],uv=doc.accessors[doc.meshes[0].primitives[0].attributes.TEXCOORD_0],binStart=28+bytes.readUInt32LE(12),pv=doc.bufferViews[p.bufferView],uvv=doc.bufferViews[uv.bufferView];
  assert.equal(bytes.readFloatLE(binStart+uvv.byteOffset+4),0);
  const matrix=B.Matrix.FromArray(tileset.root.transform),axis=B.Matrix.RotationX(Math.PI/2),v=new B.Vector3(...tile.extras.bounds.slice(0,2),0);
  const round=B.Vector3.TransformCoordinates(B.Vector3.TransformCoordinates(v,axis),matrix);assert.ok(B.Vector3.Distance(v,round)<1e-5);
  if(!tile.children){const grid=await marseilleTerrain(...tile.extras.key.split('/').map(Number)),q=tile.extras.quarter,offset=Math.floor(q/2)*256*grid.size+(q%2)*256;
   assert.equal(bytes.readFloatLE(binStart+pv.byteOffset),Math.fround(tile.extras.bounds[0]));assert.equal(bytes.readFloatLE(binStart+pv.byteOffset+4),Math.fround(grid.heights[offset]));assert.equal(p.count,257**2);
  }else{assert.equal(p.count,tile.extras.quarter===undefined?65**2:129**2);for(const child of tile.children)await walk(child);}
 };
 for(const key of ['16872/12002','16871/12005','16873/12008','16870/12014','16877/12014','16885/12013']){assert.ok(COAST_KEYS.has(key));const subtree=JSON.parse(await readFile(new URL(key.replace('/','-')+'.tiles.json',dir),'utf8'));assert.equal(subtree.root.children.length,4);await walk(subtree.root);}

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
 try{coast.tiles.dispatchEvent({type:'load-model',scene:{getChildMeshes:()=>[mesh]},tile,url:'https://gabian.example/geodata/corniche-v2/16871-12005-1.glb'});
  const texture=mesh.material.diffuseTexture;assert.notEqual(texture,original);assert.equal(texture.gammaSpace,true);assert.equal(texture._useSRGBBuffer,false);assert.equal(texture.invertY,false);
  assert.equal(texture.url,'https://gabian.example/geodata/corniche-v2/16871-12005.jpg');assert.deepEqual(container.textures,[texture]);assert.equal(mesh.material.twoSidedLighting,true);
 }finally{coast.dispose();scene.dispose();engine.dispose();}
});
test('Maire and the Calanques have measured relief, while source metadata identifies the open products',async()=>{
 for(const key of ['16869/12014','16870/12014','16877/12014']){
  const grid=await marseilleTerrain(...key.split('/').map(Number));assert.equal(grid.size,513);assert.ok(grid.lidar_samples>200000);assert.ok(grid.heights.some(h=>h>70));assert.equal(grid.surfaceHeights.length,grid.heights.length);
 }
 const sources=JSON.parse(await readFile(new URL('sources.json',dir),'utf8'));assert.equal(sources.coverage.tiles,COAST_KEYS.size);assert.ok(COAST_KEYS.size>200);assert.equal(sources.imagery.license,'Licence Ouverte 2.0 (Etalab)');assert.match(sources.imagery.publisher,/Marseille/);assert.equal(sources.imagery.updated_at,'2023-11-23T10:54:25+00:00');assert.ok(sources.imagery.output_resolution_m<.44);assert.match(await readFile(new URL('LICENSE.txt',dir),'utf8'),/2022/);
});

test('local model generation rejects invalid paths and LOD combinations and reuses compressed models',async()=>{
 assert.equal(await coastModel('../16872-12002-8.glb'),null);
 assert.equal(await coastModel('16872-12002-q0-8.glb'),null);
 assert.equal(await coastModel('16872-12002-1.glb'),null);
 assert.equal(await coastModel('99999-99999-8.glb'),null);
 const bytes=await coastModel('16872-12002-q0-1.glb');assert.equal(await coastModel('16872-12002-q0-1.glb'),bytes);
 assert.equal(gunzipSync(bytes).subarray(0,4).toString(),'glTF');
});

test('native streaming masks distant tiles without forcing near tiles outside the camera frustum into view',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),camera=new B.Camera('test',B.Vector3.Zero(),scene),coast=new CoastTiles(scene);
 try{scene.activeCamera=camera;coast.tiles.update=()=>{};coast.update('mobile');
  const plugin=coast.tiles.getPluginByName('LOCAL_STREAMING_AREA'),near={extras:{bounds:[100,100,300,300]}},far={extras:{bounds:[5000,5000,5500,5500]}};
  const target={inView:false};assert.equal(plugin.calculateTileViewError(near,target),false);assert.equal(target.inView,false);
  target.inView=true;assert.equal(plugin.calculateTileViewError(far,target),true);assert.equal(target.inView,false);
  assert.equal(plugin.calculateTileViewError({},target),false);assert.equal(coast.tiles.lruCache.maxSize,96);
 }finally{coast.dispose();scene.dispose();engine.dispose();}
});

test('coverage includes the complete Marseille route from Vieux-Port to the named Calanques',()=>{
 for(const [lon,lat] of [[5.374,43.295],[5.347,43.28],[5.374,43.253],[5.35,43.215],[5.354,43.211],[5.337,43.211],[5.419,43.21],[5.446,43.211],[5.456,43.213]])assert.ok(COAST_KEYS.has(tileAt(lon,lat).join('/')),`${lon},${lat}`);
 assert.ok(!COAST_KEYS.has(tileAt(5.315,43.361).join('/')));
});

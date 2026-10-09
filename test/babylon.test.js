import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/vendor/three/three.core.js';
import * as B from '../public/vendor/babylon/babylon.module.js';
import {BabylonRenderer} from '../public/flight/babylon-renderer.js';
import {overviewMask,terrainGeometry} from '../public/flight/terrain.js';
const fixture=()=>{const renderer=new BabylonRenderer({engine:new B.NullEngine()});const scene=new T.Scene();scene.background=new T.Color(0xb8d7e0);const camera=new T.PerspectiveCamera(65,1,.08,35000);return{renderer,scene,camera};};

test('Babylon preserves nested vehicle transforms, mirrored parts and overlay camera projection',t=>{
 const {renderer,scene,camera}=fixture();t.after(()=>renderer.dispose());
 const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0xffffff}));
 root.position.set(125,30,-50);root.rotation.set(.2,1.3,-.4);mesh.position.set(2,3,4);mesh.scale.x=-1;root.add(mesh);scene.add(root);
 camera.position.set(120,35,-40);camera.lookAt(root.position);renderer.sync(scene,camera);
 const native=renderer.objects.get(mesh).native;
 assert.deepEqual([...native.getWorldMatrix().m],mesh.matrixWorld.elements.map(Math.fround));
 assert.deepEqual([...renderer.camera.getViewMatrix().m],camera.matrixWorldInverse.elements.map(Math.fround));
 assert.deepEqual([...renderer.camera.getProjectionMatrix().m],camera.projectionMatrix.elements.map(Math.fround));
 assert.equal(native.material.sideOrientation,B.Material.CounterClockWiseSideOrientation);
 assert.equal(renderer.scene.useRightHandedSystem,true);
 root.position.x+=12;renderer.sync(scene,camera);assert.equal(native.getWorldMatrix().m[12],Math.fround(mesh.matrixWorld.elements[12]));
});

test('animated geometry is shared, updates once and retains alpha for coastal water',t=>{
 const {renderer,scene,camera}=fixture();t.after(()=>renderer.dispose());
 const geometry=terrainGeometry({size:2,bounds:[0,0,1,1],heights:[0,0,0,0]});
 geometry.setAttribute('color',new T.Float32BufferAttribute([1,1,1,0,1,1,1,.4,1,1,1,1,1,1,1,.8],4));
 const material=new T.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:.8,depthWrite:false});
 const a=new T.Mesh(geometry,material),b=new T.Mesh(geometry,material);scene.add(a,b);renderer.sync(scene,camera);
 const native=renderer.objects.get(a).native;assert.equal(native.geometry,renderer.objects.get(b).native.geometry);
 assert.equal(native.hasVertexAlpha,true);assert.equal(native.material.disableDepthWrite,true);
 assert.equal(native.getVerticesData('color')[3],0);
 geometry.attributes.position.setY(0,5);geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();renderer.sync(scene,camera);
 assert.equal(native.getVerticesData('position')[1],5);
 const replacement=new T.PlaneGeometry(2,2);a.geometry=replacement;renderer.sync(scene,camera);
 assert.notEqual(native.geometry,renderer.objects.get(b).native.geometry);
});

test('crowds use thin instances and moving matrices stay in their parent space',t=>{
 const {renderer,scene,camera}=fixture();t.after(()=>renderer.dispose());
 const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshLambertMaterial(),3);
 mesh.count=2;mesh.position.x=100;mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(4,0,0));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(-4,0,0));mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);renderer.sync(scene,camera);
 const native=renderer.objects.get(mesh).native;
 assert.equal(native.thinInstanceCount,2);assert.equal(native.getWorldMatrix().m[12],100);
 mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(8,0,0));mesh.instanceMatrix.needsUpdate=true;renderer.sync(scene,camera);
 assert.equal(native.thinInstanceGetWorldMatrices()[0].m[12],8);
 mesh.count=0;renderer.sync(scene,camera);assert.equal(native.isEnabled(),false);
});

test('wake draw range, billboards and invisible parents retain their behavior',t=>{
 const {renderer,scene,camera}=fixture();t.after(()=>renderer.dispose());
 const root=new T.Group(),geometry=new T.BufferGeometry().setFromPoints(Array.from({length:8},(_,i)=>new T.Vector3(i,0,0)));
 const wake=new T.LineSegments(geometry,new T.LineBasicMaterial({transparent:true,opacity:.3,depthWrite:false}));
 const sprite=new T.Sprite(new T.SpriteMaterial({transparent:true,depthTest:false}));sprite.scale.set(38,6.7,1);root.add(wake,sprite);scene.add(root);
 geometry.setDrawRange(0,4);renderer.sync(scene,camera);
 assert.equal(renderer.objects.get(wake).native.subMeshes[0].indexCount,4);
 assert.equal(renderer.objects.get(wake).native.material.fillMode,B.Material.LineListDrawMode);
 assert.equal(renderer.objects.get(sprite).native.billboardMode,B.Mesh.BILLBOARDMODE_ALL);
 assert.equal(renderer.objects.get(sprite).native.material.depthFunction,B.Constants.ALWAYS);
 geometry.setDrawRange(0,6);renderer.sync(scene,camera);assert.equal(renderer.objects.get(wake).native.subMeshes[0].indexCount,6);
 root.visible=false;renderer.sync(scene,camera);assert.equal(renderer.objects.get(sprite).native.isEnabled(),false);
 root.visible=true;renderer.sync(scene,camera);assert.equal(renderer.objects.get(sprite).native.isEnabled(),true);
});

test('loaded relief masks coarse terrain and streamed tiles release GPU allocations',t=>{
 const {renderer,scene,camera}=fixture();t.after(()=>renderer.dispose());
 const material=new T.MeshLambertMaterial(),update=overviewMask(material);
 const overview=new T.Mesh(terrainGeometry({size:2,bounds:[0,0,900,900],heights:[0,0,0,0]}),material);scene.add(overview);
 update([[0,0,450,450]]);renderer.sync(scene,camera);
 const native=renderer.objects.get(overview).native,plugin=native.material.pluginManager.getPlugin('GabianTerrainMask');
 const uniforms={};plugin.bindForSubMesh({updateFloat:(key,value)=>uniforms[key]=value,updateFloatArray:(key,value)=>uniforms[key]=[...value]});
 assert.equal(uniforms.terrainCount,1);assert.deepEqual(uniforms.terrainBounds.slice(0,4),[0,0,450,450]);
 assert.match(plugin.getCustomCode('fragment').CUSTOM_FRAGMENT_MAIN_BEGIN,/discard/);
 update([]);plugin.bindForSubMesh({updateFloat:(key,value)=>uniforms[key]=value,updateFloatArray:()=>{}});assert.equal(uniforms.terrainCount,0);
 scene.remove(overview);renderer.sync(scene,camera);renderer.collect();
 assert.equal(renderer.objects.size,0);assert.equal(renderer.geometries.size,0);assert.equal(renderer.materials.size,0);
 assert.equal(native.isDisposed(),true);
});

test('sea is excluded from both terrain layers after material updates; land and boat waves retain depth tests',async t=>{
 const {terrainSeaMask}=await import('../public/flight/terrain.js');
 const {renderer,scene,camera}=fixture();t.after(()=>renderer.dispose());
 const material=terrainSeaMask(new T.MeshLambertMaterial({color:0xffffff}));overviewMask(material);
 const mesh=new T.Mesh(terrainGeometry({size:2,bounds:[0,0,1,1],heights:[0,0,0,12]}),material);scene.add(mesh);
 renderer.sync(scene,camera);const native=renderer.objects.get(mesh).native;
 const plugin=native.material.pluginManager.getPlugin('GabianSeaFloorMask');
 assert.match(plugin.getCustomCode('vertex').CUSTOM_VERTEX_MAIN_END,/position.y/);
 assert.match(plugin.getCustomCode('fragment').CUSTOM_FRAGMENT_MAIN_BEGIN,/terrainElevation <= 0.01/);
 assert.match(plugin.getCustomCode('fragment').CUSTOM_FRAGMENT_MAIN_BEGIN,/discard/);
 assert.ok(native.material.pluginManager.getPlugin('GabianTerrainMask'));
 material.vertexColors=true;material.needsUpdate=true;renderer.sync(scene,camera);
 assert.equal(native.material.pluginManager.getPlugin('GabianSeaFloorMask'),plugin);
 assert.deepEqual([...native.getVerticesData('position')].filter((_,i)=>i%3===1),[0,0,0,12]);
 const waves=new T.Mesh(new T.PlaneGeometry(),new T.MeshPhongMaterial({transparent:true,opacity:.8,depthWrite:false}));scene.add(waves);renderer.sync(scene,camera);
 assert.ok(!renderer.objects.get(waves).native.material.pluginManager?.getPlugin('GabianSeaFloorMask'));
 assert.equal(renderer.objects.get(waves).native.material.depthFunction,0);
});

import * as B from '../vendor/babylon/babylon.module.js';
import {CoastTiles} from './coast-tiles.js';

// Existing procedural builders remain CPU-only. Babylon owns the scene, GPU
// buffers, materials, instancing and render loop. Nothing is serialized per frame.
const attributes={position:B.VertexBuffer.PositionKind,normal:B.VertexBuffer.NormalKind,uv:B.VertexBuffer.UVKind,color:B.VertexBuffer.ColorKind};
// Babylon StandardMaterial shades in gamma space, unlike Three's builders.
const gamma=value=>value<=.0031308?value*12.92:1.055*Math.pow(value,1/2.4)-.055;
const color=(target,source,factor=1)=>target.set(gamma(source.r)*factor,gamma(source.g)*factor,gamma(source.b)*factor);
const changed=(a,b)=>!a||a.some((value,i)=>value!==b[i]);

class TerrainMask extends B.MaterialPluginBase {
 constructor(material,mask,coast){super(material,'GabianTerrainMask',200,{},true,true);this.mask=mask;this.coast=coast;this.bounds=new Float32Array(128*4);}
 getUniforms(){return{ubo:[{name:'terrainCount',size:1,type:'float'},{name:'terrainBounds',size:4,type:'vec4',arraySize:128}],fragment:'uniform float terrainCount;\nuniform vec4 terrainBounds[128];'};}
 bindForSubMesh(buffer){const original=this.mask?.terrainCount.value||0,extra=this.coast?.bounds||[],count=Math.min(128,original+extra.length);for(let i=0;i<original;i++)this.mask.terrainBounds.value[i].toArray(this.bounds,i*4);for(let i=original;i<count;i++)this.bounds.set(extra[i-original],i*4);buffer.updateFloat('terrainCount',count);buffer.updateFloatArray('terrainBounds',this.bounds);}
 getCustomCode(kind){return kind==='vertex'?{CUSTOM_VERTEX_DEFINITIONS:'varying vec2 overviewPosition;',CUSTOM_VERTEX_MAIN_END:'overviewPosition = position.xz;'}:{CUSTOM_FRAGMENT_DEFINITIONS:'varying vec2 overviewPosition;',CUSTOM_FRAGMENT_MAIN_BEGIN:`for (int i=0; i<128; i++) {
 if (float(i)>=terrainCount) break;
 vec4 b=terrainBounds[i];
 if (overviewPosition.x>=b.x && overviewPosition.x<=b.z && overviewPosition.y>=b.y && overviewPosition.y<=b.w) discard;
 }`};}
}

export class BabylonRenderer {
 constructor({canvas,antialias=true,engine}={}){
  this.engine=engine||new B.Engine(canvas,antialias,{powerPreference:'high-performance',preserveDrawingBuffer:false,stencil:true},false);
  this.scene=new B.Scene(this.engine);this.scene.useRightHandedSystem=true;
  // Draw the fallback sea first, then clear only depth for the photographic
  // terrain/world. They cannot compete for the same depth, even at the horizon.
  this.scene.setRenderingAutoClearDepthStencil(1,true,true,true);
  this.scene.imageProcessingConfiguration.toneMappingEnabled=true;
  this.scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  this.scene.imageProcessingConfiguration.exposure=1.15;
  this.camera=new B.Camera('game-camera',B.Vector3.Zero(),this.scene);
  this.view=B.Matrix.Identity();this.projection=B.Matrix.Identity();
  this.camera._getViewMatrix=()=>this.view;
  this.camera.freezeProjectionMatrix(this.projection);this.scene.activeCamera=this.camera;
  this.objects=new Map();this.geometries=new Map();this.materials=new Map();this.textures=new Map();this.frame=0;this.pixelRatio=1;
  this.spriteGeometry=new B.Geometry('sprite-quad',this.scene);
  this.spriteGeometry.setVerticesData('position',[-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]);
  this.spriteGeometry.setVerticesData('uv',[0,0,1,0,1,1,0,1]);this.spriteGeometry.setIndices([0,1,2,0,2,3]);
  this.spritePosition=new B.Vector3();this.spriteScale=new B.Vector3();this.spriteRotation=new B.Quaternion();this.spriteMatrix=B.Matrix.Identity();
  this.coast=canvas?new CoastTiles(this.scene):null;
  if(canvas)canvas.dataset.engine='babylonjs';
 }
 setPixelRatio(value){this.pixelRatio=value;this.engine.setHardwareScalingLevel(1/value);}
 setSize(width,height){this.engine.setSize(Math.round(width*this.pixelRatio),Math.round(height*this.pixelRatio));}
 setAnimationLoop(callback){if(this.loop)this.engine.stopRenderLoop(this.loop);this.loop=callback?()=>callback(performance.now()):null;if(this.loop)this.engine.runRenderLoop(this.loop);}

 texture(source){
  if(!source?.image)return null;
  let record=this.textures.get(source);
  if(!record){
   const image=source.image;
   const texture=typeof image.getContext==='function'?new B.DynamicTexture(`texture-${source.id}`,image,this.scene,true):new B.Texture(image.currentSrc||image.src,this.scene,false,source.flipY,B.Texture.TRILINEAR_SAMPLINGMODE,null,null,image);
   texture.gammaSpace=source.colorSpace==='srgb';texture.anisotropicFilteringLevel=source.anisotropy;
   texture.wrapU=source.wrapS===1000?B.Texture.WRAP_ADDRESSMODE:B.Texture.CLAMP_ADDRESSMODE;
   texture.wrapV=source.wrapT===1000?B.Texture.WRAP_ADDRESSMODE:B.Texture.CLAMP_ADDRESSMODE;
   record={native:texture,version:-1};this.textures.set(source,record);
   source.addEventListener('dispose',()=>{texture.dispose();this.textures.delete(source);});
  }
  record.seen=this.frame;
  if(record.version!==source.version){if(record.native instanceof B.DynamicTexture)record.native.update(source.flipY);record.version=source.version;}
  record.native.uScale=source.repeat.x;record.native.vScale=source.repeat.y;record.native.uOffset=source.offset.x;record.native.vOffset=source.offset.y;
  return record.native;
 }
 material(source){
  let record=this.materials.get(source);
  if(!record){
   const native=new B.StandardMaterial(`material-${source.id}`,this.scene);
   native.maxSimultaneousLights=4;
   native.sideOrientation=B.Material.CounterClockWiseSideOrientation;
   if(source.userData?.terrainMask||source.userData?.coastalTerrain)new TerrainMask(native,source.userData.terrainMask,this.coast);
   record={native};this.materials.set(source,record);
   source.addEventListener('dispose',()=>{native.dispose(false,false);this.materials.delete(source);});
  }
  if(record.seen===this.frame)return record.native;
  record.seen=this.frame;const native=record.native;
  color(native.diffuseColor,source.color);
  native.disableLighting=!!(source.isMeshBasicMaterial||source.isSpriteMaterial||source.isLineBasicMaterial);
  if(native.disableLighting)color(native.emissiveColor,source.color);
  else if(source.emissive)color(native.emissiveColor,source.emissive,source.emissiveIntensity??1);
  else native.emissiveColor.setAll(0);
  if(source.specular)color(native.specularColor,source.specular);
  else native.specularColor.setAll(source.isMeshStandardMaterial?(1-(source.roughness??1))*.2:0);
  native.specularPower=source.shininess??Math.max(1,(1-(source.roughness??1))*128);
  native.alpha=source.opacity;native.backFaceCulling=source.side!==2;native.twoSidedLighting=source.side===2;
  native.disableDepthWrite=source.depthWrite===false;native.depthFunction=source.depthTest===false?B.Constants.ALWAYS:0;
  native.zOffset=source.polygonOffset?source.polygonOffsetFactor:0;
  native.alphaMode=source.blending===2?B.Constants.ALPHA_ADD:B.Constants.ALPHA_COMBINE;
  native.transparencyMode=source.transparent?B.Material.MATERIAL_ALPHABLEND:B.Material.MATERIAL_OPAQUE;
  native.diffuseTexture=this.texture(source.map);native.useAlphaFromDiffuseTexture=!!source.transparent;
  // Aerial photos already contain sunlight and shadows. Re-lighting them makes
  // cliffs and sea artificially dark and reveals seams between tile renderers.
  const photo=source.userData?.photographic&&native.diffuseTexture;
  native.emissiveTexture=photo||null;
  if(photo){native.disableLighting=true;native.emissiveColor.setAll(1);native.diffuseColor.setAll(0);}
  if(native.diffuseTexture)native.diffuseTexture.hasAlpha=!!source.transparent;
  native.fillMode=source.isLineBasicMaterial?B.Material.LineListDrawMode:B.Material.TriangleFillMode;
  return native;
 }
 geometry(source,line=false,segments=false){
  // The same source can be used for both a triangle mesh and an outline.
  let variants=this.geometries.get(source);
  if(!variants){variants=new Map();this.geometries.set(source,variants);source.addEventListener('dispose',()=>{for(const record of variants.values())record.native.dispose();this.geometries.delete(source);});}
  const key=line?(segments?'segments':'line'):'mesh';let record=variants.get(key);
  if(!record){record={native:new B.Geometry(`geometry-${source.id}-${key}`,this.scene),versions:new Map()};variants.set(key,record);}
  record.seen=this.frame;
  if(record.updated===this.frame)return record.native;record.updated=this.frame;
  for(const [name,kind]of Object.entries(attributes)){
   const attribute=source.attributes[name];if(!attribute)continue;
   const previous=record.versions.get(name);
   if(previous?.attribute===attribute&&previous.version===attribute.version)continue;
   let data=attribute.array;
   if(name==='color'){data=new Float32Array(attribute.count*4);for(let i=0;i<attribute.count;i++){data[i*4]=gamma(attribute.getX(i));data[i*4+1]=gamma(attribute.getY(i));data[i*4+2]=gamma(attribute.getZ(i));data[i*4+3]=attribute.itemSize===4?attribute.getW(i):1;}}
   const stride=name==='color'?4:attribute.itemSize;
   if(previous?.attribute===attribute)record.native.updateVerticesData(kind,data,name==='position');
   else record.native.setVerticesData(kind,data,true,stride);
   record.versions.set(name,{attribute,version:attribute.version});
  }
  const count=source.attributes.position.count,index=source.index;
  if(record.index!==index||record.indexVersion!==index?.version||record.count!==count){
   let indices=index?.array;
   if(!indices)indices=Uint32Array.from({length:count},(_,i)=>i);
   if(line&&!segments){const pairs=new Uint32Array(Math.max(0,indices.length-1)*2);for(let i=0;i<indices.length-1;i++){pairs[i*2]=indices[i];pairs[i*2+1]=indices[i+1];}indices=pairs;}
   record.native.setIndices(indices,count,true);record.index=index;record.indexVersion=index?.version;record.count=count;
  }
  return record.native;
 }
 mesh(source){
  let record=this.objects.get(source);
  if(!record){const native=new B.Mesh(source.name||`mesh-${source.id}`,this.scene);native.isPickable=false;native.rotationQuaternion=B.Quaternion.Identity();record={native};this.objects.set(source,record);}
  const mesh=record.native;record.seen=this.frame;
  const geometry=source.isSprite?this.spriteGeometry:this.geometry(source.geometry,source.isLine,source.isLineSegments);
  if(mesh.geometry!==geometry)geometry.applyToMesh(mesh);
  mesh.material=this.material(source.material);
  mesh.useVertexColors=!!source.material.vertexColors;mesh.hasVertexAlpha=mesh.useVertexColors&&source.geometry?.attributes.color?.itemSize===4;
  mesh.alwaysSelectAsActiveMesh=source.frustumCulled===false;
  mesh.alphaIndex=source.renderOrder;
  mesh.renderingGroupId=source.userData?.renderBackdrop?0:1;
  if(source.isSprite){
   B.Matrix.FromArrayToRef(source.matrixWorld.elements,0,this.spriteMatrix);
   this.spriteMatrix.decompose(this.spriteScale,this.spriteRotation,this.spritePosition);
   mesh.position.copyFrom(this.spritePosition);mesh.scaling.copyFrom(this.spriteScale);
   mesh.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
   B.Quaternion.RotationAxisToRef(B.Vector3.Forward(),source.material.rotation||0,mesh.rotationQuaternion);
  }else if(changed(record.matrix,source.matrixWorld.elements)){
   record.matrix=source.matrixWorld.elements.slice();mesh.freezeWorldMatrix(B.Matrix.FromArray(record.matrix));
  }
  if(source.isInstancedMesh){
   if(record.instanceVersion!==source.instanceMatrix.version){mesh.thinInstanceSetBuffer('matrix',source.instanceMatrix.array,16,false);record.instanceVersion=source.instanceMatrix.version;mesh.thinInstanceRefreshBoundingInfo();}
   mesh.thinInstanceCount=source.count;
  }
  const range=source.geometry?.drawRange;
  if(range){const total=geometry.getTotalIndices(),start=Math.min(total,range.start),count=Math.max(0,Math.min(total-start,range.count));
   if(record.rangeStart!==start||record.rangeCount!==count||record.rangeGeometry!==geometry){mesh.releaseSubMeshes();new B.SubMesh(0,0,geometry.getTotalVertices(),start,count,mesh);record.rangeStart=start;record.rangeCount=count;record.rangeGeometry=geometry;}
  }
  mesh.setEnabled(!source.isInstancedMesh||source.count>0);
 }
 light(source){
  let record=this.objects.get(source);
  if(!record){let native;if(source.isHemisphereLight)native=new B.HemisphericLight('sky',B.Vector3.Up(),this.scene);else if(source.isDirectionalLight)native=new B.DirectionalLight('sun',B.Vector3.Down(),this.scene);else if(source.isPointLight)native=new B.PointLight('flare',B.Vector3.Zero(),this.scene);else return;record={native};this.objects.set(source,record);}
  record.seen=this.frame;const light=record.native;color(light.diffuse,source.color);
  light.intensity=source.intensity*(source.isPointLight ? .12 : .45);
  if(source.isHemisphereLight)color(light.groundColor,source.groundColor);
  else{const m=source.matrixWorld.elements;if(source.isDirectionalLight)light.direction.set(-m[12],-m[13],-m[14]).normalize();else{light.position.set(m[12],m[13],m[14]);light.range=source.distance||Number.MAX_VALUE;}}
  light.setEnabled(true);
 }
 sync(sourceScene,sourceCamera){
  this.frame++;sourceScene.updateMatrixWorld();sourceCamera.updateMatrixWorld();
  B.Matrix.FromArrayToRef(sourceCamera.matrixWorldInverse.elements,0,this.view);B.Matrix.FromArrayToRef(sourceCamera.projectionMatrix.elements,0,this.projection);
  this.camera.position.set(sourceCamera.position.x,sourceCamera.position.y,sourceCamera.position.z);
  this.camera.upVector.set(sourceCamera.up.x,sourceCamera.up.y,sourceCamera.up.z);
  this.camera.minZ=sourceCamera.near;this.camera.maxZ=sourceCamera.far;this.camera.fov=sourceCamera.fov*Math.PI/180;
  // Update the inverse once, including turns with a stationary camera. Reuse
  // Babylon's cache for every billboard and material during this frame.
  this.camera.getViewMatrix(true);
  const background=sourceScene.background;this.scene.clearColor.set(gamma(background.r),gamma(background.g),gamma(background.b),1);
  this.scene.fogMode=sourceScene.fog?B.Scene.FOGMODE_EXP2:B.Scene.FOGMODE_NONE;
  if(sourceScene.fog){color(this.scene.fogColor,sourceScene.fog.color);this.scene.fogDensity=sourceScene.fog.density;}
  const visit=(source,parentVisible)=>{
   const visible=parentVisible&&source.visible;
   if(visible){if(source.isMesh||source.isSprite||source.isLine)this.mesh(source);else if(source.isLight)this.light(source);}
   else{const record=this.objects.get(source);if(record){record.seen=this.frame;record.native.setEnabled(false);}}
   for(const child of source.children)visit(child,visible);
  };
  visit(sourceScene,true);
  for(const [source,record]of this.objects)if(record.seen!==this.frame){record.native.dispose(false,false);this.objects.delete(source);}
  // Source tiles can disappear without explicit material disposal. Release their
  // GPU allocations too, while keeping assets used by temporarily hidden models.
  if(this.frame%120===0)this.collect();
 }
 collect(){
  const usedGeometry=new Set(),usedMaterial=new Set();for(const source of this.objects.keys()){if(source.geometry)usedGeometry.add(source.geometry);if(source.material)usedMaterial.add(source.material);}
  for(const [source,variants]of this.geometries)if(!usedGeometry.has(source)){for(const record of variants.values())record.native.dispose();this.geometries.delete(source);}
  for(const [source,record]of this.materials)if(!usedMaterial.has(source)){record.native.dispose(false,false);this.materials.delete(source);}
  const usedTexture=new Set();for(const source of usedMaterial)if(source.map)usedTexture.add(source.map);
  for(const [source,record]of this.textures)if(!usedTexture.has(source)){record.native.dispose();this.textures.delete(source);}
 }
 render(sourceScene,sourceCamera){this.sync(sourceScene,sourceCamera);this.coast?.update(this.quality);this.scene.render();}
 dispose(){this.setAnimationLoop(null);this.coast?.dispose();this.scene.dispose();this.engine.dispose();this.objects.clear();this.geometries.clear();this.materials.clear();this.textures.clear();}
}

import * as B from '../vendor/babylon/babylon.module.js';
import {COAST_URL} from './coast-config.js';

// Native Babylon tiles share the same ESM engine as the existing game. Keep the
// CPU height grid for vehicle physics; hide its mesh only under ready 3D tiles.
export class CoastTiles {
 constructor(scene){
  this.scene=scene;this.tiles=new B.TilesRenderer(COAST_URL,scene);this.failed=false;this.bounds=[];
  this.tiles.errorTarget=10;this.tiles.downloadQueue.maxJobs=2;this.tiles.parseQueue.maxJobs=1;
  this.tiles.lruCache.maxSize=160;this.tiles.lruCache.minSize=48;
  this.range=1800;
  this.tiles.registerPlugin({name:'LOCAL_STREAMING_AREA',calculateTileViewError:(tile,target)=>{
   const b=tile.extras?.bounds,p=scene.activeCamera?.position;if(!b||!p)return false;
   const distance=Math.hypot(Math.max(b[0]-p.x,0,p.x-b[2]),Math.max(b[1]-p.z,0,p.z-b[3]));
   if(distance<=this.range)return false;target.inView=false;return true;
  }});
  this.tiles.addEventListener('load-model',({scene:root,tile,url})=>{
   for(const mesh of root.getChildMeshes()){
    if(!mesh.material)continue;
    const old=mesh.material,material=new B.StandardMaterial('coast-orthophoto',scene);
    const original=old.albedoTexture,container=tile.engineData.container;
    // glTF's PBR loader uses hardware sRGB decoding. StandardMaterial expects
    // gamma-space photos instead: reusing that buffer darkens them a second time.
    const image=tile.engineData.metadata?.images?.[0]?.uri;
    material.diffuseTexture=image&&url?new B.Texture(new URL(image,url).href,scene,{invertY:false,useSRGBBuffer:false,gammaSpace:true,samplingMode:B.Texture.TRILINEAR_SAMPLINGMODE}):original;
    if(material.diffuseTexture)material.diffuseTexture.anisotropicFilteringLevel=8;
    material.disableLighting=true;material.emissiveTexture=material.diffuseTexture;material.emissiveColor.set(1,1,1);
    material.diffuseColor.set(0,0,0);material.specularColor.set(0,0,0);material.backFaceCulling=false;material.twoSidedLighting=true;material.maxSimultaneousLights=4;
    mesh.material=material;mesh.renderingGroupId=1;mesh.isPickable=false;
    container.materials=container.materials.filter(item=>item!==old);container.materials.push(material);
    if(material.diffuseTexture!==original){container.textures=container.textures.filter(item=>item!==original);container.textures.push(material.diffuseTexture);original?.dispose();}
    old.dispose(false,false);
   }
  });
  this.tiles.addEventListener('load-error',()=>{this.failed=true;this.retryAt=performance.now()+30000;});
 }
 update(quality='balanced'){
  if(this.failed&&performance.now()>=this.retryAt){this.tiles.resetFailedTiles();this.failed=false;}
  this.tiles.errorTarget=quality==='mobile'?16:quality==='high'?6:10;
  this.range=quality==='mobile'?1000:quality==='high'?2600:1800;
  this.tiles.lruCache.maxSize=quality==='mobile'?96:quality==='high'?224:160;
  this.tiles.lruCache.minSize=quality==='mobile'?32:48;
  this.tiles.update();
  this.bounds=[];
  for(const tile of this.tiles.visibleTiles){const root=tile.engineData.scene,meshes=root?.getChildMeshes().filter(mesh=>mesh.getTotalVertices()>0)||[];
   if(tile.extras?.bounds&&meshes.length&&meshes.every(mesh=>mesh.isReady(true)))this.bounds.push(tile.extras.bounds);
  }
 }
 dispose(){this.tiles.dispose();this.bounds=[];}
}

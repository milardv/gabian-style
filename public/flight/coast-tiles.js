import * as B from '../vendor/babylon/babylon.module.js';
import {COAST_URL} from './coast-config.js';

// Native Babylon tiles share the same ESM engine as the existing game. Keep the
// CPU height grid for vehicle physics; hide its mesh only under ready 3D tiles.
export class CoastTiles {
 constructor(scene){
  this.scene=scene;this.tiles=new B.TilesRenderer(COAST_URL,scene);this.failed=false;this.bounds=[];
  this.tiles.errorTarget=10;this.tiles.downloadQueue.maxJobs=2;this.tiles.parseQueue.maxJobs=1;
  this.tiles.lruCache.maxSize=24;this.tiles.lruCache.minSize=12;
  this.tiles.addEventListener('load-model',({scene:root,tile,url})=>{
   for(const mesh of root.getChildMeshes()){
    if(!mesh.material)continue;
    const old=mesh.material,material=new B.StandardMaterial('coast-orthophoto',scene);
    const original=old.albedoTexture,container=tile.engineData.container;
    // glTF's PBR loader uses hardware sRGB decoding. StandardMaterial expects
    // gamma-space photos instead: reusing that buffer darkens them a second time.
    const image=tile.engineData.metadata?.images?.[0]?.uri;
    material.diffuseTexture=image&&url?new B.Texture(new URL(image,url).href,scene,{invertY:false,useSRGBBuffer:false,gammaSpace:true,samplingMode:B.Texture.TRILINEAR_SAMPLINGMODE}):original;
    material.diffuseColor.set(1,1,1);material.specularColor.set(0,0,0);material.backFaceCulling=false;material.twoSidedLighting=true;material.maxSimultaneousLights=4;
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
  this.tiles.update();
  this.bounds=[];
  for(const tile of this.tiles.visibleTiles){const root=tile.engineData.scene,meshes=root?.getChildMeshes().filter(mesh=>mesh.getTotalVertices()>0)||[];
   if(tile.extras?.bounds&&meshes.length&&meshes.every(mesh=>mesh.isReady(true)))this.bounds.push(tile.extras.bounds);
  }
 }
 dispose(){this.tiles.dispose();this.bounds=[];}
}

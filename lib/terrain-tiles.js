import { terrainGeometry } from '../public/flight/terrain.js';

// GLB stays in the game's metre-based Y-up frame. The tileset's root converts
// its standard Z-up coordinates back to Y-up, cancelling the glTF up-axis step.
export const Z_UP_TO_GAME = [1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1];
export function tileBox(grid) {
  const [w,n,e,s]=grid.bounds, min=grid.heights.reduce((a,b)=>Math.min(a,b),Infinity),max=grid.heights.reduce((a,b)=>Math.max(a,b),-Infinity);
  return [(w+e)/2,-(n+s)/2,(min+max)/2,(e-w)/2,0,0,0,(s-n)/2,0,0,0,Math.max(1,(max-min)/2)];
}
export function terrainGLB(grid,stride,image) {
  const g=terrainGeometry(grid,stride), chunks=[],views=[],accessors=[];let length=0;
  const add=(array,target,type,componentType,min,max)=>{
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength), padded=Buffer.alloc(Math.ceil(bytes.length/4)*4);bytes.copy(padded);
    views.push({buffer:0,byteOffset:length,byteLength:bytes.length,target});chunks.push(padded);length+=padded.length;
    accessors.push({bufferView:views.length-1,componentType,count:array.length/(type==='VEC3'?3:type==='VEC2'?2:1),type,...(min?{min,max}:{})});return accessors.length-1;
  };
  const p=g.attributes.position.array,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i++) {const k=i%3;lo[k]=Math.min(lo[k],p[i]);hi[k]=Math.max(hi[k],p[i]);}
  const attributes={POSITION:add(p,34962,'VEC3',5126,lo,hi),NORMAL:add(g.attributes.normal.array,34962,'VEC3',5126),TEXCOORD_0:add(g.attributes.uv.array,34962,'VEC2',5126)};
  // glTF's texture origin is top-left, whereas the CPU terrain uses bottom-left.
  const uv=g.attributes.uv.array;for(let i=1;i<uv.length;i+=2)uv[i]=1-uv[i];
  Buffer.from(uv.buffer).copy(chunks[2]);
  const indices=add(g.index.array,34963,'SCALAR',g.index.array instanceof Uint32Array?5125:5123);
  const doc={asset:{version:'2.0',generator:'Gabian Style / IGN LiDAR HD',copyright:'© IGN — Licence Ouverte Etalab 2.0'},extensionsUsed:['KHR_materials_unlit'],scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes,indices,material:0}]}],materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1},extensions:{KHR_materials_unlit:{}}}],images:[{uri:image}],textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],buffers:[{byteLength:length}],bufferViews:views,accessors};
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
  const bin=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(bin.length);binHeader.writeUInt32LE(0x004e4942,4);
  g.dispose();return Buffer.concat([header,json,binHeader,bin]);
}

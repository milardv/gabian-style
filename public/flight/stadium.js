import * as T from '../vendor/three/three.module.js';
import {toLocal} from './geo.js';

// An imaginary match, anchored to the real stadium. All particles are reused.
const CENTER=toLocal(5.3959,43.2698), ANGLE=.27;
const rotate=(x,z)=>[x*Math.cos(ANGLE)-z*Math.sin(ANGLE),x*Math.sin(ANGLE)+z*Math.cos(ANGLE)];
function smokeTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,3,64,64,62);
 g.addColorStop(0,'rgba(255,255,255,.65)');g.addColorStop(.35,'rgba(255,255,255,.38)');g.addColorStop(.7,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=g;c.fillRect(0,0,128,128);return new T.CanvasTexture(canvas);
}
function crowdTexture(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#164a73';c.fillRect(0,0,512,96);
 for(let y=0;y<96;y+=6)for(let x=0;x<512;x+=5){c.fillStyle=(x+y)%4?'#f5f1df':'#43b9ef';c.fillRect(x+(y%2),y,3,4);}
 c.fillStyle='#f5f1df';c.fillRect(0,55,512,32);c.fillStyle='#1362aa';c.font='bold 23px Arial';c.textAlign='center';c.fillText('ALLEZ L’OM · MARSEILLE',256,80);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t;
}
export class StadiumMatch {
 constructor(scene,world,onNearby){this.scene=scene;this.world=world;this.onNearby=onNearby;this.root=new T.Group();this.root.position.set(CENTER[0],0,CENTER[1]);scene.add(this.root);this.root.visible=false;this.built=false;this.clock=0;this.last=null;this.nearby=false;this.heightAt=-Infinity;}
 build(){
  this.built=true;const smoke=smokeTexture(),crowd=crowdTexture();this.emitters=[];this.puffs=[];this.players=[];
  const ground=this.world.ground(...CENTER);
  for(let i=0;i<8;i++){
   const angle=i/8*Math.PI*2,[x,z]=rotate(Math.cos(angle)*85,Math.sin(angle)*125);
   const emitter={x,z,y:0};this.emitters.push(emitter);
   const flare=new T.Sprite(new T.SpriteMaterial({map:smoke,color:0xff713d,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));flare.scale.set(14,14,1);this.root.add(flare);emitter.flare=flare;
   const light=new T.PointLight(0x65caff,18,35,2);light.position.set(x,ground+25,z);this.root.add(light);emitter.light=light;
   const banner=new T.Mesh(new T.PlaneGeometry(50,10),new T.MeshBasicMaterial({map:crowd,side:T.DoubleSide}));banner.position.set(x,ground+20,z);banner.rotation.y=Math.atan2(-x,-z);this.root.add(banner);emitter.banner=banner;
   for(let j=0;j<18;j++){
    const material=new T.SpriteMaterial({map:smoke,color:i%2?0xc7e9ff:0x299ddd,transparent:true,depthWrite:false,opacity:0});
    const sprite=new T.Sprite(material);this.root.add(sprite);this.puffs.push({sprite,emitter,phase:j/18,seed:i*18+j});
   }
  }
  const playerGeometry=new T.CapsuleGeometry(.55,1.1,3,5),white=new T.MeshLambertMaterial({color:0xffffff}),blue=new T.MeshLambertMaterial({color:0x226ad3});
  for(let i=0;i<22;i++){const player=new T.Mesh(playerGeometry,i<11?white:blue);this.root.add(player);this.players.push({mesh:player,x:((i%4)-1.5)*14,z:((i%11)-5)*8,phase:i*1.7});}
  this.ball=new T.Mesh(new T.SphereGeometry(.45,6,4),new T.MeshBasicMaterial({color:0xffffff}));this.root.add(this.ball);
 }
 update(time,position,wind,paused){
  const dt=this.last===null?0:Math.min(.1,Math.max(0,time-this.last));this.last=time;if(!paused)this.clock+=dt;
  const distance=Math.hypot(position.x-CENTER[0],position.z-CENTER[1]),nearby=distance<650;
  if(nearby!==this.nearby){this.nearby=nearby;this.onNearby(nearby);}
  this.root.visible=distance<2400;if(!this.root.visible)return;
  if(!this.built)this.build();
  if(time-this.heightAt>1){this.heightAt=time;for(const e of this.emitters){e.y=this.world.surface(CENTER[0]+e.x,CENTER[1]+e.z)+3;e.flare.position.set(e.x,e.y,e.z);e.light.position.set(e.x,e.y+1,e.z);e.banner.position.y=e.y-5;}this.fieldY=this.world.ground(...CENTER)+1.3;}
  const t=this.clock;
  for(const p of this.puffs){const age=(t/14+p.phase)%1,life=age*14,spread=3+age*23;const {x,y,z}=p.emitter;p.sprite.position.set(x+wind*.55*life+Math.sin(life*.7+p.seed)*spread*.4,y+life*9,z+wind*.83*life+Math.cos(life*.55+p.seed)*spread*.4);p.sprite.scale.setScalar(10+age*63);p.sprite.material.opacity=Math.sin(age*Math.PI)*.5;p.sprite.material.rotation=Math.sin(t*.15+p.seed)*.4;}
  for(let i=0;i<this.emitters.length;i++){const e=this.emitters[i];e.flare.material.opacity=.75+Math.sin(t*13+i)*.2;e.light.intensity=18+Math.sin(t*9+i)*5;}
  for(const p of this.players){const [x,z]=rotate(p.x+Math.sin(t*.6+p.phase)*5,p.z+Math.cos(t*.45+p.phase)*8);p.mesh.position.set(x,this.fieldY,z);}
  const [bx,bz]=rotate(Math.sin(t*.35)*22,Math.cos(t*.27)*35);this.ball.position.set(bx,this.fieldY-.7,bz);
 }
}

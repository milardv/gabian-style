import * as T from '../vendor/three/three.core.js';
import {damped} from './scooter-physics.js';
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export class ScooterCamera {
 constructor(){this.position=new T.Vector3();this.target=new T.Vector3();this.up=new T.Vector3(0,1,0);this.forward=new T.Vector3();this.right=new T.Vector3();this.reset();}
 reset(){this.ready=false;this.heading=0;this.headingVelocity=0;this.roll=0;this.rollVelocity=0;}
 update(camera,state,first,dt){
  const snap=!this.ready||first!==this.first;this.first=first;
  if(snap){this.heading=state.heading;this.headingVelocity=0;this.roll=first?state.lean*.7:0;this.rollVelocity=0;}
  else{
   [this.heading,this.headingVelocity]=damped(this.heading,this.headingVelocity,this.heading+angleDelta(this.heading,state.heading),8,dt);
   [this.roll,this.rollVelocity]=damped(this.roll,this.rollVelocity,first?state.lean*.7:0,7,dt);
  }
  this.forward.set(Math.sin(this.heading),0,-Math.cos(this.heading));this.right.set(Math.cos(this.heading),0,Math.sin(this.heading));
  this.up.set(0,1,0).applyAxisAngle(this.forward,this.roll);
  const distance=first?0:5.8+Math.min(2.5,state.speed*.09);
  this.position.set(state.x,state.altitude,state.z).addScaledVector(this.forward,-distance);
  this.position.y+=first?1.85:2.5;
  if(first)this.position.addScaledVector(this.right,Math.sin(state.lean)*1.1);
  const lookHeading=this.heading+angleDelta(this.heading,state.heading)*.65+state.yawRate*.12;
  this.target.set(state.x+Math.sin(lookHeading)*14,state.altitude+(first?1.6:1.1),state.z-Math.cos(lookHeading)*14);
  if(snap){camera.position.copy(this.position);camera.up.copy(this.up);this.look=this.target.clone();}
  else{camera.position.lerp(this.position,1-Math.exp(-10*dt));camera.up.copy(this.up);this.look.lerp(this.target,1-Math.exp(-12*dt));}
  camera.lookAt(this.look);this.ready=true;
 }
}

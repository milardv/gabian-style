import * as T from '../vendor/three/three.core.js';
import {angleDelta} from './sailboat-physics.js';
import {damped} from './scooter-physics.js';
export class SailboatCamera{
 constructor(){this.reset();this.position=new T.Vector3();this.look=new T.Vector3();}
 reset(){this.ready=false;this.heading=0;this.velocity=0;}
 update(camera,s,first,dt){
  const snap=!this.ready||first!==this.first;this.first=first;
  if(snap){this.heading=s.heading;this.velocity=0;}else [this.heading,this.velocity]=damped(this.heading,this.velocity,this.heading+angleDelta(this.heading,s.heading),4,dt);
  const distance=first?1.5:12+s.speed*.6;
  this.position.set(s.x-Math.sin(this.heading)*distance,s.altitude+(first?1.65:5),s.z+Math.cos(this.heading)*distance);
  const target=new T.Vector3(s.x+Math.sin(this.heading)*12,s.altitude+1.3,s.z-Math.cos(this.heading)*12);
  if(snap){camera.position.copy(this.position);this.look.copy(target);}else{camera.position.lerp(this.position,1-Math.exp(-5*dt));this.look.lerp(target,1-Math.exp(-6*dt));}
  // Keep the horizon steady; small first-person heel follows the cockpit.
  camera.up.set(Math.cos(this.heading)*Math.sin(first?s.heel*.35:0),Math.cos(first?s.heel*.35:0),Math.sin(this.heading)*Math.sin(first?s.heel*.35:0));camera.lookAt(this.look);this.ready=true;
 }
}

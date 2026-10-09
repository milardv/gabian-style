import {clamp} from './physics.js';
import {damped} from './scooter-physics.js';
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const approach=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
// Wind travels southeast: its source is northwest, as for the mistral.
export const WIND_DIRECTION=Math.atan2(.55,-.83);
export function waveHeight(x,z,time,wind){
 const a=clamp(wind,0,12)*.018;
 return .35+a*Math.sin(x*.11+z*.16-time*1.55)+a*.45*Math.sin(x*.29-z*.08-time*2.1);
}
export function sailingPolar(angle){
 const a=Math.abs(angle);if(a<Math.PI*40/180)return 0;
 const entry=clamp((a-Math.PI*40/180)/.3,0,1);
 return entry*(.55+.45*Math.sin(a));
}
export function createSailboat(x=0,z=0,heading=0){
 return {x,z,heading,altitude:.35,time:0,speed:0,vx:0,vz:0,trim:.8,rudder:0,rudderVelocity:0,yawRate:0,heel:0,heelVelocity:0,pitch:0,pitchVelocity:0,heaveVelocity:0,boom:.45,boomVelocity:0,windAngle:0,apparentWind:0,power:0,luffing:true,grounded:false,boundaryHit:false};
}
export function stepSailboat(s,input,dt,environment={}){
 if(dt<=0||s.grounded)return s;
 const wind=clamp(environment.wind??2,0,12);s.time+=dt;
 s.trim=clamp(s.trim+(input.trim||0)*dt*.35,.05,1);
 [s.rudder,s.rudderVelocity]=damped(s.rudder,s.rudderVelocity,clamp(input.turn||0,-1,1)*.52,7,dt);
 const wx=Math.sin(WIND_DIRECTION)*wind-s.vx,wz=-Math.cos(WIND_DIRECTION)*wind-s.vz;
 s.apparentWind=Math.hypot(wx,wz);
 const source=Math.atan2(-wx,wz);s.windAngle=angleDelta(s.heading,source);
 const ideal=clamp((Math.abs(s.windAngle)-.6)*.65,.08,1),efficiency=Math.exp(-Math.pow((s.trim-ideal)*2.3,2));
 const polar=sailingPolar(s.windAngle);s.power=polar*efficiency;s.luffing=polar<.12||s.trim>ideal+.3;
 // A 6 m displacement hull: progressive acceleration, drag and speed-dependent helm.
 const forwardSpeed=s.vx*Math.sin(s.heading)-s.vz*Math.cos(s.heading);
 const thrust=s.apparentWind*s.apparentWind*.009*s.power;
 const drive=thrust-.11*forwardSpeed-.065*forwardSpeed*Math.abs(forwardSpeed);
 const side=Math.sign(Math.sin(s.windAngle));
 const leeway=-side*wind*.012*s.power;
 s.vx+=((Math.sin(s.heading)*Math.max(0,forwardSpeed)+Math.cos(s.heading)*leeway-s.vx)*1.8+Math.sin(s.heading)*drive)*dt;
 s.vz+=((-Math.cos(s.heading)*Math.max(0,forwardSpeed)+Math.sin(s.heading)*leeway-s.vz)*1.8-Math.cos(s.heading)*drive)*dt;
 s.yawRate=approach(s.yawRate,s.rudder*Math.max(0,forwardSpeed)/4.8,3,dt);s.heading+=s.yawRate*dt;
 const x=s.x+s.vx*dt,z=s.z+s.vz*dt;
 // Check the hull footprint, rather than allowing the bow onto the beach.
 const offsets=[[0,0],[0,-3],[0,2.5],[-1,0],[1,0]];
 const wet=offsets.every(([dx,dz])=>environment.isWater?.(x+dx*Math.cos(s.heading)-dz*Math.sin(s.heading),z+dx*Math.sin(s.heading)+dz*Math.cos(s.heading))!==false);
 s.boundaryHit=environment.contains?.(x,z)===false;
 if(!wet){s.grounded=true;s.vx=s.vz=s.speed=s.yawRate=0;return s;}
 if(s.boundaryHit){s.vx*=Math.exp(-6*dt);s.vz*=Math.exp(-6*dt);}else{s.x=x;s.z=z;}
 s.speed=Math.hypot(s.vx,s.vz);
 const f=[Math.sin(s.heading),-Math.cos(s.heading)],r=[Math.cos(s.heading),Math.sin(s.heading)];
 const bow=waveHeight(s.x+f[0]*2.5,s.z+f[1]*2.5,s.time,wind),stern=waveHeight(s.x-f[0]*2.5,s.z-f[1]*2.5,s.time,wind);
 const port=waveHeight(s.x-r[0],s.z-r[1],s.time,wind),starboard=waveHeight(s.x+r[0],s.z+r[1],s.time,wind);
 [s.altitude,s.heaveVelocity]=damped(s.altitude,s.heaveVelocity,(bow+stern+port+starboard)/4,5,dt);
 [s.pitch,s.pitchVelocity]=damped(s.pitch,s.pitchVelocity,Math.atan2(bow-stern,5),4,dt);
 const heelTarget=clamp(-side*s.apparentWind*s.apparentWind*.0022*s.power*Math.sin(Math.abs(s.windAngle)),-.38,.38)+Math.atan2(starboard-port,2);
 [s.heel,s.heelVelocity]=damped(s.heel,s.heelVelocity,heelTarget,3.5,dt);
 // The boom sweeps continuously across the cockpit during a tack or gybe.
 [s.boom,s.boomVelocity]=damped(s.boom,s.boomVelocity,-side*s.trim*1.25,3,dt);
 return s;
}
export function interpolateSailboat(a,b,t){
 const out={...b};for(const key of ['x','z','altitude','time','speed','heel','pitch','boom','rudder','trim','power','apparentWind'])out[key]=a[key]+(b[key]-a[key])*t;
 out.heading=a.heading+angleDelta(a.heading,b.heading)*t;return out;
}

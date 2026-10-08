import {clamp} from './physics.js';
const GRAVITY=9.81,WHEELBASE=1.41,MAX_LEAN=.58;
const approach=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));

// Exact critically damped response: continuous angle and angular velocity on reversal.
export function damped(value,velocity,target,frequency,dt){
 const offset=value-target,decay=Math.exp(-frequency*dt),c=velocity+frequency*offset;
 return[target+(offset+c*dt)*decay,(velocity-frequency*c*dt)*decay];
}
export function createScooter(x=0,z=0,altitude=0,heading=0){
 return{x,z,altitude,heading,speed:0,nitroPower:0,airborne:false,airHeading:heading,groundVelocity:0,contactHeight:null,landingCompression:0,drift:0,slipAngle:0,slipVelocity:0,steering:0,steeringVelocity:0,yawRate:0,lean:0,leanVelocity:0,pitch:0,pitchVelocity:0,verticalVelocity:0,acceleration:0,throttle:0,brake:0,boundaryHit:false};
}
export function scooterSurface(x,z,heading,environment){
 const ground=environment.ground?.(x,z)??0,road=environment.road?.(x,z,heading);
 let height=ground;
 if(road&&Number.isFinite(road.y)&&Math.abs(road.y-ground)<5){
  // Blend across the verge instead of jumping between road and terrain heights.
  const edge=Math.max(1,road.width*.5),weight=clamp(1-(road.distance-edge)/6,0,1);
  height+=(road.y-ground)*weight;
 }
 return{height,ground,road};
}
export function stepScooter(s,input,dt,environment={}){
 if(dt<=0)return s;
 s.throttle=approach(s.throttle,clamp(input.throttle||0,0,1),5,dt);
 s.brake=approach(s.brake,clamp(input.brake||0,0,1),10,dt);
 s.drift=approach(s.drift,input.drift&&s.speed>3&&!s.airborne?1:0,input.drift?6:4,dt);
 s.nitroPower=approach(s.nitroPower,input.nitro&&s.throttle>.01&&!s.airborne?1:0,4,dt);
 s.landingCompression=approach(s.landingCompression,0,10,dt);
 const surface=scooterSurface(s.x,s.z,s.heading,environment);
 const offRoad=surface.road?clamp((surface.road.distance-surface.road.width*.5)/18,0,1):0;
 const resistance=s.speed>.02?.35+.0018*s.speed*s.speed+offRoad*1.7+s.drift*2.3:0;
 const oldSpeed=s.speed;
 const topSpeed=input.nitro?70:34;
 s.acceleration=s.airborne?-.0018*s.speed*s.speed:s.throttle*(4.8+s.nitroPower*11)-s.brake*8.5-resistance-GRAVITY*Math.sin(Math.atan2(s.groundVelocity,Math.max(s.speed,.5)))-Math.max(0,s.speed-topSpeed)*.7;
 if(!s.airborne&&oldSpeed>topSpeed)s.acceleration=Math.min(s.acceleration,-Math.max(.8,(oldSpeed-topSpeed)*.7));
 s.speed=clamp(s.speed+s.acceleration*dt,0,Math.max(topSpeed,oldSpeed));
 if(s.throttle<.01&&s.speed<.02)s.speed=0;
 s.acceleration=(s.speed-oldSpeed)/dt;
 // Bicycle geometry at low speed; lateral grip limits steering and lean at speed.
 const lateralLimit=GRAVITY*Math.tan(MAX_LEAN)*(1-offRoad*.35);
 const driftAssist=1+s.drift*.75;
 const steeringLimit=Math.min(.58,Math.atan(WHEELBASE*lateralLimit*driftAssist/Math.max(s.speed*s.speed,1)));
 const steeringTarget=clamp(input.turn||0,-1,1)*steeringLimit;
 [s.steering,s.steeringVelocity]=damped(s.steering,s.steeringVelocity,steeringTarget,10,dt);
 const yawTarget=s.speed/WHEELBASE*Math.tan(s.steering);
 const maxYaw=lateralLimit*driftAssist/Math.max(s.speed,.5);
 s.yawRate=s.airborne?approach(s.yawRate,0,5,dt):clamp(approach(s.yawRate,clamp(yawTarget,-maxYaw,maxYaw),9,dt),-maxYaw,maxYaw);
 if(s.speed<.02)s.yawRate=0;
 // Arcade oversteer: the rear slides out while momentum follows the travel heading.
 const slipTarget=s.airborne?s.slipAngle:clamp(input.turn||0,-1,1)*s.drift*.4*clamp((s.speed-2)/8,0,1);
 [s.slipAngle,s.slipVelocity]=damped(s.slipAngle,s.slipVelocity,slipTarget,7,dt);
 const lateralAcceleration=s.speed*(s.yawRate-s.slipVelocity);
 const targetLean=s.airborne?0:clamp(Math.atan(lateralAcceleration/GRAVITY),-MAX_LEAN,MAX_LEAN)*(1-s.drift*.2);
 [s.lean,s.leanVelocity]=damped(s.lean,s.leanVelocity,targetLean,8,dt);
 // Integrate translation with the middle heading, keeping the curve continuous.
 const middleHeading=s.airborne?s.airHeading:s.heading+s.yawRate*dt*.5-s.slipAngle;
 const travel=(oldSpeed+s.speed)*.5*dt;
 const nx=s.x+Math.sin(middleHeading)*travel,nz=s.z-Math.cos(middleHeading)*travel;
 s.boundaryHit=!!environment.contains&&!environment.contains(nx,nz);
 if(s.boundaryHit){s.speed=Math.max(0,s.speed-10*dt);s.yawRate=approach(s.yawRate,0,12,dt);}
 else{s.x=nx;s.z=nz;s.heading+=s.yawRate*dt;}
 const front=scooterSurface(s.x+Math.sin(s.heading)*WHEELBASE*.5,s.z-Math.cos(s.heading)*WHEELBASE*.5,s.heading,environment);
 const rear=scooterSurface(s.x-Math.sin(s.heading)*WHEELBASE*.5,s.z+Math.cos(s.heading)*WHEELBASE*.5,s.heading,environment);
 const roadPitch=Math.atan2(front.height-rear.height,WHEELBASE);
 const contactHeight=(front.height+rear.height)*.5+.04;
 // Contact follows the wheelbase envelope; a crest cannot pull the wheels downward.
 const priorHeight=s.contactHeight??surface.height+.04;
 const contactVelocity=(contactHeight-priorHeight)/dt;
 const coherentSurface=Math.abs(contactHeight-priorHeight)<Math.max(.5,s.speed*dt*1.5);
 if(!s.airborne&&s.contactHeight!==null&&coherentSurface&&s.speed>4){
  const freeHeight=priorHeight+s.groundVelocity*dt-GRAVITY*dt*dt*.5;
  if(freeHeight-contactHeight>.008&&(s.groundVelocity>.5||contactVelocity<-1.5)){
   s.airborne=true;s.airHeading=middleHeading;s.altitude=Math.max(s.altitude,priorHeight);s.verticalVelocity=s.groundVelocity;
  }
 }
 if(s.airborne){
  s.altitude+=s.verticalVelocity*dt-GRAVITY*dt*dt*.5;s.verticalVelocity-=GRAVITY*dt;
  if(s.altitude<=contactHeight&&s.verticalVelocity<=contactVelocity){
   const impact=Math.max(0,contactVelocity-s.verticalVelocity);
   s.airborne=false;s.altitude=contactHeight;s.verticalVelocity=contactVelocity;
   s.landingCompression=Math.min(.12,impact*.008);s.speed*=1-Math.min(.18,impact*.008);
   // Rejoin the actual direction of travel without a sideways kick on landing.
   s.slipAngle=s.heading-s.airHeading;s.slipVelocity=0;
  }
 }else{
  [s.altitude,s.verticalVelocity]=damped(s.altitude,s.verticalVelocity,contactHeight,18,dt);
 }
 s.groundVelocity=coherentSurface?approach(s.groundVelocity,contactVelocity,35,dt):0;
 s.contactHeight=contactHeight;
 const pitchTarget=s.airborne?clamp(Math.atan2(s.verticalVelocity,Math.max(s.speed,1)),-.65,.5):clamp(roadPitch+s.acceleration*.006,-.3,.3);
 [s.pitch,s.pitchVelocity]=damped(s.pitch,s.pitchVelocity,pitchTarget,9,dt);
 return s;
}
export function interpolateScooter(previous,current,alpha){
 const pose={...current};for(const key of ['x','z','altitude','heading','lean','pitch','steering','speed','yawRate','drift','slipAngle','nitroPower','landingCompression'])pose[key]=previous[key]+(current[key]-previous[key])*alpha;
 return pose;
}

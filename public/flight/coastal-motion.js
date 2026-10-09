const GRAVITY=9.81;
export const DIVE_CYCLE=27;
export function divePose(time,index,height,distance,{reducedMotion=false}={}){
 const remainder=(time-index*7)%DIVE_CYCLE,cycle=remainder<0?remainder+DIVE_CYCLE:remainder;
 const launch=2.4,velocity=2.8,flight=(velocity+Math.sqrt(velocity*velocity+2*GRAVITY*Math.max(1,height)))/GRAVITY;
 const airborne=cycle>=launch&&cycle<launch+flight,elapsed=Math.max(0,cycle-launch),u=Math.min(1,elapsed/flight);
 const landed=cycle>=launch+flight,after=cycle-launch-flight;
 const entry=landed&&after<1.8,swimming=landed&&after<8;
 // Rotate about the torso; finish head-first before touching the sea.
 const settle=Math.min(1,Math.max(0,after)/.8),ease=settle*settle*(3-2*settle);
 const spin=reducedMotion?0:airborne?Math.PI*3*(u*u*(3-2*u)):swimming?Math.PI*3-Math.PI/2*ease:0;
 return{cycle,phase:cycle<launch?'run':airborne?'dive':swimming?'swim':'wait',flight,
  forward:airborne?distance*u:swimming?distance+after*.65:cycle<launch?-3*(1-cycle/launch):0,
  y:airborne?height+velocity*elapsed-.5*GRAVITY*elapsed*elapsed:swimming?.3*ease:height,
  spin,tuck:airborne?Math.sin(u*Math.PI)**2:0,splash:entry?after/1.8:-1,cheering:landed&&after<3.5,
  visible:airborne||swimming||cycle<launch||cycle>18};
}
export function grillSmoke(time,index,wind=0,{reducedMotion=false}={}){
 const age=((time*.18+index/8)%1+1)%1;
 return{age,y:1.4+age*4.5,x:reducedMotion?0:Math.sin(index*2.3+time*.3)*age*.6+wind*.07*age*age,z:reducedMotion?0:Math.cos(index*1.7+time*.2)*age*.4,scale:.3+age*1.2,opacity:Math.sin(age*Math.PI)*.22};
}

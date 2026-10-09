import {angleDelta,WIND_DIRECTION,sailTrimTarget,sailingWind} from './sailboat-physics.js';
export function sailWindReading(state,wind){
 const apparent=sailingWind(state,wind),angle=apparent.angle,ideal=sailTrimTarget(angle),degrees=Math.round(Math.abs(angle)*180/Math.PI),calm=wind<.05;
 const side=Math.abs(angle)<.17?'de face':Math.abs(angle)>Math.PI-.17?'de l’arrière':angle>0?'de tribord (droite)':'de bâbord (gauche)';
 const guidance=calm?'Calme plat':Math.abs(angle)<40*Math.PI/180?'Face au vent · change de cap':state.trim>ideal+.08?'Borde la voile ↑':state.trim<ideal-.08?'Choque la voile ↓':'Voile bien réglée';
 return {angle,calm,side,degrees,guidance,trim:Math.round(state.trim*100),windKmh:Math.round(wind*3.6),sourceDegrees:Math.round((WIND_DIRECTION*180/Math.PI+180+360)%360),trueAngle:angleDelta(state.heading,WIND_DIRECTION+Math.PI)};
}
const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
export class SailWindIndicator{
 constructor(root){this.root=root;this.needle=root.querySelector('[data-wind-needle]');this.strength=root.querySelector('[data-wind-strength]');this.side=root.querySelector('[data-wind-side]');this.guide=root.querySelector('[data-wind-guide]');this.readout=root.querySelector('[data-sail-trim]');this.lastAngle=null;}
 update(state,wind){
  const r=sailWindReading(state,wind);
  // Unwrap the bearing at ±180° so the needle never spins through a full turn.
  this.lastAngle=this.lastAngle===null?r.angle:this.lastAngle+angleDelta(this.lastAngle,r.angle);
  this.needle.style.transform=`rotate(${this.lastAngle*180/Math.PI}deg)`;this.needle.style.opacity=r.calm?'0': '1';
  setText(this.strength,`Mistral · NO · ${r.windKmh} km/h`);setText(this.side,r.calm?'Pas de vent':`Arrive ${r.side} · ${r.degrees}°`);setText(this.guide,r.guidance);setText(this.readout,`Voile ${r.trim} %`);
  this.root.setAttribute('aria-label',`${this.strength.textContent}. Vent ressenti : ${this.side.textContent}. ${r.guidance}. ${this.readout.textContent}.`);
 }
 setVisible(visible){this.root.hidden=!visible;if(!visible)this.lastAngle=null;}
}

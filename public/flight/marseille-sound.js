import {toLocal} from './geo.js';
const [stadiumX,stadiumZ]=toLocal(5.3959,43.2698);

// Illustrated soundscape: synthetic crowd, horn, glasses and boules, never recordings.
export class MarseilleSound {
 constructor(){this.enabled=false;this.context=null;this.nextPhrase=0;this.noise=null;this.lastUpdate=-Infinity;this.lastProfile=null;}
 enable(context){
  this.context=context;this.enabled=true;if(!this.master){this.master=context.createGain();this.master.connect(context.destination);}this.master.gain.setTargetAtTime(1,context.currentTime,.1);
  if(!this.noise){
   const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=(Math.random()-.5)*.12;
   const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;source.loop=true;filter.type='bandpass';filter.frequency.value=900;filter.Q.value=.5;gain.gain.value=0;
   source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();this.noise={source,filter,gain};
  }
 }
 disable(){this.enabled=false;this.silence();}
 silence(){if(this.master)this.master.gain.setTargetAtTime(0,this.context.currentTime,.05);if(this.noise)this.noise.gain.gain.setTargetAtTime(0,this.context.currentTime,.1);}
 tone(frequency,duration,volume=.035,delay=0,type='sine',endFrequency=frequency){
  if(!this.context||!this.enabled)return;const c=this.context,start=c.currentTime+delay,osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,start);osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),start+duration);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain);gain.connect(this.master);osc.start(start);osc.stop(start+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 phrase(id,intensity=1){
  if(id==='supporters'||id==='stadium')for(let i=0;i<4;i++)for(const interval of [1,1.25,1.5])this.tone((i<2?196:220)*interval,.55,.016*intensity,i*.45,'triangle');
  else if(id==='divers')for(let i=0;i<5;i++)this.tone(650+i%2*210,.12,.025*intensity,i*.15,'triangle',430);
  else if(id==='prado'||id==='prado-sud')for(let i=0;i<3;i++)this.tone(1400+i*170,.08,.012*intensity,i*.2,'triangle');
  else if(id==='petanque')this.tone(1900,.10,.06*intensity,0,'sine',900);
  else if(id==='ferry')for(const f of [146,220])this.tone(f,1.1,.04*intensity,0,'triangle');
  else if(id==='apero')for(let i=0;i<3;i++)this.tone(1100+i*230,.18,.028*intensity,i*.14);
  else if(id==='panier')for(let i=0;i<2;i++)this.tone(1250,.28,.028*intensity,i*.28,'triangle',750);
  else this.tone(660,.18,.02*intensity);
 }
 update(position,scenes,paused){
  if(!this.enabled||!this.context)return;if(paused){this.silence();return;}if(this.context.currentTime-this.lastUpdate<.15)return;this.lastUpdate=this.context.currentTime;
  const sources=[...scenes,{id:'stadium',x:stadiumX,z:stadiumZ,ground:25}],nearest=sources.map(s=>({...s,distance:Math.hypot(position.x-s.x,position.z-s.z,Math.max(0,position.altitude-(s.ground??0)))})).sort((a,b)=>a.distance-b.distance)[0];
  const intensity=nearest?Math.max(0,1-nearest.distance/450):0,c=this.context;
  this.master.gain.setTargetAtTime(1,c.currentTime,.1);const crowd=nearest?.id==='supporters'||nearest?.id==='stadium';this.noise.gain.gain.setTargetAtTime(intensity*(crowd ? .6 : .22),c.currentTime,.25);
  if(nearest?.id!==this.lastProfile){this.lastProfile=nearest?.id;this.nextPhrase=c.currentTime;}
  if(intensity>.08&&c.currentTime>=this.nextPhrase){this.phrase(nearest.id,intensity);this.nextPhrase=c.currentTime+(nearest.id==='supporters'||nearest.id==='stadium'?4.5:7);}
 }
 reply(id){if(this.enabled)this.phrase(id,.85);}
}

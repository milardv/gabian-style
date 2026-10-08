// A gull-like call synthesized locally; no recording, download or autoplay.
export class GabianCry {
 constructor(){this.context=null;this.nextCall=0;}
 async enable(){
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
  try{
   this.context??=new Audio();const c=this.context;if(c.state==='suspended')await c.resume();
   return c;
  }catch{return null;}
 }
 async play(){
  const c=await this.enable();if(!c)return false;
  try{
   const now=c.currentTime;if(now<this.nextCall)return false;this.nextCall=now+1.5;
   const out=c.createGain();out.gain.value=.17;out.connect(c.destination);
   for(let i=0;i<3;i++){
    const start=now+i*.26,osc=c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter();osc.type='sawtooth';
    osc.frequency.setValueAtTime(930+i*65,start);osc.frequency.exponentialRampToValueAtTime(1580+i*50,start+.065);osc.frequency.exponentialRampToValueAtTime(670,start+.22);
    filter.type='bandpass';filter.frequency.value=1450;filter.Q.value=.8;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.7,start+.035);gain.gain.exponentialRampToValueAtTime(.001,start+.24);
    osc.connect(filter);filter.connect(gain);gain.connect(out);osc.start(start);osc.stop(start+.25);osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();if(i===2)out.disconnect();};
   }return true;
  }catch{return false;}
 }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {MarseilleSound} from '../public/flight/marseille-sound.js';
import {LIFE_SCENES} from '../public/flight/life-rules.js';
function audio(){
 const stats={sources:0,tones:0},param=()=>({value:0,target:null,setTargetAtTime(v){this.target=v;},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){},gain:param()});
 return{stats,currentTime:0,sampleRate:200,destination:{},createGain:node,createBuffer:(_,size)=>({getChannelData:()=>new Float32Array(size)}),createBufferSource(){stats.sources++;return{...node(),start(){}};},createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),createOscillator(){stats.tones++;return{...node(),frequency:param(),start(){},stop(){}};}};
}
test('Ambiance silencieuse avant activation, atténuée avec la distance et en pause',()=>{
 const sound=new MarseilleSound(),c=audio(),s=LIFE_SCENES[0],near={x:s.x,z:s.z,altitude:20};
 sound.update(near,[s],false);assert.equal(c.stats.sources,0);assert.equal(c.stats.tones,0);
 sound.enable(c);sound.update(near,[s],false);assert.equal(c.stats.sources,1);assert.ok(c.stats.tones>0);assert.ok(sound.noise.gain.gain.target>0);
 c.currentTime=1;sound.update({x:90000,z:90000,altitude:100},[s],false);assert.equal(sound.noise.gain.gain.target,0);
 sound.update(near,[s],true);assert.equal(sound.master.gain.target,0);
 const before=c.stats.tones;sound.disable();sound.reply('supporters');assert.equal(c.stats.tones,before);
 sound.enable(c);assert.equal(c.stats.sources,1);
});

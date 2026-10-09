import test from 'node:test';
import assert from 'node:assert/strict';
import {LoadingProgress,showLoadingProgress} from '../public/flight/loading-progress.js';
import {CityWorld} from '../public/flight/world.js';

test('Progression : seules les étapes achevées comptent, sans doublons ni recul',()=>{
 const values=[],progress=new LoadingProgress(v=>values.push(v));
 progress.stage('boundary');progress.stage('overview');assert.equal(values.at(-1).percent,0);
 progress.stage('boundary',true);assert.equal(values.at(-1).percent,13);assert.match(values.at(-1).label,/relief général/);
 progress.stage('boundary',true);progress.stage('unknown',true);assert.equal(values.at(-1).percent,13);
 for(const stage of ['cache','overview','terrain','buildings','geometry','mission'])progress.stage(stage,true);
 assert.equal(values.at(-1).percent,88);progress.stage('ready');assert.equal(values.at(-1).percent,88);
 progress.stage('ready',true);assert.equal(values.at(-1).percent,100);assert.match(values.at(-1).label,/prête/);
 const count=values.length;progress.stage('terrain');assert.equal(values.length,count);
 assert.ok(values.every((v,i)=>!i||v.percent>=values[i-1].percent));
});
test('Progression : une erreur garde le dernier pourcentage et bloque les résultats tardifs',()=>{
 const values=[],progress=new LoadingProgress(v=>values.push(v));progress.stage('cache',true);progress.stage('terrain');progress.fail('IGN indisponible');
 assert.equal(values.at(-1).percent,13);assert.equal(values.at(-1).error,true);assert.equal(values.at(-1).label,'IGN indisponible');
 progress.stage('terrain',true);assert.equal(values.at(-1).percent,13);
});
test('Monde : progression bâtiments après le JSON et progression 3D après le worker',async()=>{
 const world=Object.create(CityWorld.prototype),events=[];world.onStartup=(...args)=>events.push(args);world.jobs=new Map();world.serial=0;world.rebuildCollisions=()=>{};
 let resolveWorker,workerStarted;const started=new Promise(r=>workerStarted=r);
 world.worker={postMessage({id}){resolveWorker=()=>world.jobs.get(id).resolve({collisionRoofs:[],sides:[],roofs:[],domes:[],towers:[],statues:[]});workerStarted();}};
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({buildings:[],structures:[],measured:0})});
 try{const pending=world.build({terrain:{}},1,2);await started;
  assert.deepEqual(events,[['buildings',false],['buildings',true],['geometry',false]]);
  resolveWorker();await pending;assert.deepEqual(events.at(-1),['geometry',true]);
 }finally{globalThis.fetch=original;}
});
test('Affichage : pourcentage lisible, barre accessible et état d’erreur',()=>{
 const attributes={},bar={dataset:{},firstElementChild:{style:{}},setAttribute:(k,v)=>attributes[k]=v},number={},status={};
 showLoadingProgress({percent:50,label:'Relief du départ…',error:false},bar,number,status);
 assert.equal(number.textContent,'50 %');assert.equal(attributes['aria-valuenow'],'50');assert.equal(bar.firstElementChild.style.transform,'scaleX(0.5)');assert.equal(status.textContent,'Relief du départ…');
 showLoadingProgress({percent:50,label:'Erreur IGN',error:true},bar,number,status);assert.equal(bar.dataset.state,'error');assert.match(attributes['aria-valuetext'],/Erreur IGN/);
});

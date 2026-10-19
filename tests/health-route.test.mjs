import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import payload from '../api/health-payload.cjs';

const source=fs.readFileSync(new URL('../api/health-sync.js',import.meta.url),'utf8').replace('export default async function handler','module.exports = async function handler');
function setup({known=true,fail=false}={}) {
 const store={steps:1,workouts:[{name:'Kept workout'}],calories:1200};
 const calls=[];let currentDate;
 const query={where(...args){calls.push(args);return this;},limit(){return this;},async get(){return {empty:!known,docs:[{id:'test-user'}]};},doc(id){currentDate=id;return this;},collection(){return this;},async set(data,options){if(fail)throw new Error('failed');calls.push({date:currentDate,data,options});Object.assign(store,data);}};
 const module={exports:{}};
 vm.runInNewContext(source,{module,require:name=>name==='firebase-admin'?{apps:[{}],firestore:()=>({collection:()=>query})}:payload,process:{env:{}},console:{error(){}},Date});
 const send=async(method,body)=>{
  const response={headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}};
  await module.exports({method,body},response);return response;
 };
 return {store,calls,send};
}
const body={syncToken:'a'.repeat(64),date:'2026-10-19',steps:0};
test('health route replaces totals on retry while preserving workout and meal fields',async()=>{
 const {send,store,calls}=setup();
 assert.equal((await send('POST',body)).code,200);assert.equal(store.steps,0);assert.equal(store.calories,1200);assert.equal(store.workouts.length,1);
 assert.equal((await send('POST',{...body,steps:8432})).body.success,true);
 await send('POST',{...body,steps:8432});assert.equal(store.steps,8432);assert.ok(store.healthSyncedAt);
 assert.equal(calls.at(-1).date,'2026-10-19');assert.equal(calls.at(-1).options.merge,true);
});
test('route rejects bad methods, missing body and unknown tokens without writes',async()=>{
 const {send,calls}=setup({known:false});
 assert.equal((await send('OPTIONS')).code,204);assert.equal((await send('GET')).code,405);
 assert.equal((await send('POST')).code,400);assert.equal((await send('POST',body)).code,401);
 assert.equal(calls.filter(x=>x.data).length,0);
});
test('failed health writes return a retryable error without echoing credentials',async()=>{
 const {send}=setup({fail:true});const result=await send('POST',body);
 assert.equal(result.code,500);assert.equal(JSON.stringify(result.body).includes(body.syncToken),false);
 assert.equal(result.headers['Cache-Control'],'no-store');
});

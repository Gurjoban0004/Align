import test from 'node:test';
import assert from 'node:assert/strict';
import {newExercise, workingSets, volume, finishSession, records, weekSummary, workoutCSV, validSet, localDate} from '../fitness-core.mjs';
import payload from '../api/health-payload.cjs';

test('only completed working sets count; warmups stay in saved history',()=>{
 const ex=newExercise({name:'Bench Press',sets:3,weight:60,reps:10});
 ex.setEntries[0].done=true;ex.setEntries[0].type='warmup';ex.setEntries[1].done=true;
 assert.equal(workingSets(ex).length,1);assert.equal(volume([ex]),600);
 const day={workouts:[{name:'Squats',sets:2,reps:5,weight:80}],workoutDraft:{id:'a',name:'Push',startedAt:1000,exercises:[ex]}};
 finishSession(day,61000);
 assert.equal(day.workouts.length,2);assert.equal(day.workouts[1].setEntries.length,2);assert.equal(day.trainingSessions[0].durationSec,60);assert.equal(day.workoutDraft,null);
 assert.equal(volume(day.workouts),1400);
 assert.throws(()=>finishSession(day),/No active/);
});
test('finish with no completed sets preserves draft and earlier workouts',()=>{
 const day={workouts:[],workoutDraft:{id:'a',exercises:[newExercise({name:'Bench Press'})]}};
 assert.throws(()=>finishSession(day),/Complete at least/);assert.ok(day.workoutDraft);assert.equal(day.workouts.length,0);
});
test('multiple sessions and reloaded drafts append without replacing history',()=>{
 const day={workouts:[]};
 for(let i=0;i<2;i++){
  day.workoutDraft=JSON.parse(JSON.stringify({id:String(i),name:'Session',startedAt:0,exercises:[newExercise({name:'Bench Press',weight:60,reps:5,sets:1})]}));
  day.workoutDraft.exercises[0].setEntries[0].done=true;finishSession(day,60000);
 }
 assert.equal(day.trainingSessions.length,2);assert.equal(day.workouts.length,2);assert.equal(volume(day.workouts),600);
});
test('records ignore unfinished legacy logs and use exact single-rep maximum',()=>{
 const best=records({'2026-10-19':{workouts:[{name:'Bench Press',weight:100,reps:1,sets:1},{name:'Squats',weight:500,reps:10,sets:5,logged:false}]}});
 assert.equal(best.length,1);assert.equal(best[0].estimated,100);
});
test('week groups local Monday through Sunday and includes legacy logs',()=>{
 const result=weekSummary({'2026-10-19':{workouts:[{name:'Squats',weight:80,reps:5,sets:2}]}},'2026-10-21');
 assert.equal(result[0].date,'2026-10-19');assert.equal(result[6].date,'2026-10-25');assert.equal(result[0].sets,2);assert.equal(result[0].volume,800);
 assert.equal(localDate(new Date(2026,9,19,0,1)),'2026-10-19');
});
test('set validation rejects invalid values and CSV escapes custom names',()=>{
 assert.equal(validSet({weight:-1,reps:5,type:'working'}),false);
 assert.equal(validSet({weight:5,reps:2.5,type:'working'}),false);
 assert.equal(validSet({weight:0,reps:5,type:'working',rpe:''}),true);
 const csv=workoutCSV({'2026-10-19':{workouts:[{name:'=SUM(1,2)',weight:20,reps:5,sets:1}]}});
 assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('Weight (kg)'));
});
const base={syncToken:'a'.repeat(64),date:'2026-10-19'};
test('health import accepts zero, strict local dates and formatted totals',()=>{
 assert.equal(payload.parseHealthPayload({...base,steps:0}).updateData.steps,0);
 assert.equal(payload.parseHealthPayload({...base,Steps:'12,345'}).updateData.steps,12345);
 assert.equal(payload.parseHealthPayload({...base,date:'2026-02-30',steps:10}).status,400);
 assert.equal(payload.parseHealthPayload({...base,date:'19/10/26',steps:10}).status,400);
});
test('health import rejects junk, infinity, negatives, booleans and missing bodies',()=>{
 for(const steps of ['100oops','',Infinity,-1,true,{},'1,5']) assert.equal(payload.parseHealthPayload({...base,steps}).status,400);
 assert.equal(payload.parseHealthPayload(null).status,400);assert.equal(payload.parseHealthPayload({date:base.date,steps:1}).status,401);
 assert.equal(payload.parseHealthPayload(base).status,400);
});

test('Firestore object key ordering does not cause editor-destroying save echoes',async()=>{
 const {sameStoredData}=await import('../fitness-core.mjs');
 assert.equal(sameStoredData({steps:10,workoutDraft:{name:'Push',exercises:[]}},{workoutDraft:{exercises:[],name:'Push'},steps:10}),true);
 assert.equal(sameStoredData({steps:10},{steps:11}),false);
 assert.equal(sameStoredData({exercises:[1,2]},{exercises:[2,1]}),false);
});

import { EXERCISES, MUSCLES, SET_TYPES, exerciseInfo, newExercise, newSet, validSet, workingSets, volume, records, weekSummary, finishSession, workoutCSV } from './fitness-core.mjs';

let selectedTab = 'train';
let selectedMuscle = 'All';
let timerHandle;
const fmt = n => Math.round(n).toLocaleString();
const clock = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

export function stopFitnessTimer() { clearInterval(timerHandle); }

export function createTrainingWorkspace({ state, el, save, renderNutrition, openSteps }) {
  const root = el('div', {class:'section training-page'});
  const shell = el('div', {class:'container training-shell'});
  root.appendChild(shell);
  const day = () => state.logs[state.dateStr];
  const button = (text, action, kind = 'secondary', attrs = {}) => el('button', {type:'button', class:`train-btn train-btn-${kind}`, onClick:action, ...attrs}, text);
  const text = (content, cls = 'train-muted') => el('p', {class:cls}, content);
  const field = (label, input) => el('label', {class:'train-field'}, el('span',{},label), input);
  const number = (value, min, max, step = 1) => {
    const input = el('input', {type:'number',min,max,step,inputmode:'decimal',required:'',class:'train-input'}); input.value = value; return input;
  };
  const select = (values, value, action, label) => {
    const input = el('select', {class:'train-input','aria-label':label,onChange: e => action(e.target.value)});
    values.forEach(v => { const option = el('option',{value:v},v); option.selected = v === value; input.appendChild(option); });
    return input;
  };
  const panel = (title, ...children) => el('section',{class:'train-panel'}, el('h3',{},title), ...children);
  const empty = (title, description) => el('div',{class:'train-empty'},el('h3',{},title),text(description));
  const persist = () => save();
  const download = (content, filename, type) => {
    const url = URL.createObjectURL(new Blob([content],{type}));
    const a = el('a',{href:url,download:filename}); a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function start(name, exercises = []) {
    if (day().workoutDraft) { selectedTab = 'train'; render(); return; }
    day().workoutDraft = {id:crypto.randomUUID(),name,startedAt:Date.now(),restEndsAt:null,restSeconds:90,exercises:exercises.map(newExercise)};
    persist(); selectedTab = 'train'; render();
  }
  function addExercise(ex) {
    if (!day().workoutDraft) start('Freestyle workout');
    day().workoutDraft.exercises.push(newExercise({...ex,weight:0}));
    persist(); selectedTab = 'train'; render();
  }
  function render() {
    stopFitnessTimer();
    shell.replaceChildren();
    const week = weekSummary(state.logs,state.dateStr);
    const trained = week.filter(d=>d.sets>0).length;
    const title = el('div',{class:'train-heading'},
      el('div',{},el('span',{class:'page-kicker'},'YOUR TRAINING, IN FOCUS'),el('h1',{},'Build your rhythm.'),text('Show up. Log the work. See what changes.')),
      el('div',{class:'train-date'},el('span',{},new Date(state.dateStr+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})),el('small',{},'Selected day'))
    );
    const tabs = el('nav',{class:'train-tabs','aria-label':'Fitness sections'});
    [['train','Workout'],['library','Exercises'],['routines','Routines'],['progress','Progress'],['nutrition','Nutrition']].forEach(([id,label]) => tabs.appendChild(button(label,()=>{selectedTab=id;render();},selectedTab===id?'active':'tab',{'aria-current':selectedTab===id?'page':'false'})));
    shell.append(title,tabs);
    if (selectedTab === 'nutrition') { shell.appendChild(renderNutrition()); return; }
    const metrics = el('div',{class:'train-metrics'},
      metric(`${trained} / 7`,'Training days this week'),metric(`${fmt(week.reduce((n,d)=>n+d.volume,0))} kg`,'Working volume this week'),metric(fmt(week.reduce((n,d)=>n+d.sets,0)),'Working sets this week'),
      el('button',{class:'train-metric train-step-metric',type:'button',onClick:()=>openSteps(day())},el('strong',{},fmt(day().steps||0)),el('span',{},'Daily steps · tap to log'))
    );
    shell.appendChild(metrics);
    if (selectedTab === 'train') renderTrain();
    if (selectedTab === 'library') renderLibrary();
    if (selectedTab === 'routines') renderRoutines();
    if (selectedTab === 'progress') renderProgress(week);
    shell.appendChild(el('footer',{class:'train-credit'},'Training workflow inspired by ',el('a',{href:'https://github.com/InlitX/GymMane',target:'_blank',rel:'noopener noreferrer'},'GymMane by InlitX'),'. Built for Align.'));
  }
  function metric(value,label) { return el('div',{class:'train-metric'},el('strong',{},value),el('span',{},label)); }
  function renderTrain() {
    const draft = day().workoutDraft;
    const main = el('div',{class:'train-layout'}), left=el('div',{class:'train-stack'}), right=el('aside',{class:'train-stack'});
    main.append(left,right); shell.appendChild(main);
    if (!draft) {
      const hero = el('section',{class:'train-hero'},el('span',{class:'train-eyebrow'},'READY WHEN YOU ARE'),el('h2',{},'A little stronger,\none session at a time.'),text('Start with your routine, or build a workout as you go. Your previous sessions stay safe.','train-hero-copy'),button('＋ Start a workout',()=>start('Freestyle workout'),'light'));
      left.appendChild(hero);
      const routines=Object.entries(state.workoutSplit);
      const list = el('div',{class:'train-routine-grid'});
      routines.forEach(([name,exercises],i) => list.appendChild(el('div',{class:'train-routine'},el('span',{class:'train-index'},String(i+1).padStart(2,'0')),el('h4',{},name),text(`${exercises.length} exercises · ${exercises.reduce((n,e)=>n+Number(e.sets||3),0)} sets`),button('Start routine →',()=>start(name,exercises),'text'))));
      left.appendChild(panel('Your go-to routines',list));
    } else {
      const heading=el('div',{class:'train-session-header'},el('div',{},el('span',{class:'train-eyebrow'},'SESSION IN PROGRESS · SAVED ON THIS DEVICE'),el('h2',{},draft.name)),el('strong',{'data-session-clock':''},'0:00'));
      const finish=()=>{
        try { const session=finishSession(day()); persist(); alert(`Workout saved · ${clock(session.durationSec)}. Completed sets are in your history.`); render(); }
        catch(e) { alert(e.message); }
      };
      left.appendChild(panel('Your workout',heading,text('Weights are in kg. Mark each completed set; unfinished sets are not added to history. Warm-ups are excluded from working volume.'),el('div',{class:'train-actions'},button('Finish workout',finish,'primary'),button('Add exercise',()=>{selectedTab='library';render();}),button('Discard draft',()=>{if(confirm('Discard this unfinished workout? Saved workouts will be kept.')){day().workoutDraft=null;persist();render();}},'text'))));
      draft.exercises.forEach((ex,index)=>left.appendChild(renderExercise(ex,index,draft)));
      if (!draft.exercises.length) left.appendChild(empty('Make it your workout','Choose Add exercise to browse movements or add your own.'));
      const timerLabel = el('strong',{'data-rest-clock':'','aria-live':'off'},'Ready');
      const duration=select(['30','60','90','120','180'],String(draft.restSeconds),v=>{draft.restSeconds=Number(v);persist();},'Rest duration in seconds');
      right.appendChild(panel('Between sets',text('REST TIMER','train-eyebrow'),el('div',{class:'train-rest-display'},timerLabel),field('Seconds',duration),el('div',{class:'train-actions'},button('Start rest',()=>{draft.restEndsAt=Date.now()+draft.restSeconds*1000;persist();updateTimers();},'primary'),button('Skip',()=>{draft.restEndsAt=null;persist();updateTimers();})),text('The countdown catches up after you reopen the app. Keep it open for the end-of-rest alert.')));
      const updateTimers = () => {
        if (!root.isConnected) return;
        const elapsed = Math.max(0,Math.floor((Date.now()-draft.startedAt)/1000));
        shell.querySelector('[data-session-clock]').textContent=clock(elapsed);
        const remaining=draft.restEndsAt ? Math.max(0,Math.ceil((draft.restEndsAt-Date.now())/1000)):0;
        timerLabel.textContent=remaining?clock(remaining):'Ready';
        if (draft.restEndsAt && remaining===0) { draft.restEndsAt=null;timerLabel.textContent='Rest complete';timerLabel.setAttribute('role','status');persist(); }
      };
      queueMicrotask(updateTimers); timerHandle=setInterval(updateTimers,1000);
    }
    const goal=Number(state.profile?.targetSteps)||10000;
    right.appendChild(panel('Beyond the gym',text(`${fmt(day().steps||0)} / ${fmt(goal)} steps`),el('progress',{max:goal,value:Math.min(goal,day().steps||0),'aria-label':'Daily step goal'}),text(day().healthSyncedAt?`Health data received ${new Date(day().healthSyncedAt).toLocaleString()}`:'Log steps manually or connect Apple Health in Settings → System.'),el('a',{href:'#settings',class:'train-link'},'Connect your iPhone →')));
    const history=el('div',{class:'train-history'});
    const sessions=day().trainingSessions||[];
    sessions.forEach(session=>{
      const exercises=(day().workouts||[]).filter(ex=>ex.sessionId===session.id);
      history.appendChild(historyCard(session.name,exercises,`${clock(session.durationSec)} · ${exercises.length} exercises`));
    });
    const legacy=(day().workouts||[]).filter(ex=>!ex.sessionId);
    if (legacy.length) history.appendChild(historyCard('Earlier workout logs',legacy,'Preserved from Align'));
    if (!history.childNodes.length) history.appendChild(text('Your finished workouts will appear here.'));
    left.appendChild(panel('Saved on this day',history));
  }
  function historyCard(name,exercises,subtitle) {
    return el('details',{class:'train-history-card'},el('summary',{},el('strong',{},name),el('span',{},`${subtitle} · ${fmt(volume(exercises))} kg`)),...exercises.map(ex=>el('div',{class:'train-history-row'},el('span',{},ex.name),el('span',{},`${workingSets(ex).length} sets · ${fmt(volume([ex]))} kg`))));
  }
  function renderExercise(ex,index,draft) {
    const old=[];
    Object.entries(state.logs).filter(([date])=>date<=state.dateStr).sort(([a],[b])=>b.localeCompare(a)).some(([,log])=>{
      const previous=[...(log.workouts||[])].reverse().find(item=>item.name.toLowerCase()===ex.name.toLowerCase()&&workingSets(item).length);
      if(previous) {old.push(...workingSets(previous));return true;} return false;
    });
    const card=el('section',{class:'train-panel train-exercise'},el('div',{class:'train-exercise-heading'},el('div',{},text(`${ex.muscle} / ${ex.equipment}`,'train-eyebrow'),el('h3',{},ex.name)),button('×',()=>{if(confirm(`Remove ${ex.name} from this draft?`)){draft.exercises.splice(index,1);persist();render();}},'text',{'aria-label':`Remove ${ex.name}`})),text(old.length?`Previous: ${old.map(s=>`${s.weight} kg × ${s.reps}`).join(' · ')}`:'First time here. Start with a weight that suits you.'));
    const table=el('div',{class:'train-set-table'});
    table.appendChild(el('div',{class:'train-set-row train-set-labels'},...['SET','TYPE','KG','REPS','RPE','DONE'].map(t=>el('span',{},t))));
    ex.setEntries.forEach((s,i)=>{
      const weight=number(s.weight,0,2000,0.5),reps=number(s.reps,1,1000),rpe=number(s.rpe,1,10,0.5);rpe.required=false;rpe.placeholder='—';
      weight.setAttribute('aria-label',`${ex.name} set ${i+1} weight in kg`); reps.setAttribute('aria-label',`${ex.name} set ${i+1} reps`);rpe.setAttribute('aria-label',`${ex.name} set ${i+1} RPE optional`);
      const setType=select(SET_TYPES,s.type,v=>{s.type=v;persist();},`${ex.name} set ${i+1} type`);
      [weight,reps,rpe].forEach((input,j)=>input.addEventListener('change',()=>{
        if (!input.checkValidity()) {input.reportValidity();return;}
        s[['weight','reps','rpe'][j]]=input.value===''?'':Number(input.value);persist();
      }));
      const done=button(s.done?'✓':'○',()=>{
        if(![weight,reps,rpe].every(input=>input.reportValidity()))return;
        Object.assign(s,{weight:Number(weight.value),reps:Number(reps.value),rpe:rpe.value===''?'':Number(rpe.value)});
        if (!validSet(s)) {alert('Check this set’s weight, reps and RPE.');return;}
        s.done=!s.done;
        if(s.done) draft.restEndsAt=Date.now()+draft.restSeconds*1000;
        persist();render();
      },s.done?'complete':'check',{'aria-label':`${ex.name} set ${i+1} completed`,'aria-pressed':String(s.done)});
      table.appendChild(el('div',{class:`train-set-row ${s.done?'is-done':''}`},el('span',{},i+1),setType,weight,reps,rpe,done));
    });
    card.appendChild(table);
    card.appendChild(el('div',{class:'train-actions'},button('＋ Add set',()=>{ex.setEntries.push(newSet(ex.setEntries.at(-1)));persist();render();},'text'),button('Remove last set',()=>{if(ex.setEntries.length>1&&(!ex.setEntries.at(-1).done||confirm('Remove this completed set?'))){ex.setEntries.pop();persist();render();}},'text')));
    return card;
  }
  function renderLibrary() {
    const search=el('input',{type:'search',placeholder:'Search movements…',class:'train-input','aria-label':'Search exercises'});
    let equipment='All';
    const list=el('div',{class:'train-library-grid'});
    const filters=el('div',{class:'train-muscles','aria-label':'Muscle filters'});
    ['All',...MUSCLES].forEach(m=>filters.appendChild(button(m,()=>{selectedMuscle=m;refresh();},'chip',{'aria-pressed':String(selectedMuscle===m)})));
    const refresh=()=>{
      filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===selectedMuscle)));
      const found=EXERCISES.filter(ex=>(selectedMuscle==='All'||ex.muscle===selectedMuscle)&&(equipment==='All'||ex.equipment===equipment)&&ex.name.toLowerCase().includes(search.value.toLowerCase()));
      list.replaceChildren(...found.map(ex=>el('article',{class:'train-library-card'},el('div',{class:'train-movement-mark','aria-hidden':'true'},MUSCLES.indexOf(ex.muscle)+1),el('div',{},text(ex.muscle,'train-eyebrow'),el('h4',{},ex.name),text(ex.equipment)),button('＋ Add',()=>addExercise(ex),'secondary',{'aria-label':`Add ${ex.name}`}))));
      if(!found.length)list.appendChild(empty('No matching movements','Try another filter or add a custom exercise below.'));
    };
    search.addEventListener('input',refresh);
    shell.appendChild(panel('Find your next movement',text(`${EXERCISES.length} movements. Filter by muscle and equipment, or bring your own.`),el('div',{class:'train-search-row'},search,select(['All','Barbell','Dumbbell','Cable','Machine','Bodyweight'],equipment,v=>{equipment=v;refresh();},'Filter equipment')),filters,list));
    const name=el('input',{class:'train-input',placeholder:'Exercise name',required:'',maxlength:'80'});let muscle='Chest';
    const custom=el('form',{class:'train-custom-form',onSubmit:e=>{e.preventDefault();const value=name.value.trim();if(!value)return;addExercise({name:value,muscle,equipment:'Custom'});}},field('Custom movement',name),field('Primary muscle',select(MUSCLES,muscle,v=>muscle=v,'Custom exercise muscle')),el('button',{type:'submit',class:'train-btn train-btn-primary'},'Add to workout'));
    shell.appendChild(panel('Your own exercise',custom));refresh();
  }
  function renderRoutines() {
    const list=el('div',{class:'train-routine-grid'});
    Object.entries(state.workoutSplit).forEach(([name,exercises])=>list.appendChild(el('article',{class:'train-routine'},el('h3',{},name),...exercises.map(ex=>text(`${ex.name} · ${ex.sets} × ${ex.reps} · ${ex.weight} kg`)),el('div',{class:'train-actions'},button('Start',()=>start(name,exercises),'primary'),button('Edit',()=>editRoutine(name)),button('Duplicate',()=>editRoutine(name,true)),button('Delete',()=>{if(confirm(`Delete the ${name} template? Workout history will be kept.`)){delete state.workoutSplit[name];persist();render();}},'text')))));
    shell.appendChild(el('div',{class:'train-section-heading'},el('div',{},el('h2',{},'Your training playbook'),text('Templates you can return to. Starting one never overwrites a saved workout.')),button('＋ New routine',()=>editRoutine(),'primary')),list);
  }
  function editRoutine(original, duplicate=false) {
    const dialog=el('dialog',{class:'train-dialog','aria-label':original?'Edit routine':'New routine'});
    const name=el('input',{class:'train-input',required:'',maxlength:'80'});name.value=original?(duplicate?`${original} copy`:original):'';
    const entries=(original?state.workoutSplit[original]:[]).map(ex=>({...ex}));
    const rows=el('div',{class:'train-stack'});
    function drawRows() {
      rows.replaceChildren();
      entries.forEach((ex,i)=>{
        const label=el('input',{class:'train-input',required:'',maxlength:'80'});label.value=ex.name;label.addEventListener('input',()=>ex.name=label.value);
        const sets=number(ex.sets,1,20),reps=number(ex.reps,1,1000),weight=number(ex.weight,0,2000,0.5);
        [sets,reps,weight].forEach((input,j)=>input.addEventListener('input',()=>ex[['sets','reps','weight'][j]]=Number(input.value)));
        rows.appendChild(el('div',{class:'train-routine-editor-row'},field('Exercise',label),field('Sets',sets),field('Reps',reps),field('kg',weight),button('×',()=>{entries.splice(i,1);drawRows();},'text',{'aria-label':`Remove exercise ${i+1}`})));
      });
    }
    const close=()=>{dialog.close();dialog.remove();};
    const form=el('form',{class:'train-stack',onSubmit:e=>{
      e.preventDefault();const key=name.value.trim();
      if(!key||!entries.length||entries.some(ex=>!ex.name.trim())){alert('Name your routine and add at least one named exercise.');return;}
      if(['__proto__','constructor','prototype'].includes(key)){alert('Choose another routine name.');return;}
      if((key!==original||duplicate)&&Object.hasOwn(state.workoutSplit,key)){alert('A routine with that name already exists.');return;}
      if(original&&!duplicate&&key!==original)delete state.workoutSplit[original];
      state.workoutSplit[key]=entries.map(ex=>({...ex,name:ex.name.trim()}));persist();close();render();
    }},el('div',{class:'train-section-heading'},el('h2',{},duplicate?'Duplicate routine':original?'Edit routine':'New routine'),button('×',close,'text',{'aria-label':'Close routine editor'})),field('Routine name',name),rows,button('＋ Add movement',()=>{entries.push({name:'',sets:3,reps:10,weight:0});drawRows();}),el('button',{type:'submit',class:'train-btn train-btn-primary'},'Save routine'));
    dialog.appendChild(form);document.body.appendChild(dialog);dialog.addEventListener('cancel',()=>dialog.remove());drawRows();dialog.showModal();name.focus();
  }
  function renderProgress(week) {
    const grid=el('div',{class:'train-progress-grid'});
    const chart=el('div',{class:'train-week-chart','aria-label':'Working sets by day'});
    const max=Math.max(1,...week.map(d=>d.sets));
    week.forEach(d=>chart.appendChild(el('div',{class:'train-chart-column'},el('span',{},d.sets),el('div',{class:'train-bar-track'},el('div',{class:`train-bar ${d.date===state.dateStr?'selected':''}`,style:{height:`${Math.max(d.sets?5:0,d.sets/max*100)}%`}})),el('span',{},d.label))));
    grid.appendChild(panel('This week’s rhythm',text('Completed working sets · Monday to Sunday'),chart));
    const split={};Object.entries(state.logs).filter(([date])=>date<=state.dateStr).forEach(([,log])=>(log.workouts||[]).forEach(ex=>{const muscle=ex.muscle||exerciseInfo(ex.name).muscle;split[muscle]=(split[muscle]||0)+workingSets(ex).length;}));
    const total=Object.values(split).reduce((a,b)=>a+b,0);
    const muscles=el('div',{class:'train-stack'});
    Object.entries(split).filter(([,count])=>count).sort((a,b)=>b[1]-a[1]).forEach(([muscle,count])=>muscles.appendChild(el('div',{},el('div',{class:'train-split-label'},el('span',{},muscle),el('strong',{},`${count} sets`)),el('progress',{max:total,value:count,'aria-label':`${muscle}: ${count} working sets`}))));
    grid.appendChild(panel('Where the work goes',text('All recorded working sets through the selected day'),total?muscles:empty('A fresh start','Your muscle split appears after your first saved workout.')));
    shell.appendChild(grid);
    const best=records(Object.fromEntries(Object.entries(state.logs).filter(([date])=>date<=state.dateStr)));
    const list=el('div',{class:'train-records'});
    best.forEach(pr=>list.appendChild(el('div',{class:'train-record'},el('div',{},el('h4',{},pr.name),text(`${pr.weight} kg × ${pr.reps} · ${pr.date}`)),el('div',{},el('strong',{},pr.weight?`${Math.round(pr.estimated*10)/10} kg`:`${pr.reps} reps`),el('small',{},pr.weight?'Estimated 1RM':'Bodyweight set')))));
    shell.appendChild(panel('Your strength benchmarks',text('Best estimated 1RM using the Epley formula. Warm-ups are excluded; high-rep estimates are less precise.'),best.length?list:empty('Your first benchmark is ahead','Finish a workout to see records from your completed sets.')));
    const history=el('div',{class:'train-history'});
    Object.entries(state.logs).filter(([date,log])=>date<=state.dateStr&&(log.workouts||[]).some(ex=>workingSets(ex).length)).sort(([a],[b])=>b.localeCompare(a)).forEach(([date,log])=>history.appendChild(historyCard(date,log.workouts,`${(log.trainingSessions||[]).length || 'Legacy'} sessions`)));
    shell.appendChild(panel('Training history',history.childNodes.length?history:text('Saved training days appear here.')));
    shell.appendChild(el('div',{class:'train-actions'},button('Export workout CSV',()=>download(workoutCSV(state.logs),'align-workouts.csv','text/csv'),'primary'),button('Back up fitness data',()=>download(JSON.stringify({version:1,logs:state.logs,workoutSplit:state.workoutSplit},null,2),'align-fitness-backup.json','application/json'))));
  }
  render();return root;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManifest,validateBytes,checkSubmit,studentAccess,teacherScope,canTeach,quotaCheck,expired,LIMIT,MiB} from '../server/domain.js';
const student={id:'s',role:'student',group_id:'g',subgroup:1};
const assignment={id:'a',teacher_id:'t',publication_status:'published',targets:[{group_id:'g',subgroup:1}],due_at:'2026-11-21T04:00:00.000Z',late_policy:'close'};
test('25 files totalling exactly 25 MiB accepted; one byte over rejected',()=>{
  const files=Array.from({length:25},(_,i)=>({name:`file${i}.txt`,size:MiB,type:'text/plain'}));
  assert.equal(validateManifest(files).total,LIMIT);
  assert.throws(()=>validateManifest([{name:'file.txt',size:LIMIT+1}]),/лимит/);
  assert.throws(()=>validateManifest([...files,{name:'extra.txt',size:1}]),/25 файлов/);
});
test('extensions, MIME mismatch, signatures and empty files rejected',()=>{
  for(const file of [{name:'run.exe',size:10},{name:'report.pdf',size:10,type:'text/html'},{name:'empty.txt',size:0}])assert.throws(()=>validateManifest([file]));
  assert.throws(()=>validateBytes({name:'a.pdf',size:3},[1,2,3]),/PDF/);
  assert.throws(()=>validateBytes({name:'a.txt',size:2},[65,0]),/бинарные/);
  assert.doesNotThrow(()=>validateBytes({name:'a.pdf',size:5},[37,80,68,70,45]));
});
test('start time determines lateness, deadline itself counts on time',()=>{
  assert.equal(checkSubmit(student,assignment,null,'2026-11-21T03:59:59.000Z'),false);
  assert.equal(checkSubmit(student,assignment,null,assignment.due_at),false);
  assert.throws(()=>checkSubmit(student,assignment,null,'2026-11-21T04:00:00.001Z'),/истёк/);
});
test('revision allowed after closed deadline; accepted blocks replacement',()=>{
  assert.equal(checkSubmit(student,assignment,{status:'needs_revision'},'2026-11-22T00:00:00.000Z'),true);
  assert.throws(()=>checkSubmit(student,assignment,{status:'accepted'},'2026-11-20T00:00:00.000Z'),/принята/);
});
test('removed student retains own files; draft hides everything; archive grade only',()=>{
  const changed={...assignment,targets:[{group_id:'other'}]};
  assert.equal(studentAccess(student,changed,{id:'s'},'own'),true);
  assert.equal(studentAccess(student,changed,{id:'s'}),false);
  assert.equal(studentAccess(student,{...changed,publication_status:'draft'},{},'own'),false);
  assert.equal(studentAccess(student,{...changed,publication_status:'archived'},{},'own'),false);
  assert.equal(studentAccess(student,{...changed,publication_status:'archived'},{},'grade'),true);
});
test('teacher subgroup access cannot be expanded to whole group',()=>{
  const t={id:'t',role:'teacher'},access=[{teacher_id:'t',group_id:'g',subgroup:1,active:true}];
  assert.equal(teacherScope(t,[{group_id:'g',subgroup:0}],access),false);
  assert.equal(teacherScope(t,[{group_id:'g',subgroup:1}],access),true);
  assert.equal(canTeach(t,assignment,{...student,group_id:'other'},access),false);
  assert.equal(canTeach(t,assignment,student,[]),false);
});
test('quota replacement gives credit for old set and counts other reservations',()=>{
  assert.doesNotThrow(()=>quotaCheck(125,125,25,0,25));
  assert.throws(()=>quotaCheck(125,125,25,1,25),/места/);
});
test('retention is two calendar years from individual file creation',()=>{
  const f={created_at:'2026-11-21T10:00:00.000Z'};
  assert.equal(expired(f,'2028-11-21T09:59:59.999Z'),false);
  assert.equal(expired(f,'2028-11-21T10:00:00.000Z'),true);
});

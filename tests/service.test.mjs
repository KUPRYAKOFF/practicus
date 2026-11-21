import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.mjs';
test('server denies unauthorized role, other group, other teacher and guessed file IDs',()=>{
  const f=fixture();const r=f.reserve();f.finish(r);const file=f.repo.all('SubmissionFiles')[0];
  assert.equal(f.call('adminData').error.code,'FORBIDDEN');
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0},'s2').ok,false);
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0},'t2').ok,false);
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0},'t').ok,true);
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0},'unknown').error.code,'UNAUTHORIZED');
  assert.equal(f.call('reviewRows',{assignment_id:'a'},'t2').ok,false);
});
test('drafts invisible, new members see published work, archive returns only grade',()=>{
  const f=fixture();assert.equal(f.call('listAssignments',{},'s2').data.length,0);
  f.repo.put('Users',{id:'s2',group_id:'g'});assert.equal(f.call('listAssignments',{},'s2').data.length,1);
  const r=f.reserve();f.finish(r);let s=f.repo.all('Submissions')[0];
  f.repo.put('Submissions',{...s,grade:5});f.repo.put('Assignments',{id:'a',publication_status:'archived'});
  assert.deepEqual(f.call('listAssignments').data[0].submission,{grade:5});
  f.repo.put('Assignments',{id:'a',publication_status:'draft'});assert.equal(f.call('listAssignments').data.length,0);
});
test('idempotent request and duplicate upload preserve one submission and generation',()=>{
  const f=fixture(),key=randomUUID(),r=f.reserve({idempotency_key:key});const one=f.finish(r),two=f.finish(r);
  assert.deepEqual(one,two);assert.equal(f.repo.all('Submissions').length,1);
  assert.equal(f.repo.all('Submissions')[0].attempts,1);assert.equal(f.reserve({idempotency_key:key}).data.status,'committed');
  assert.equal(f.reserve({idempotency_key:key,files:[{name:'other.txt',size:6}]}).error.code,'CONFLICT');
});
test('partial replacement failure keeps previous file generation and grade',()=>{
  const f=fixture({failAt:3});const first=f.reserve();f.finish(first);const old={...f.repo.all('Submissions')[0]};
  f.repo.put('Submissions',{...old,grade:4,feedback:'Old comment'});
  const r=f.reserve({files:[{name:'one.txt',size:5},{name:'two.txt',size:5}]});
  assert.throws(()=>f.finish(r,[f.blob('hello'),f.blob('world')]));
  const current=f.repo.all('Submissions')[0];assert.equal(current.generation,old.generation);assert.equal(current.grade,4);
  assert.equal(f.call('listAssignments').data[0].submission.files.length,1);
  assert.equal(f.blobs.has(f.repo.all('SubmissionFiles')[0].drive_id),true);
});
test('successful replacement resets grade, increments attempt, old bytes cleaned afterward',()=>{
  const f=fixture();f.finish(f.reserve());const old=f.repo.all('Submissions')[0];f.repo.put('Submissions',{...old,grade:3});
  const oldFile=f.repo.all('SubmissionFiles')[0];f.finish(f.reserve());const current=f.repo.all('Submissions')[0];
  assert.notEqual(current.generation,old.generation);assert.equal(current.grade,null);assert.equal(current.attempts,2);
  assert.equal(f.call('downloadChunk',{file_id:oldFile.id,offset:0}).ok,false);
  f.app.housekeeping();assert.equal(f.blobs.has(oldFile.drive_id),false);
});
test('reservation quota cannot be overspent by a second assignment upload',()=>{
  const f=fixture();f.repo.put('Users',{id:'s',quota_bytes:8});f.repo.put('Assignments',{...f.repo.get('Assignments','a'),id:'b'});
  assert.equal(f.reserve().ok,true);assert.equal(f.reserve({assignment_id:'b'}).error.code,'QUOTA');
  assert.equal(f.reserve().error.code,'CONFLICT');
});
test('server rechecks quota, session, membership and review decision before commit',()=>{
  for(const mutation of [repo=>repo.put('Users',{id:'s',quota_bytes:1}),repo=>repo.put('Users',{id:'s',status:'blocked'}),repo=>repo.put('Users',{id:'s',group_id:'other'}),repo=>repo.put('Submissions',{id:'new',assignment_id:'a',student_id:'s',status:'accepted',generation:'new'})]){
    const f=fixture({onCreate:(_n,repo)=>mutation(repo)});const r=f.reserve();assert.throws(()=>f.finish(r));
    assert.equal(f.repo.all('Submissions').filter(s=>s.status==='pending_review').length,0);
  }
});
test('late flag uses reserved server timestamp; revision works after close',()=>{
  const f=fixture({onCreate:(_n,_repo,clock)=>clock.time='2026-11-21T04:00:30.000Z'});
  f.clock.time='2026-11-21T03:59:30.000Z';f.finish(f.reserve());let s=f.repo.all('Submissions')[0];assert.equal(s.is_late,false);
  assert.equal(f.reserve().ok,false);
  assert.equal(f.call('review',{submission_id:s.id,generation:s.generation,status:'needs_revision',grade:4,feedback:''},'t').ok,true);
  f.finish(f.reserve());s=f.repo.all('Submissions')[0];assert.equal(s.is_late,true);assert.equal(s.grade,null);
});
test('two-minute upload expiry cannot commit; previous set survives',()=>{
  const f=fixture({onCreate:(_n,_repo,clock)=>clock.time='2026-11-21T03:02:01.000Z'});const r=f.reserve();
  assert.throws(()=>f.finish(r),/две минуты/);assert.equal(f.repo.all('Submissions').length,0);
});
test('teacher loses historical access after group change; student retains own files',()=>{
  const f=fixture();f.finish(f.reserve());const file=f.repo.all('SubmissionFiles')[0];f.repo.put('Users',{id:'s',group_id:'other'});
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0},'s').ok,true);
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0},'t').ok,false);
  assert.equal(f.call('reviewRows',{assignment_id:'a'},'t').data.length,0);
  assert.equal(f.call('listAssignments').data[0].materials.length,0);assert.equal(f.reserve().ok,false);
});
test('deleting a pending submission preserves record/grade and blocks byte access',()=>{
  const f=fixture();f.finish(f.reserve());const s=f.repo.all('Submissions')[0],file=f.repo.all('SubmissionFiles')[0];
  f.repo.put('Submissions',{...s,grade:4});assert.equal(f.call('deleteSubmissionFiles',{submission_id:s.id,confirm:true}).ok,true);
  assert.equal(f.repo.get('Submissions',s.id).grade,4);assert.equal(f.repo.get('Submissions',s.id).status,'pending_review');
  assert.equal(f.call('downloadChunk',{file_id:file.id,offset:0}).ok,false);
  assert.equal(f.call('bootstrap').data.quota.used,0);f.app.housekeeping();assert.equal(f.blobs.size,0);
});
test('two-year cleanup deletes physical files, preserves grades, retries failures',()=>{
  const f=fixture({failDelete:true});f.finish(f.reserve());const s=f.repo.all('Submissions')[0];f.repo.put('Submissions',{...s,grade:5});
  f.clock.time='2028-11-21T03:00:00.000Z';const result=f.app.housekeeping();assert.equal(result.pending,1);
  assert.equal(f.repo.get('Submissions',s.id).grade,5);assert.equal(f.repo.all('SubmissionFiles')[0].delete_pending,true);
  f.storage.remove=id=>f.blobs.delete(id);f.app.housekeeping();assert.equal(f.blobs.size,0);assert.equal(f.repo.all('SubmissionFiles')[0].delete_pending,false);
});
test('stale generation review rejected; grade optional; revoked teacher blocked',()=>{
  const f=fixture();f.finish(f.reserve());const old=f.repo.all('Submissions')[0];f.finish(f.reserve());const current=f.repo.all('Submissions')[0];
  const p={submission_id:current.id,generation:old.generation,status:'accepted',grade:null,feedback:''};
  assert.equal(f.call('review',p,'t').error.code,'CONFLICT');p.generation=current.generation;
  assert.equal(f.call('review',p,'t').data.grade,null);
  f.repo.put('TeacherAccess',{id:'ta',active:false});assert.equal(f.call('review',p,'t').ok,false);
});
test('production uploads stay gated until spike; admin spike still works',()=>{
  const f=fixture({verified:false});assert.equal(f.reserve().error.code,'TRANSPORT_UNVERIFIED');
  const r=f.reserve({kind:'spike',assignment_id:null},'admin');assert.equal(r.ok,true);assert.equal(f.finish(r,[f.blob('hello')],'admin').files.length,1);
});
test('commit journal recovery after lost final response preserves new files',()=>{
  const f=fixture();const r=f.reserve();let once=true;
  f.repo.failPut=(table,record)=>table==='UploadReservations'&&record.status==='committed'&&once?(once=false,true):false;
  assert.throws(()=>f.finish(r));const s=f.repo.all('Submissions')[0];assert(s);assert.equal(f.repo.get('UploadReservations',r.data.id).status,'committed');
  f.app.housekeeping();assert.equal(f.call('listAssignments').data[0].submission.files.length,1);
});
test('hidden draft and archived grades cannot be used to delete cached submission IDs',()=>{
  for(const status of ['draft','archived']){
    const f=fixture();f.finish(f.reserve());const s=f.repo.all('Submissions')[0];f.repo.put('Assignments',{id:'a',publication_status:status});
    assert.equal(f.call('deleteSubmissionFiles',{submission_id:s.id,confirm:true}).error.code,'FORBIDDEN');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,MemoryRepo} from './helpers.mjs';
import {createBackups,makeSnapshot,validateSnapshot,canonical,BACKUP_TABLES} from '../server/backups.js';
import {digest} from '../server/auth.js';

function environment({badRead=false,failWrite=false,keep=7}={}) {
  const f=fixture();const values=new Map([['DB_ID','live-db'],['DRIVE_ROOT_ID','live-root'],['BACKUP_KEEP',String(keep)]]);
  const props={getProperty:key=>values.get(key)??null,setProperty:(key,value)=>values.set(key,value),deleteProperty:key=>values.delete(key)};
  const files=new Map(),deleted=[],created=[];let target=new MemoryRepo();let factoryCalls=0;
  const store={
    write(raw,name){if(failWrite)throw new Error('disk');const file={id:randomUUID(),size:Buffer.byteLength(raw),created_at:f.clock.time,name,raw};files.set(file.id,file);created.push(file.id);return file;},
    read(id){const raw=files.get(id)?.raw;if(badRead)return raw?.replace('practicus-metadata','corrupted');if(!raw)throw new Error('missing');return raw;},
    list:()=>[...files.values()],remove:id=>{deleted.push(id);files.delete(id);},
    inventory:()=>new Map(f.repo.all('SubmissionFiles').filter(r=>r.drive_id).map(r=>[r.drive_id,{size:r.size}]))
  };
  const manager=createBackups({repo:f.repo,props,store,now:()=>f.clock.time,uuid:randomUUID,release:{version:'1.0.0'},createRestoreRepo:()=>{factoryCalls++;return {id:'restored-db',repo:target};}});
  return {...f,manager,props,values,files,store,deleted,created,get target(){return target;},setTarget:r=>target=r,factoryCalls:()=>factoryCalls};
}
test('metadata snapshot excludes sessions, reservations, intake and script secrets',()=>{
  const f=environment();f.repo.put('Sessions',{id:'session',token_hash:'session-hash'});f.repo.put('UserIntake',{id:'pending',full_name:'raw'});
  f.props.setProperty('AUTH_SECRET','never-export-this-secret');
  const result=f.manager.create();assert.equal(result.retained,1);assert(result.last_success_at);
  const stored=JSON.parse(f.files.get(f.created[0]).raw),p=validateSnapshot(stored,'live-root');
  assert.deepEqual(Object.keys(p.tables),BACKUP_TABLES);assert(!JSON.stringify(stored).includes('session-hash'));assert(!JSON.stringify(stored).includes('never-export-this-secret'));
  assert.equal(f.props.getProperty('BACKUP_LEASE_ID'),null);
});
test('snapshot checksum uses the persisted JSON representation of nested optional fields',()=>{
  const f=environment();f.repo.put('Audit',{id:'optional',details:{missing:undefined,present:'ok'}});
  assert.doesNotThrow(()=>f.manager.create());
});
test('corrupted read-back does not retire old snapshots or record a success',()=>{
  const f=environment({badRead:true});f.files.set('old',{id:'old',raw:'old',created_at:'2020-01-01T00:00:00Z'});
  assert.throws(()=>f.manager.create());assert(f.files.has('old'));assert.deepEqual(f.deleted,[]);
  assert.equal(f.manager.status().last_success_at,null);assert(f.manager.status().last_error_at);assert.equal(f.props.getProperty('BACKUP_LEASE_ID'),null);
});
test('storage write failure preserves all prior backups and releases lease',()=>{
  const f=environment({failWrite:true});assert.throws(()=>f.manager.create());assert.deepEqual(f.deleted,[]);assert.equal(f.props.getProperty('BACKUP_LEASE_UNTIL'),null);
});
test('retention always keeps newly verified backup, even when creation timestamps tie',()=>{
  const f=environment({keep:2});for(let i=0;i<5;i++)f.manager.create();
  assert.equal(f.files.size,2);assert(f.files.has(f.created.at(-1)));assert.equal(f.deleted.length,3);
});
test('a concurrent backup cannot steal or clear another execution lease',()=>{
  const f=environment();f.props.setProperty('BACKUP_LEASE_ID','other');f.props.setProperty('BACKUP_LEASE_UNTIL','2026-11-22T00:00:00Z');
  assert.throws(()=>f.manager.create(),e=>e.code==='BUSY');assert.equal(f.props.getProperty('BACKUP_LEASE_ID'),'other');assert.equal(f.created.length,0);
});
test('checksum, root, schema and duplicate IDs are validated before restore writes',()=>{
  const f=environment();f.manager.create();const id=f.created[0],file=f.files.get(id);const original=file.raw;
  f.props.setProperty('MAINTENANCE_MODE','true');
  const corruptions=[p=>{p.tables.Users[0].role='admin';},p=>{p.storage_root='other';},p=>{p.tables.Users.push(p.tables.Users[0]);},p=>{p.schema.Users=['wrong'];}];
  for(let i=0;i<corruptions.length;i++){
    const doc=JSON.parse(original);corruptions[i](doc.payload);if(i>0)doc.sha256=digest(canonical(doc.payload));file.raw=JSON.stringify(doc);
    assert.throws(()=>f.manager.prepareRestore(id));assert.equal(f.factoryCalls(),0);
  }
});
test('restore requires maintenance and creates a separate inactive copy with empty sessions',()=>{
  const f=environment();f.finish(f.reserve());const s=f.repo.all('Submissions')[0];f.repo.put('Submissions',{...s,grade:5,status:'accepted'});
  f.repo.put('Sessions',{id:'old-session'});f.manager.create();const id=f.created[0];
  assert.throws(()=>f.manager.prepareRestore(id),e=>e.code==='MAINTENANCE');assert.equal(f.factoryCalls(),0);
  f.props.setProperty('MAINTENANCE_MODE','true');const report=f.manager.prepareRestore(id);
  assert.equal(f.props.getProperty('DB_ID'),'live-db');assert.equal(f.props.getProperty('RESTORED_DB_ID'),'restored-db');assert.equal(f.props.getProperty('RESTORE_STATUS'),'ready');
  assert.equal(f.target.all('Submissions')[0].grade,5);assert.equal(f.target.all('Sessions').length,0);assert.equal(f.target.all('UploadReservations').length,0);assert.equal(report.unavailable_files,0);
});
test('restoring an older snapshot never revives files deleted after the snapshot',()=>{
  const f=environment();f.finish(f.reserve());f.manager.create();const id=f.created[0],file=f.repo.all('SubmissionFiles')[0];
  f.repo.put('SubmissionFiles',{...file,deleted_at:f.clock.time,delete_pending:true});f.props.setProperty('MAINTENANCE_MODE','true');
  const report=f.manager.prepareRestore(id);assert.equal(report.unavailable_files,1);assert(f.target.all('SubmissionFiles')[0].deleted_at);assert.equal(f.target.all('SubmissionFiles')[0].delete_pending,false);
});
test('missing physical files remain unavailable while grades are restored',()=>{
  const f=environment();f.finish(f.reserve());const s=f.repo.all('Submissions')[0];f.repo.put('Submissions',{...s,grade:4});f.manager.create();
  f.store.inventory=()=>new Map();f.props.setProperty('MAINTENANCE_MODE','true');const report=f.manager.prepareRestore(f.created[0]);
  assert.equal(report.unavailable_files,1);assert.equal(f.target.all('Submissions')[0].grade,4);assert.equal(f.target.all('Submissions')[0].files_deleted,true);
});
test('unreadable deletion history safely blocks restored file access',()=>{
  const f=environment();f.finish(f.reserve());f.manager.create();const read=f.repo.all.bind(f.repo);
  f.repo.all=table=>{if(table==='Materials')throw new Error('damaged source');return read(table);};f.props.setProperty('MAINTENANCE_MODE','true');
  f.store.inventory=()=>new Map([['physical',{size:5}]]);
  const report=f.manager.prepareRestore(f.created[0]);assert.equal(report.deletion_history_available,false);assert(f.target.all('SubmissionFiles')[0].deleted_at);
});
test('failed restore remains inactive and does not publish a ready database ID',()=>{
  const f=environment();f.manager.create();f.props.setProperty('MAINTENANCE_MODE','true');const target=new MemoryRepo();target.writeEmptyTable=()=>{throw new Error('write fail');};f.setTarget(target);
  assert.throws(()=>f.manager.prepareRestore(f.created[0]));assert.equal(f.props.getProperty('DB_ID'),'live-db');assert.equal(f.props.getProperty('RESTORED_DB_ID'),null);assert.equal(f.props.getProperty('RESTORE_STATUS'),'failed');
});

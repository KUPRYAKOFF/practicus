import test from 'node:test';
import assert from 'node:assert/strict';
import {BackupStore} from '../server/backup-store.js';

function fake(fn){
  const old={DriveApp:globalThis.DriveApp,Session:globalThis.Session,Utilities:globalThis.Utilities};
  const iterator=values=>{let i=0;return {hasNext:()=>i<values.length,next:()=>values[i++]};};
  const files=new Map(),removed=[];let reads=0;
  const folder={shared:false,getId:()=> 'root',getOwner:()=>({getEmail:()=> 'owner@example.test'}),getSharingAccess:()=> 'private',getEditors:()=>folder.shared?['someone']:[],getViewers:()=>[],getFiles:()=>iterator([...files.values()])};
  folder.createFile=blob=>{
    const id='file-'+files.size;const f={id,name:blob.name,raw:blob.raw,parents:[folder],shared:false,getId:()=>id,getName:()=>f.name,setName:name=>{f.name=name;},
      getSize:()=>Buffer.byteLength(f.raw),getDateCreated:()=>new Date('2026-11-21T00:00:00Z'),getParents:()=>iterator(f.parents),getOwner:()=>({getEmail:()=> 'owner@example.test'}),
      getSharingAccess:()=> 'private',getEditors:()=>f.shared?['someone']:[],getViewers:()=>[],getBlob:()=>{reads++;return {getDataAsString:()=>f.raw};}};files.set(id,f);return f;
  };
  globalThis.DriveApp={Access:{PRIVATE:'private'},getFolderById:()=>folder,getFileById:id=>files.get(id)};
  globalThis.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})};
  globalThis.Utilities={newBlob:(raw,type,name)=>({raw,type,name,getBytes:()=>Buffer.from(raw)})};
  const store=new BackupStore({getProperty:()=> 'root'},{remove:id=>{removed.push(id);files.delete(id);}});
  try{return fn({store,folder,files,removed,reads:()=>reads});}finally{Object.assign(globalThis,old);}
}
test('Drive backup is pending until verified commit; only committed snapshots are listed',()=>fake(({store,files,removed})=>{
  const written=store.write('{"safe":true}','practicus-metadata-test.json');assert(files.get(written.id).name.startsWith('pending-'));assert.equal(store.list().length,0);
  assert.equal(store.read(written.id),'{"safe":true}');store.commit(written.id);assert.equal(store.list().length,1);store.remove(written.id);assert.deepEqual(removed,[written.id]);
}));
test('backup store rejects shared roots, shared individual files and foreign-parent files before reading contents',()=>fake(({store,folder,files,reads})=>{
  folder.shared=true;assert.throws(()=>store.write('{}','practicus-metadata-test.json'),e=>e.code==='BACKUP');folder.shared=false;
  const saved=store.write('{}','practicus-metadata-test.json'),f=files.get(saved.id);f.shared=true;assert.throws(()=>store.read(saved.id),e=>e.code==='BACKUP');f.shared=false;
  f.parents=[];assert.throws(()=>store.read(saved.id),e=>e.code==='BACKUP');assert.equal(reads(),0);
}));

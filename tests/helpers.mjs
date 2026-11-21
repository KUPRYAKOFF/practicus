import {SCHEMA} from '../server/repository.js';
import {randomUUID} from 'node:crypto';
import {createService} from '../server/service.js';
import {publicUser} from '../server/auth.js';
export class MemoryRepo {
  constructor(){this.tables=Object.fromEntries(Object.keys(SCHEMA).map(k=>[k,[]]));this.failPut=null;}
  all(table){return this.tables[table];}
  get(table,id){return this.all(table).find(r=>r.id===id);}
  put(table,record){if(this.failPut?.(table,record))throw new Error('injected persistence failure');const rows=this.all(table),i=rows.findIndex(r=>r.id===record.id),next={...(i>=0?rows[i]:{}),...structuredClone(record)};if(i<0)rows.push(next);else rows[i]=next;return next;}
  refresh(){}
  writeEmptyTable(table,records){if(this.all(table).length)throw new Error('not empty');this.tables[table]=structuredClone(records);}
  lock(fn){return fn();}
}
export function fixture(options={}){
  const repo=new MemoryRepo(),clock={time:'2026-11-21T03:00:00.000Z'},now=()=>clock.time;
  for(const u of [{id:'s',role:'student',group_id:'g',subgroup:1},{id:'s2',role:'student',group_id:'other',subgroup:1},{id:'t',role:'teacher'},{id:'t2',role:'teacher'},{id:'admin',role:'admin'}])repo.put('Users',{...u,full_name:u.id,status:'active',must_change_password:false,quota_bytes:1000});
  repo.put('Groups',{id:'g',name:'Group',active:true});repo.put('Groups',{id:'other',name:'Other',active:true});
  repo.put('TeacherAccess',{id:'ta',teacher_id:'t',group_id:'g',subgroup:0,active:true});
  repo.put('Assignments',{id:'a',teacher_id:'t',title:'Assignment',description:'Test',instructions:'Instructions',targets:[{group_id:'g',subgroup:0}],due_at:'2026-11-21T04:00:00.000Z',late_policy:'close',publication_status:'published',version:1,material_generation:null,created_at:now()});
  const auth={actor(token,allow=false){const u=repo.get('Users',token);if(!u||u.status!=='active'){const e=new Error('Session');e.code='UNAUTHORIZED';throw e;}if(u.must_change_password&&!allow){const e=new Error('Password');e.code='PASSWORD_CHANGE';throw e;}return u;},random:()=>randomUUID().replace(/-/g,'').repeat(2)};
  const blobs=new Map();let created=0;
  const storage={
    create(blob,id,meta){created++;if(options.onCreate)options.onCreate(created,repo,clock);if(options.failAt===created)throw new Error('storage failure');blobs.set(id,blob);return {drive_id:id,created_at:now()};},
    remove(id){if(options.failDelete)throw new Error('delete failed');blobs.delete(id);},
    chunk(id,offset,size){if(!blobs.has(id))throw new Error('missing');return Buffer.from(blobs.get(id).getBytes().slice(offset,offset+size)).toString('base64');},check(){return {};}
  };
  const settings={uploadsEnabled:options.verified!==false};
  const app=createService({repo,auth,storage,now,uuid:randomUUID,settings,backups:options.backups});
  const call=(action,payload={},token='s')=>app.api({action,token,payload});
  const reserve=(extra={},token='s')=>call('beginUpload',{kind:'submission',assignment_id:'a',files:[{name:'report.txt',size:5,type:'text/plain'}],idempotency_key:randomUUID(),...extra},token);
  const blob=text=>({getBytes:()=>[...Buffer.from(text)]});
  const finish=(r,files=[blob('hello')],token='s')=>app.upload(token,r.data.id,files);
  return {repo,clock,app,call,reserve,finish,blob,storage,blobs,settings};
}

import {SCHEMA} from './repository.js';
import {digest} from './auth.js';
import {assert} from './domain.js';

export const BACKUP_TABLES=['Users','Groups','TeacherAccess','Assignments','Materials','Submissions','SubmissionFiles','Audit','Settings'];
export const MAX_BACKUP_BYTES=20*1024*1024;
export const canonical=value=>{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
};
export function makeSnapshot(repo,{id,at,sourceDb,storageRoot,release}) {
  const tables={};
  for(const table of BACKUP_TABLES)tables[table]=repo.all(table).map(row=>Object.fromEntries(SCHEMA[table].map(key=>[key,row[key]??null])));
  const payload={format:'practicus-metadata',version:1,id,created_at:at,source_db:sourceDb,storage_root:storageRoot,release,
    schema:Object.fromEntries(BACKUP_TABLES.map(table=>[table,SCHEMA[table]])),tables};
  const normalized=JSON.parse(JSON.stringify(payload));
  return {payload:normalized,sha256:digest(canonical(normalized))};
}
export function validateSnapshot(envelope,storageRoot) {
  const p=envelope?.payload;
  assert(p?.format==='practicus-metadata' && p.version===1,'Неподдерживаемый формат резервной копии','BACKUP');
  assert(typeof envelope.sha256==='string' && digest(canonical(p))===envelope.sha256,'Контрольная сумма резервной копии не совпала','BACKUP');
  assert(p.storage_root===storageRoot,'Копия относится к другому хранилищу Drive','BACKUP');
  assert(Number.isFinite(Date.parse(p.created_at)) && typeof p.id==='string' && p.id.length>0,'Повреждены сведения о копии','BACKUP');
  assert(p.tables && p.schema && typeof p.tables==='object' && typeof p.schema==='object','Неверная структура резервной копии','BACKUP');
  assert(JSON.stringify(Object.keys(p.tables).sort())===JSON.stringify([...BACKUP_TABLES].sort()),'Неверный состав резервной копии','BACKUP');
  for(const table of BACKUP_TABLES) {
    assert(JSON.stringify(p.schema[table])===JSON.stringify(SCHEMA[table]),'Несовместимая схема '+table,'BACKUP');
    const ids=new Set();assert(Array.isArray(p.tables[table]),'Повреждён лист '+table,'BACKUP');
    for(const row of p.tables[table]) {
      assert(row && typeof row.id==='string' && row.id && !ids.has(row.id),'Повторяющийся или пустой ID в '+table,'BACKUP');ids.add(row.id);
      assert(JSON.stringify(Object.keys(row).sort())===JSON.stringify([...SCHEMA[table]].sort()),'Неверные поля '+table,'BACKUP');
    }
  }
  assert(p.tables.Users.some(u=>u.role==='admin' && u.status==='active'),'В копии нет активного администратора','BACKUP');
  return p;
}
export function reconcileFiles(tables,inventory,tombstones,historyAvailable,at) {
  const copy=JSON.parse(JSON.stringify(tables));let unavailable=0;
  for(const table of ['Materials','SubmissionFiles'])for(const file of copy[table]) {
    // Physical deletion is never scheduled from a restored snapshot.
    file.delete_pending=false;
    const actual=inventory.get(file.drive_id);
    if(file.deleted_at || !historyAvailable || tombstones.has(file.id) || !actual || Number(actual.size)!==file.size) {
      if(!file.deleted_at)unavailable++;
      file.deleted_at=file.deleted_at || at;
    }
  }
  for(const s of copy.Submissions)s.files_deleted=!copy.SubmissionFiles.some(f=>f.submission_id===s.id && f.generation===s.generation && !f.deleted_at);
  return {tables:copy,unavailable};
}
export function createBackups({repo,store,props,now,uuid,release,createRestoreRepo}) {
  const event=(action,details={})=>repo.put('Audit',{id:uuid(),actor_id:'system',action,at:now(),details});
  const status=()=>({last_success_at:props.getProperty('BACKUP_LAST_SUCCESS_AT'),last_size:Number(props.getProperty('BACKUP_LAST_SIZE')||0),
    last_error_at:props.getProperty('BACKUP_LAST_ERROR_AT'),last_error:props.getProperty('BACKUP_LAST_ERROR'),retained:Number(props.getProperty('BACKUP_RETAINED')||0),
    keep:Number(props.getProperty('BACKUP_KEEP')||7),cleanup_pending:Number(props.getProperty('BACKUP_CLEANUP_PENDING')||0),restore_status:props.getProperty('RESTORE_STATUS')});
  function create() {
    const operation=uuid();let leased=false;
    try {
      const snapshot=repo.lock(()=>{
        assert(!props.getProperty('BACKUP_LEASE_UNTIL') || props.getProperty('BACKUP_LEASE_UNTIL')<=now(),'Резервная копия уже создаётся','BUSY');
        props.setProperty('BACKUP_LEASE_ID',operation);props.setProperty('BACKUP_LEASE_UNTIL',new Date(Date.parse(now())+10*60000).toISOString());leased=true;
        event('backup_started');
        return makeSnapshot(repo,{id:operation,at:now(),sourceDb:props.getProperty('DB_ID'),storageRoot:props.getProperty('DRIVE_ROOT_ID'),release});
      });
      const raw=JSON.stringify(snapshot);
      const file=store.write(raw,'practicus-metadata-'+snapshot.payload.created_at.replace(/[:.]/g,'-')+'-'+operation+'.json');
      // Read back and validate before retiring any older snapshot.
      const stored=JSON.parse(store.read(file.id));validateSnapshot(stored,props.getProperty('DRIVE_ROOT_ID'));
      assert(stored.sha256===snapshot.sha256,'Drive вернул другую резервную копию','BACKUP');
      store.commit?.(file.id);
      const keep=Number(props.getProperty('BACKUP_KEEP')||7);assert(Number.isInteger(keep)&&keep>=2&&keep<=30,'BACKUP_KEEP должен быть от 2 до 30','CONFIG');
      const copies=[file,...store.list().filter(f=>f.id!==file.id).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))];
      let pending=0;for(const old of copies.slice(keep))try{store.remove(old.id);}catch{pending++;}
      pending+=store.prunePending?.()||0;
      props.setProperty('BACKUP_LAST_SUCCESS_AT',now());props.setProperty('BACKUP_LAST_SIZE',String(file.size));props.setProperty('BACKUP_RETAINED',String(Math.min(keep,copies.length)+pending));
      props.setProperty('BACKUP_CLEANUP_PENDING',String(pending));
      props.deleteProperty('BACKUP_LAST_ERROR');props.deleteProperty('BACKUP_LAST_ERROR_AT');
      repo.lock(()=>event('backup_completed',{bytes:file.size,retained:Math.min(keep,copies.length)+pending,cleanup_pending:pending}));
      return {...status(),cleanup_pending:pending};
    }catch(error){
      if(leased){props.setProperty('BACKUP_LAST_ERROR_AT',now());props.setProperty('BACKUP_LAST_ERROR',error.code||'INTERNAL');}
      throw error;
    }finally{
      if(leased)repo.lock(()=>{if(props.getProperty('BACKUP_LEASE_ID')===operation){props.deleteProperty('BACKUP_LEASE_ID');props.deleteProperty('BACKUP_LEASE_UNTIL');}});
    }
  }
  function prepareRestore(id) {
    assert(props.getProperty('MAINTENANCE_MODE')==='true','Перед восстановлением включите MAINTENANCE_MODE=true','MAINTENANCE');
    const p=validateSnapshot(JSON.parse(store.read(id)),props.getProperty('DRIVE_ROOT_ID'));
    let tombstones=new Set(),historyAvailable=true;
    try{repo.lock(()=>{for(const table of ['Materials','SubmissionFiles'])for(const f of repo.all(table))if(f.deleted_at)tombstones.add(f.id);});}
    catch{historyAvailable=false;}
    const reconciled=reconcileFiles(p.tables,store.inventory(),tombstones,historyAvailable,now());
    props.setProperty('RESTORE_STATUS','preparing');props.deleteProperty('RESTORED_DB_ID');
    try {
      const target=createRestoreRepo();
      assert(target.id!==props.getProperty('DB_ID'),'Нельзя восстанавливать поверх рабочей базы','BACKUP');
      for(const table of BACKUP_TABLES)target.repo.writeEmptyTable(table,reconciled.tables[table]);
      for(const table of BACKUP_TABLES)assert(canonical(target.repo.all(table))===canonical(reconciled.tables[table]),'Проверка восстановленного листа не пройдена: '+table,'BACKUP');
      // Sessions, reservations, login attempts and pending user imports stay empty.
      for(const table of ['Sessions','LoginAttempts','UploadReservations','UserIntake'])assert(target.repo.all(table).length===0,'Служебный лист восстановления не пуст','BACKUP');
      target.complete?.();
      const report={prepared_at:now(),snapshot_at:p.created_at,records:BACKUP_TABLES.reduce((n,t)=>n+p.tables[t].length,0),unavailable_files:reconciled.unavailable,deletion_history_available:historyAvailable};
      props.setProperty('RESTORED_DB_ID',target.id);props.setProperty('RESTORE_REPORT',JSON.stringify(report));props.setProperty('RESTORE_STATUS','ready');
      return report;
    }catch(error){props.setProperty('RESTORE_STATUS','failed');throw error;}
  }
  return {create,status,prepareRestore};
}

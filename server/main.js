import { SheetRepository, initializeSheets } from './repository.js';
import { Auth } from './auth.js';
import { PrivateDrive } from './drive.js';
import { createService } from './service.js';
import { assert, LIMIT } from './domain.js';
function context() {
  const props=PropertiesService.getScriptProperties();
  const id=props.getProperty('DB_ID'); assert(id,'Сначала выполните setup_','CONFIG');
  const repo=new SheetRepository(id);
  const now=()=>new Date().toISOString(),uuid=()=>Utilities.getUuid();
  const auth=new Auth(repo,props.getProperty('AUTH_SECRET'),now,uuid);
  const storage=new PrivateDrive(props);
  const limit=Number(props.getProperty('FILE_LIMIT_BYTES') || LIMIT);
  assert(Number.isSafeInteger(limit) && limit>0 && limit<=LIMIT,'Лимит должен быть не более 25 МиБ','CONFIG');
  return {props,repo,auth,storage,now,uuid,settings:{transportVerified:props.getProperty('FILE_TRANSPORT_VERIFIED')==='true',fileLimit:limit}};
}
export function api(request) {
  try { return createService(context()).api(request); }
  catch(error) {return {ok:false,error:{code:error.code || 'INTERNAL',message:error.code?error.message:'Ошибка конфигурации сервера'}};}
}
export function uploadForm(form) {
  try {
    assert(form && typeof form.token==='string' && typeof form.reservation_id==='string','Некорректная форма','VALIDATION');
    const count=Number(form.count); assert(Number.isInteger(count) && count>0 && count<=25,'Неверное число файлов','VALIDATION');
    const blobs=Array.from({length:count},(_,i)=>form['file_'+i]);
    assert(blobs.every(b=>b && typeof b.getBytes==='function'),'Не удалось получить файлы формы','VALIDATION');
    return {ok:true,data:createService(context()).upload(form.token,form.reservation_id,blobs)};
  } catch(error) {return {ok:false,error:{code:error.code || 'INTERNAL',message:error.code?error.message:'Ошибка загрузки. Проверьте состояние операции'}};}
}
export function setup() {
  const props=PropertiesService.getScriptProperties();
  assert(props.getProperty('AUTH_SECRET')?.length>=43,'Задайте AUTH_SECRET','CONFIG');
  assert(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(props.getProperty('PAGES_ORIGIN') || ''),'Задайте PAGES_ORIGIN без пути и завершающего слэша','CONFIG');
  let id=props.getProperty('DB_ID');
  if(!id) {id=SpreadsheetApp.create('Practicus_DB').getId(); props.setProperty('DB_ID',id);}
  initializeSheets(id);
  const ctx=context();
  if(!ctx.repo.all('Users').some(u=>u.role==='admin')) {
    const login=props.getProperty('INIT_ADMIN_LOGIN'),password=props.getProperty('INIT_ADMIN_PASSWORD');
    assert(login && password,'Задайте INIT_ADMIN_LOGIN и INIT_ADMIN_PASSWORD','CONFIG');
    ctx.repo.lock(()=>{
      const admin=ctx.auth.createUser({login,full_name:'Администратор',role:'admin'},password);
      ctx.repo.put('Users',{...admin,must_change_password:true});
    });
    props.deleteProperty('INIT_ADMIN_PASSWORD'); props.deleteProperty('INIT_ADMIN_LOGIN');
  }
  const existing=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='housekeeping_');
  if(!existing) ScriptApp.newTrigger('housekeeping_').timeBased().everyHours(1).create();
  return {configured:true};
}
export function housekeeping() {return createService(context()).housekeeping();}

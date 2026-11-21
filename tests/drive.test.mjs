import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDrive,ensureStorageRoot} from '../server/drive.js';

const response=(data={},code=200,headers={})=>({getResponseCode:()=>code,getContentText:()=>JSON.stringify(data),getAllHeaders:()=>headers,getContent:()=>[65,66,67]});
function environment(fn) {
  const old={ScriptApp:globalThis.ScriptApp,DriveApp:globalThis.DriveApp,UrlFetchApp:globalThis.UrlFetchApp,Utilities:globalThis.Utilities};
  const values=new Map(),calls=[],stats={folders:0,tokens:0};
  const props={getProperty:key=>values.get(key)||null,setProperty:(key,value)=>values.set(key,value)};
  globalThis.ScriptApp={getOAuthToken:()=>{stats.tokens++;return 'owner-token-server-only';}};
  globalThis.DriveApp={createFolder:name=>{stats.folders++;assert.equal(name,'Practicus_Private_Storage');return {getId:()=> 'owned-root'};}};
  globalThis.UrlFetchApp={fetch:(url,options)=>{calls.push({url,options});return response();}};
  globalThis.Utilities={base64Encode:bytes=>Buffer.from(bytes).toString('base64')};
  try{return fn({props,values,calls,stats});}finally{Object.assign(globalThis,old);}
}
test('initial setup creates one owner folder and reuses its saved ID',()=>environment(({props,stats})=>{
  assert.equal(ensureStorageRoot(props),'owned-root');assert.equal(props.getProperty('DRIVE_ROOT_ID'),'owned-root');
  assert.equal(ensureStorageRoot(props),'owned-root');assert.equal(stats.folders,1);
}));
test('Drive uses only deployment owner token and keeps it out of returned data',()=>environment(({props,calls,stats})=>{
  props.setProperty('DRIVE_ROOT_ID','owned-root');
  globalThis.UrlFetchApp.fetch=(url,options)=>{calls.push({url,options});return response(url.includes('/about?')?
    {user:{emailAddress:'application@example.test'},storageQuota:{usage:'0',limit:'1000'}}:
    {ownedByMe:true,trashed:false,mimeType:'application/vnd.google-apps.folder',permissions:[{type:'user',role:'owner'}]});};
  const result=new PrivateDrive(props).check();assert.equal(result.owner,'application@example.test');
  assert.equal(stats.tokens,1);assert.equal(calls.length,2);
  for(const call of calls){assert(call.url.startsWith('https://www.googleapis.com/drive/'));assert.equal(call.options.headers.Authorization,'Bearer owner-token-server-only');}
  assert(!JSON.stringify(result).includes('owner-token'));assert.equal(props.getProperty('DRIVE_REFRESH_TOKEN'),null);
}));
test('Drive rejects folders belonging to someone else and publicly shared roots',()=>environment(({props})=>{
  props.setProperty('DRIVE_ROOT_ID','root');
  for(const root of [{ownedByMe:false,permissions:[]},{ownedByMe:true,permissions:[{type:'anyone'}]},{ownedByMe:true,permissions:[{type:'domain'}]}]){
    globalThis.UrlFetchApp.fetch=url=>response(url.includes('/about?')?{user:{},storageQuota:{}}:{...root,mimeType:'application/vnd.google-apps.folder',trashed:false});
    assert.throws(()=>new PrivateDrive(props).check(),e=>e.code==='CONFIG');
  }
}));
test('upload, byte ranges and permanent deletion use the same server identity',()=>environment(({props,calls,stats})=>{
  props.setProperty('DRIVE_ROOT_ID','owned-root');
  globalThis.UrlFetchApp.fetch=(url,options)=>{
    calls.push({url,options});
    if(options.method==='post')return response({},200,{Location:'https://www.googleapis.com/upload/session'});
    if(options.method==='put')return response({id:'stored-file',size:'3',createdTime:'2026-11-21T00:00:00Z'});
    if(options.method==='delete')return response({},204);
    return response({},206);
  };
  const drive=new PrivateDrive(props),saved=drive.create({blob:true},'logical-file',{name:'a.txt',size:3,type:'text/plain'});
  assert.equal(saved.drive_id,'stored-file');assert.equal(drive.chunk(saved.drive_id,0,3),'QUJD');drive.remove(saved.drive_id);
  const metadata=JSON.parse(calls[0].options.payload);assert.deepEqual(metadata.parents,['owned-root']);
  assert.equal(calls[2].options.headers.Range,'bytes=0-2');assert.equal(calls[3].options.method,'delete');
  for(const call of calls)assert.equal(call.options.headers.Authorization,'Bearer owner-token-server-only');
  assert.equal(stats.tokens,1);assert(!JSON.stringify(saved).includes('owner-token'));
}));

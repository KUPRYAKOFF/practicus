import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const main=await readFile(new URL('../apps-script/Main.gs',import.meta.url),'utf8');
const manifest=JSON.parse(await readFile(new URL('../apps-script/appsscript.json',import.meta.url),'utf8'));
function context(active,effective) {
  let calls=0;
  const sandbox=vm.createContext({
    Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})},
    Core:{setup:()=>{calls++;return {configured:true};},backupMetadata:()=>{calls++;return {saved:true};},prepareRestore:()=>{calls++;return {prepared:true};},publicStatus:()=>({application:'practicus',version:'1.0.0',backend_build:'public-fingerprint'})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({value,setMimeType(){return this;}})},
  });
  vm.runInContext(main,sandbox);
  return {run:()=>sandbox.runInitialSetup(),calls:()=>calls,sandbox};
}
test('visible editor launcher runs setup for matching authenticated Google identity',()=>{
  const editor=context('application@example.test','application@example.test');
  assert.equal(editor.run().configured,true);assert.equal(editor.calls(),1);
  assert(manifest.oauthScopes.includes('https://www.googleapis.com/auth/userinfo.email'));
  assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
});
test('anonymous Web App caller cannot invoke the visible setup launcher',()=>{
  const anonymous=context('','application@example.test');assert.throws(()=>anonymous.run(),/из редактора Apps Script/);assert.equal(anonymous.calls(),0);
});
test('another signed-in Google user and missing execution identity cannot run setup',()=>{
  for(const pair of [['other@example.test','application@example.test'],['application@example.test',''],['','']]){
    const caller=context(...pair);assert.throws(()=>caller.run(),/выделенным аккаунтом/);assert.equal(caller.calls(),0);
  }
});
test('backup and restore editor launchers reject anonymous and other-user calls',()=>{
  for(const pair of [['','application@example.test'],['other@example.test','application@example.test']])for(const method of ['runMetadataBackup','runPrepareRestore']){
    const f=context(...pair);assert.throws(()=>f.sandbox[method]());assert.equal(f.calls(),0);
  }
  const owner=context('application@example.test','application@example.test');assert(owner.sandbox.runMetadataBackup().saved);assert(owner.sandbox.runPrepareRestore().prepared);
});
test('public health reveals only release identity and never initializes Google data services',()=>{
  const f=context('','application@example.test');const response=f.sandbox.doGet({parameter:{health:'1'}}),data=JSON.parse(response.value);
  assert.deepEqual(Object.keys(data).sort(),['application','backend_build','version']);assert.equal(f.calls(),0);
});

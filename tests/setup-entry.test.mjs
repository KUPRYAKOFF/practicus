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
    Core:{setup:()=>{calls++;return {configured:true};}},
  });
  vm.runInContext(main,sandbox);
  return {run:()=>sandbox.runInitialSetup(),calls:()=>calls};
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

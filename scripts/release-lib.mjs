import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
export function validateTag(ref,version){if(ref!=='v'+version && !new RegExp('^v'+version.replace(/\./g,'\\.')+'-web\\.[1-9][0-9]*$').test(ref))throw new Error('Release tag must match package version: v'+version);}
export async function backendFingerprint(){
  const files=[...(await readdir('server')).filter(f=>f.endsWith('.js')).map(f=>'server/'+f),'apps-script/Main.gs','apps-script/Bridge.html','apps-script/appsscript.json'];
  const pkg=JSON.parse(await readFile('package.json','utf8'));const hash=createHash('sha256').update(pkg.version+'\n');
  for(const file of files.sort())hash.update(file+'\0').update(await readFile(file)).update('\0');
  return hash.digest('hex');
}
export function assertBackendMatches(expected,actual){
  if(actual?.application!=='practicus'||actual.version!==expected.version||actual.backend_build!==expected.backend_build)throw new Error('Apps Script does not match this release. Install its four Apps Script files, publish a New version, then rerun deployment.');
}
export async function publicApiUrl(path='dist/site/config.js'){
  const sandbox={window:{}};vm.runInNewContext(await readFile(path,'utf8'),sandbox,{timeout:1000});
  const raw=sandbox.window.PRACTICUS_CONFIG?.apiUrl,url=new URL(raw);
  if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw new Error('A production Apps Script /exec URL is required');
  return url;
}

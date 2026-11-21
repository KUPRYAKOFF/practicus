import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const folder of ['web','server','scripts'])for(const f of await readdir(folder))if(/\.(m?js)$/.test(f)){
  const result=spawnSync(process.execPath,['--check',folder+'/'+f],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
}
for(const f of ['package.json','apps-script/appsscript.json'])JSON.parse(await readFile(f,'utf8'));
const html=await readFile('web/index.html','utf8');
if(!html.includes('lang="ru"') || !html.includes('Content-Security-Policy'))throw new Error('HTML security/language metadata missing');
const main=await readFile('apps-script/Main.gs','utf8');
for(const name of [...main.matchAll(/function\s+(\w+)\(/g)].map(m=>m[1]))if(!['api','uploadForm','doGet','runInitialSetup','runMetadataBackup','runPrepareRestore'].includes(name)&&!name.endsWith('_'))throw new Error('Unexpected public Apps Script entry '+name);
console.log('Syntax, JSON, HTML metadata and Apps Script entry points checked');

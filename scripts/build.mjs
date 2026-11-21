import { build } from 'esbuild';
import { mkdir,cp,writeFile,readFile } from 'node:fs/promises';
import {backendFingerprint} from './release-lib.mjs';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const backendBuild=await backendFingerprint();
await mkdir('dist',{recursive:true});
await cp('web','dist/site',{recursive:true});
await cp('apps-script','dist/apps-script',{recursive:true});
const result=await build({entryPoints:['server/main.js'],bundle:true,format:'iife',globalName:'Core',target:'es2020',platform:'neutral',write:false,
  define:{__APP_VERSION__:JSON.stringify(pkg.version),__BACKEND_BUILD__:JSON.stringify(backendBuild)}});
const notices=await readFile('THIRD_PARTY_NOTICES.txt','utf8');
const core='/*\n'+notices+'\n*/\n'+result.outputFiles[0].text;
await writeFile('apps-script/Core.gs',core);
await writeFile('dist/apps-script/Core.gs',core);
await writeFile('dist/apps-script/.claspignore','**/node_modules/**\n');
const manifest={application:'practicus',version:pkg.version,backend_build:backendBuild,source_sha:process.env.RELEASE_SOURCE_SHA||null};
await writeFile('dist/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile('dist/site/release.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Built GitHub Pages → dist/site; Apps Script → dist/apps-script');

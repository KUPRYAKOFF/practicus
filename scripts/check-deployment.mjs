import {readFile} from 'node:fs/promises';
import {assertBackendMatches,publicApiUrl,validateTag} from './release-lib.mjs';
const expected=JSON.parse(await readFile('dist/release-manifest.json','utf8'));
if(process.env.RELEASE_REF)validateTag(process.env.RELEASE_REF,expected.version);
let url=await publicApiUrl();url.searchParams.set('health','1');
const signal=AbortSignal.timeout(30000);
for(let redirects=0;redirects<6;redirects++){
  if(url.protocol!=='https:' || !(url.hostname==='script.google.com'||url.hostname.endsWith('.googleusercontent.com')))throw new Error('Apps Script requires Google sign-in or redirected outside its public service');
  const response=await fetch(url,{redirect:'manual',signal});
  if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get('location'),url);continue;}
  if(!response.ok)throw new Error('Apps Script health endpoint returned HTTP '+response.status);
  const body=await response.text();let actual;
  try{if(body.length>4096)throw new Error();actual=JSON.parse(body);}catch{throw new Error('Apps Script is not updated to this release or is not publicly accessible. Publish a New version of its four files.');}
  assertBackendMatches(expected,actual);console.log('Apps Script matches release '+expected.version+' ('+expected.backend_build.slice(0,12)+'). No upload or load tests were performed.');process.exit(0);
}
throw new Error('Too many Apps Script redirects');

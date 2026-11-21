import test from 'node:test';
import assert from 'node:assert/strict';
import {assertBackendMatches,validateTag,backendFingerprint} from '../scripts/release-lib.mjs';
test('frontend deployment requires matching backend version AND source fingerprint',()=>{
  const expected={version:'1.0.0',backend_build:'new-build'},actual={...expected,application:'practicus'};
  assert.doesNotThrow(()=>assertBackendMatches(expected,actual));
  for(const bad of [{...actual,version:'0.1.0'},{...actual,backend_build:'old-build'},{...actual,application:'other'},null])assert.throws(()=>assertBackendMatches(expected,bad));
});
test('production deployment accepts only the exact versioned release tag',()=>{
  assert.doesNotThrow(()=>validateTag('v1.0.0','1.0.0'));for(const ref of ['main','v0.1.0','some-sha'])assert.throws(()=>validateTag(ref,'1.0.0'));
});
test('backend fingerprint is deterministic and contains no runtime credentials',async()=>{
  const one=await backendFingerprint(),two=await backendFingerprint();assert.match(one,/^[a-f0-9]{64}$/);assert.equal(one,two);
});

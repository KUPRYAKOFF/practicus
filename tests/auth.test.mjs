import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync,randomUUID} from 'node:crypto';
import {Auth,passwordRecord,safeEqual,digest} from '../server/auth.js';
import {MemoryRepo} from './helpers.mjs';
test('production PBKDF2-SHA256 matches Node crypto including Cyrillic',()=>{
  const started=performance.now(),password='Сложный пароль 🙂 2026',salt='independent-salt';
  const record=passwordRecord(password,salt);
  assert.equal(record.iterations,600000);
  assert.equal(record.password_hash,pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex'));
  console.log(`Local PBKDF2 600000: ${Math.round(performance.now()-started)} ms (Node; Apps Script not measured)`);
  assert(!safeEqual(record.password_hash,'0'.repeat(64)));
});
test('session revocation, blocking and first-login restrictions enforced',()=>{
  const repo=new MemoryRepo();const now=()=>new Date('2026-11-21T10:00:00Z').toISOString();
  const auth=new Auth(repo,'a'.repeat(64),now,randomUUID);
  const u={id:'u',status:'active',must_change_password:true};repo.put('Users',u);
  const result=auth.session(u);assert.equal(repo.all('Sessions')[0].token_hash,digest(result.token));
  assert(!JSON.stringify(repo.all('Sessions')).includes(result.token));
  assert.throws(()=>auth.actor(result.token),/смените/);
  assert.equal(auth.actor(result.token,true).id,'u');
  repo.put('Users',{...u,status:'blocked'});assert.throws(()=>auth.actor(result.token,true),/Сессия/);
  repo.put('Users',{...u,must_change_password:false});auth.revoke('u');assert.throws(()=>auth.actor(result.token),/Сессия/);
});
test('sign in returns one-time session; unknown and incorrect login have same message',()=>{
  const repo=new MemoryRepo(),now=()=>new Date('2026-11-21T10:00:00Z').toISOString();
  const auth=new Auth(repo,'b'.repeat(64),now,randomUUID),password='Valid password 2026';
  repo.put('Users',{id:'u',full_name:'User',login:'student',role:'student',status:'active',must_change_password:true,...passwordRecord(password,'salt')});
  const result=auth.signIn('  STUDENT  ',password);assert.equal(result.user.id,'u');assert.equal(result.token.length,64);
  let known,unknown;try{auth.signIn('student','wrong password');}catch(e){known=e.message;}try{auth.signIn('missing','wrong password');}catch(e){unknown=e.message;}
  assert.equal(known,unknown);assert.equal(known,'Неверный логин или пароль');
  assert.equal(repo.all('Audit').filter(e=>e.action==='login_failed').length,2);
  assert(!JSON.stringify(repo.all('Audit')).includes(password));
});
test('persisted login limits reject calls before KDF',()=>{
  const repo=new MemoryRepo(),now=()=>new Date('2026-11-21T10:00:00Z').toISOString(),auth=new Auth(repo,'c'.repeat(64),now,randomUUID);
  repo.put('LoginAttempts',{id:digest('student'),count:8,window_at:now(),blocked_until:'2026-11-21T10:15:00Z'});
  assert.throws(()=>auth.signIn('student','any password'),e=>e.code==='RATE_LIMIT');
  repo.put('LoginAttempts',{id:'__global',count:120,window_at:now()});
  assert.throws(()=>auth.signIn('other','any password'),e=>e.code==='RATE_LIMIT');
});
test('password implementation works in GAS-like environment without TextEncoder',()=>{
  const previous=globalThis.TextEncoder;
  try{globalThis.TextEncoder=undefined;assert.equal(passwordRecord('Пароль 🙂 123','соль',2).password_hash,pbkdf2Sync('Пароль 🙂 123','соль',2,32,'sha256').toString('hex'));}
  finally{globalThis.TextEncoder=previous;}
});

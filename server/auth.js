import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { assert, login, text, MiB } from './domain.js';
// Apps Script V8 does not expose TextEncoder. Noble receives bytes, never strings.
const utf8 = value => {
  const result=[];
  for (const ch of value) {
    let cp=ch.codePointAt(0); if(cp>=0xd800 && cp<=0xdfff) cp=0xfffd;
    if(cp<128) result.push(cp);
    else if(cp<2048) result.push(192|(cp>>6),128|(cp&63));
    else if(cp<65536) result.push(224|(cp>>12),128|((cp>>6)&63),128|(cp&63));
    else result.push(240|(cp>>18),128|((cp>>12)&63),128|((cp>>6)&63),128|(cp&63));
  }
  return new Uint8Array(result);
};
const hex = bytes => Array.from(bytes, x => x.toString(16).padStart(2,'0')).join('');
export const digest = value => hex(sha256(utf8(value)));
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0; for (let i=0; i<a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function passwordRecord(password, salt, iterations = 600000) {
  assert(typeof password === 'string' && password.length >= 10 && password.length <= 128,
    'Пароль должен содержать от 10 до 128 символов', 'VALIDATION');
  return { salt, iterations, password_hash: hex(pbkdf2(sha256, utf8(password), utf8(salt), { c: iterations, dkLen: 32 })) };
}
export function publicUser(user) {
  const {id,full_name,login,role,group_id,subgroup,status,quota_bytes,must_change_password} = user;
  return {id,full_name,login,role,group_id,subgroup,status,quota_bytes,must_change_password};
}
export class Auth {
  constructor(repo, secret, now, uuid) {
    assert(secret?.length >= 43, 'Задайте AUTH_SECRET (32 случайных байта в base64)', 'CONFIG');
    this.repo=repo; this.secret=secret; this.now=now; this.uuid=uuid;
  }
  random() { return hex(hmac(sha256, utf8(this.secret), utf8(this.uuid() + ':' + this.now() + ':' + this.uuid()))); }
  session(user) {
    const token = this.random(); const at = this.now();
    this.repo.put('Sessions', {id:this.uuid(),user_id:user.id,token_hash:digest(token),issued_at:at,
      expires_at:new Date(Date.parse(at)+8*3600000).toISOString(),revoked_at:null});
    return {token, user:publicUser(user)};
  }
  actor(token, allowPasswordChange=false) {
    assert(typeof token === 'string' && token.length === 64, 'Войдите снова', 'UNAUTHORIZED');
    const hash=digest(token); const session=this.repo.all('Sessions').find(s => safeEqual(s.token_hash,hash));
    const user=session && this.repo.get('Users',session.user_id);
    assert(session && !session.revoked_at && session.expires_at > this.now() && user?.status === 'active', 'Сессия завершена. Войдите снова', 'UNAUTHORIZED');
    assert(allowPasswordChange || !user.must_change_password, 'Сначала смените временный пароль', 'PASSWORD_CHANGE');
    return user;
  }
  revoke(userId) {
    for (const s of this.repo.all('Sessions').filter(s=>s.user_id===userId && !s.revoked_at)) this.repo.put('Sessions',{...s,revoked_at:this.now()});
  }
  signIn(rawLogin,password) {
    const normalized=login(rawLogin);
    assert(typeof password==='string' && password.length<=128, 'Неверный логин или пароль', 'UNAUTHORIZED');
    const attemptId=digest(normalized);
    // Persistent reservation before the expensive KDF also limits parallel attempts.
    this.repo.lock(()=>{
      const global=this.repo.get('LoginAttempts','__global');
      const globalFresh=!global || Date.parse(this.now())-Date.parse(global.window_at)>900000;
      assert(globalFresh || global.count<120,'Слишком много попыток входа. Повторите позже','RATE_LIMIT');
      this.repo.put('LoginAttempts',{id:'__global',count:globalFresh?1:global.count+1,window_at:globalFresh?this.now():global.window_at});
      const previous=this.repo.get('LoginAttempts',attemptId);
      assert(!previous?.blocked_until || previous.blocked_until<=this.now(), 'Слишком много попыток. Повторите через 15 минут', 'RATE_LIMIT');
      const fresh=!previous || Date.parse(this.now())-Date.parse(previous.window_at)>900000;
      const count=fresh?1:previous.count+1;
      this.repo.put('LoginAttempts',{id:attemptId,count,window_at:fresh?this.now():previous.window_at,
        blocked_until:count>=8?new Date(Date.parse(this.now())+900000).toISOString():null});
    });
    const user=this.repo.all('Users').find(u=>u.login===normalized);
    // Same KDF work for an unknown account; never disclose whether a login exists.
    const hash=passwordRecord(password.length>=10?password:password.padEnd(10,' '),user?.salt || digest(this.secret+'dummy'),user?.iterations || 600000).password_hash;
    const valid=!!user && user.status==='active' && safeEqual(hash,user.password_hash) && password.length>=10;
    return this.repo.lock(()=>{
      const current=user && this.repo.get('Users',user.id);
      this.repo.put('Audit',{id:this.uuid(),actor_id:valid?user.id:null,action:valid?'login':'login_failed',at:this.now(),details:{login_fingerprint:attemptId}});
      assert(valid && current?.status==='active' && current.password_hash===user.password_hash, 'Неверный логин или пароль', 'UNAUTHORIZED');
      this.repo.put('LoginAttempts',{id:attemptId,count:0,window_at:this.now(),blocked_until:null});
      return this.session(current);
    });
  }
  createUser(input, password) {
    const role=input.role;
    assert(['student','teacher','admin'].includes(role), 'Неверная роль', 'VALIDATION');
    const userLogin=login(input.login); assert(userLogin.length>=3, 'Логин слишком короткий', 'VALIDATION');
    const fullName=text(input.full_name,160);assert(fullName.length>0,'Введите ФИО','VALIDATION');
    assert(!this.repo.all('Users').some(u=>u.login===userLogin), 'Логин уже занят', 'VALIDATION');
    if (role==='student') {
      assert(this.repo.get('Groups',input.group_id)?.active, 'Выберите активную группу', 'VALIDATION');
      assert([1,2].includes(Number(input.subgroup)), 'Выберите подгруппу 1 или 2', 'VALIDATION');
    }
    const record=passwordRecord(password,this.random());
    return this.repo.put('Users',{id:this.uuid(),full_name:fullName,login:userLogin,role,
      group_id:role==='student'?input.group_id:null,subgroup:role==='student'?Number(input.subgroup):null,status:'active',
      quota_bytes:role==='student'?125*MiB:250*MiB,...record,must_change_password:true,created_at:this.now()});
  }
}

// Run on YOUR computer. Desktop OAuth client JSON never belongs in the repository.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
const filename=process.argv[2];
if(!filename)throw new Error('Usage: node scripts/authorize-drive.mjs /absolute/path/to/client_secret.json');
const client=JSON.parse(await readFile(filename,'utf8')).installed;
if(!client?.client_id||!client?.client_secret)throw new Error('Нужен OAuth-клиент типа Desktop app');
const state=randomBytes(32).toString('hex'),port=8765,redirect=`http://127.0.0.1:${port}/callback`;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let consumed=false;
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  try{
    if(req.headers.host!==`127.0.0.1:${port}`)throw new Error('Неверный host');
    const url=new URL(req.url,redirect),incoming=url.searchParams.get('state')||'';
    if(consumed||url.pathname!=='/callback'||incoming.length!==state.length||!timingSafeEqual(Buffer.from(incoming),Buffer.from(state)))throw new Error('Неверный callback/state');
    consumed=true;
    if(!url.searchParams.get('code'))throw new Error('Авторизация отменена');
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:url.searchParams.get('code'),client_id:client.client_id,client_secret:client.client_secret,redirect_uri:redirect,grant_type:'authorization_code'})});
    const token=await response.json();
    if(!response.ok||!token.refresh_token)throw new Error('Google не выдал постоянный refresh token. Повторите согласие приложения.');
    const created=await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({name:'Practicus_Private_Storage',mimeType:'application/vnd.google-apps.folder'})});
    const folder=await created.json();if(!created.ok||!folder.id)throw new Error('Не удалось создать закрытую папку');
    const properties={DRIVE_CLIENT_ID:client.client_id,DRIVE_CLIENT_SECRET:client.client_secret,DRIVE_REFRESH_TOKEN:token.refresh_token,DRIVE_ROOT_ID:folder.id};
    res.end(`<html lang="ru"><meta charset="utf-8"><title>Подключение Drive</title><body style="font:16px system-ui;max-width:900px;margin:50px auto;padding:20px"><h1>Закрытая папка создана</h1><p>Скопируйте эти значения в Script Properties вашего Apps Script. Они показываются однократно. Не отправляйте их в чат или GitHub.</p><pre style="padding:20px;background:#f1f4fa;white-space:pre-wrap;overflow-wrap:anywhere">${escape(JSON.stringify(properties,null,2))}</pre><p>После сохранения закройте вкладку. Если выбран неверный Google-аккаунт, отзовите доступ приложения в нём и повторите настройку.</p></body></html>`);
  }catch(e){res.statusCode=400;res.end('<p>'+escape(e.message)+'</p>');}
  finally{if(consumed)server.close();}
});
server.listen(port,'127.0.0.1',()=>{
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  Object.entries({client_id:client.client_id,redirect_uri:redirect,response_type:'code',access_type:'offline',prompt:'consent select_account',scope:'https://www.googleapis.com/auth/drive.file',state}).forEach(([k,v])=>url.searchParams.set(k,v));
  console.log('Откройте URL на этом компьютере и выберите ВТОРОЙ аккаунт (хранилище):\n'+url.href+'\nОжидаем ответ. Секреты в терминал не выводятся.');
});
setTimeout(()=>{server.close();process.exitCode=1;},10*60*1000).unref();

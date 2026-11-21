export class RemoteApi {
  constructor(url) {this.url=url;this.token=null;this.pending=new Map();this.target=null;this.origin=null;}
  async connect() {
    if(this.target) return;
    if(this.connecting) return this.connecting;
    const parsed=new URL(this.url);
    if(parsed.origin!=='https://script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname)) throw new Error('Проверьте URL опубликованного Apps Script');
    this.channel=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    this.connecting=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.destroy();reject(new Error('Apps Script не ответил. Проверьте публикацию с доступом «Все».'));},30000);
      this.listener=event=>{
        const data=event.data;
        if(data?.channel!==this.channel) return;
        if(!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin) && event.origin!=='https://script.google.com') return;
        if(data.type==='ready' && !this.target) {
          this.target=event.source;this.origin=event.origin;clearTimeout(timeout);resolve();return;
        }
        if(event.source!==this.target || event.origin!==this.origin || data.type!=='response') return;
        const pending=this.pending.get(data.id);if(!pending)return;
        clearTimeout(pending.timeout);this.pending.delete(data.id);
        if(data.result?.ok) pending.resolve(data.result.data);
        else {const error=new Error(data.result?.error?.message || 'Ошибка сервера');error.code=data.result?.error?.code;pending.reject(error);}
      };
      window.addEventListener('message',this.listener);
      this.frame=document.createElement('iframe');this.frame.hidden=true;this.frame.title='Защищённое соединение';
      parsed.searchParams.set('channel',this.channel);this.frame.src=parsed.href;document.body.append(this.frame);
    });
    return this.connecting;
  }
  async send(message,timeoutMs=120000) {
    await this.connect();
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.pending.delete(id);const e=new Error('Ответ задержался. Если вы загружали файлы, проверьте состояние операции перед повторной сдачей.');e.code='TIMEOUT';reject(e);},timeoutMs);
      this.pending.set(id,{resolve,reject,timeout});
      this.target.postMessage({...message,id,channel:this.channel},this.origin);
    });
  }
  call(action,payload={}) {return this.send({type:'rpc',request:{action,token:this.token,payload}});}
  upload(reservationId,files) {return this.send({type:'upload',token:this.token,reservation_id:reservationId,files},125000);}
  destroy() {
    if(this.listener)window.removeEventListener('message',this.listener);
    this.frame?.remove();this.target=null;this.connecting=null;this.token=null;
    for(const p of this.pending.values()){clearTimeout(p.timeout);p.reject(new Error('Соединение закрыто'));}this.pending.clear();
  }
}
export async function downloadFile(api,file,onProgress=()=>{}) {
  const chunks=[];let offset=0;
  while(offset<file.size) {
    const chunk=await api.call('downloadChunk',{file_id:file.id,offset});
    const binary=atob(chunk.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(chunk.offset!==offset || bytes.length!==chunk.size || chunk.total!==file.size) throw new Error('Размер скачиваемого файла изменился');
    chunks.push(bytes);offset+=bytes.length;onProgress(offset/file.size);
  }
  const url=URL.createObjectURL(new Blob(chunks,{type:file.type || 'application/octet-stream'}));
  const link=document.createElement('a');link.href=url;link.download=file.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

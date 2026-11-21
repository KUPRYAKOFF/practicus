import { assert } from './domain.js';
export class PrivateDrive {
  constructor(properties) { this.props=properties; this.token=null; }
  get(key) { const value=this.props.getProperty(key); assert(value, 'Не настроен '+key, 'CONFIG'); return value; }
  accessToken() {
    if (this.token) return this.token;
    const response=UrlFetchApp.fetch('https://oauth2.googleapis.com/token',{method:'post',muteHttpExceptions:true,
      payload:{grant_type:'refresh_token',client_id:this.get('DRIVE_CLIENT_ID'),client_secret:this.get('DRIVE_CLIENT_SECRET'),refresh_token:this.get('DRIVE_REFRESH_TOKEN')}});
    assert(response.getResponseCode()===200, 'Не удалось авторизовать аккаунт хранилища', 'STORAGE');
    this.token=JSON.parse(response.getContentText()).access_token; return this.token;
  }
  request(path, options={}) {
    const response=UrlFetchApp.fetch('https://www.googleapis.com/'+path,{...options,muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+this.accessToken(),...options.headers}});
    assert(response.getResponseCode()>=200 && response.getResponseCode()<300, 'Ошибка закрытого хранилища ('+response.getResponseCode()+')', 'STORAGE');
    return response;
  }
  check() {
    const account=JSON.parse(this.request('drive/v3/about?fields=user,storageQuota').getContentText());
    const root=JSON.parse(this.request('drive/v3/files/'+encodeURIComponent(this.get('DRIVE_ROOT_ID'))+'?fields=id,mimeType,ownedByMe,trashed,permissions(type,role)').getContentText());
    assert(root.ownedByMe && !root.trashed && root.mimeType==='application/vnd.google-apps.folder', 'Корневая папка должна принадлежать аккаунту хранилища', 'CONFIG');
    assert(!root.permissions?.some(p=>['anyone','domain'].includes(p.type)), 'Уберите публичный доступ к папке хранилища', 'CONFIG');
    return {storageQuota:account.storageQuota,owner:account.user.emailAddress};
  }
  create(blob, id, meta) {
    const response=this.request('upload/drive/v3/files?uploadType=resumable&fields=id,size,createdTime',{
      method:'post',contentType:'application/json',headers:{'X-Upload-Content-Type':meta.type,'X-Upload-Content-Length':String(meta.size)},
      payload:JSON.stringify({name:'file_'+id+'__'+meta.name,parents:[this.get('DRIVE_ROOT_ID')],appProperties:{practicusFile:id}})});
    const headers=response.getAllHeaders(); const location=headers.Location || headers.location;
    assert(typeof location==='string' && location.startsWith('https://www.googleapis.com/'), 'Неверный адрес загрузки Drive', 'STORAGE');
    const uploaded=UrlFetchApp.fetch(location,{method:'put',contentType:meta.type,payload:blob,muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+this.accessToken()}});
    assert(uploaded.getResponseCode()>=200 && uploaded.getResponseCode()<300, 'Drive не подтвердил загрузку', 'STORAGE');
    const result=JSON.parse(uploaded.getContentText());
    assert(Number(result.size)===meta.size, 'Drive сохранил неверный размер', 'STORAGE');
    return {drive_id:result.id,created_at:result.createdTime};
  }
  remove(driveId) {
    const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(driveId),
      {method:'delete',muteHttpExceptions:true,headers:{Authorization:'Bearer '+this.accessToken()}});
    assert([204,404,410].includes(response.getResponseCode()), 'Файл ожидает повторного удаления', 'STORAGE');
  }
  findByLogicalId(id) {
    assert(/^[a-zA-Z0-9-]+$/.test(id),'Некорректный ID','VALIDATION');
    const query="trashed = false and appProperties has { key='practicusFile' and value='"+id+"' }";
    const result=JSON.parse(this.request('drive/v3/files?q='+encodeURIComponent(query)+'&fields=files(id,size,createdTime)&pageSize=100').getContentText());
    return result.files || [];
  }
  chunk(driveId, offset, size) {
    const response=this.request('drive/v3/files/'+encodeURIComponent(driveId)+'?alt=media',
      {headers:{Range:'bytes='+offset+'-'+(offset+size-1)}});
    const bytes=response.getContent();
    assert(bytes.length<=size, 'Drive не поддержал ограниченный диапазон скачивания', 'STORAGE');
    return Utilities.base64Encode(bytes);
  }
}

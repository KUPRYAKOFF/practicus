import {assert} from './domain.js';
import {MAX_BACKUP_BYTES} from './backups.js';

export function ensureBackupRoot(props) {
  let id=props.getProperty('BACKUP_ROOT_ID');
  if(!id){id=DriveApp.createFolder('Practicus_Metadata_Backups').getId();props.setProperty('BACKUP_ROOT_ID',id);}
  return id;
}
export class BackupStore {
  constructor(props,drive){this.props=props;this.drive=drive;this.checked=false;}
  folder(){
    const id=this.props.getProperty('BACKUP_ROOT_ID');assert(id,'Запустите runInitialSetup для включения резервных копий','CONFIG');
    const folder=DriveApp.getFolderById(id);
    if(!this.checked){
      assert(folder.getOwner()?.getEmail()===Session.getEffectiveUser().getEmail() && folder.getSharingAccess()===DriveApp.Access.PRIVATE && !folder.getEditors().length && !folder.getViewers().length,
        'Папка резервных копий должна быть доступна только выделенному аккаунту','BACKUP');this.checked=true;
    }
    return folder;
  }
  write(raw,name){
    const folder=this.folder(),blob=Utilities.newBlob(raw,'application/json','pending-'+name);assert(blob.getBytes().length<=MAX_BACKUP_BYTES,'Резервная копия превышает 20 МиБ','BACKUP');
    const file=folder.createFile(blob);return {id:file.getId(),size:file.getSize(),created_at:file.getDateCreated().toISOString()};
  }
  file(id){
    const folder=this.folder(),file=DriveApp.getFileById(id),parents=file.getParents();let belongs=false;
    while(parents.hasNext())if(parents.next().getId()===folder.getId())belongs=true;
    assert(belongs && /^(?:pending-)?practicus-metadata-.*\.json$/.test(file.getName()) && file.getSize()<=MAX_BACKUP_BYTES &&
      file.getOwner()?.getEmail()===Session.getEffectiveUser().getEmail() && file.getSharingAccess()===DriveApp.Access.PRIVATE && !file.getEditors().length && !file.getViewers().length,
      'Файл не является закрытой резервной копией этого приложения','BACKUP');
    return file;
  }
  read(id){return this.file(id).getBlob().getDataAsString('UTF-8');}
  commit(id){const file=this.file(id);assert(file.getName().startsWith('pending-'),'Копия уже зафиксирована','BACKUP');file.setName(file.getName().slice(8));}
  prunePending(){
    const files=this.folder().getFiles();let failed=0;
    while(files.hasNext()){const f=files.next();if(f.getName().startsWith('pending-practicus-metadata-') && Date.now()-f.getDateCreated().getTime()>2*86400000)try{this.drive.remove(f.getId());}catch{failed++;}}
    return failed;
  }
  list(){
    const files=this.folder().getFiles(),result=[];
    while(files.hasNext()){const f=files.next();if(/^practicus-metadata-.*\.json$/.test(f.getName()))result.push({id:f.getId(),size:f.getSize(),created_at:f.getDateCreated().toISOString()});}
    return result;
  }
  remove(id){this.file(id);this.drive.remove(id);}
  inventory(){
    this.drive.check();const root=this.props.getProperty('DRIVE_ROOT_ID');assert(/^[a-zA-Z0-9_-]+$/.test(root),'Неверная папка Drive','CONFIG');
    const files=new Map();let page='';
    do{
      const query="'"+root+"' in parents and trashed = false";
      const result=JSON.parse(this.drive.request('drive/v3/files?q='+encodeURIComponent(query)+'&fields=nextPageToken,files(id,size)&pageSize=1000'+(page?'&pageToken='+encodeURIComponent(page):'')).getContentText());
      for(const file of result.files||[])files.set(file.id,{size:Number(file.size)});page=result.nextPageToken||'';
    }while(page);
    return files;
  }
}

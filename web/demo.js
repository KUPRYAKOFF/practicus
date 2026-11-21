const uid=()=>crypto.randomUUID();
const MiB=1024*1024;
const iso=days=>new Date(Date.now()+days*86400000).toISOString();
const bytes=text=>new TextEncoder().encode(text);
export class DemoApi {
  constructor() {
    this.demo=true;this.token=null;
    this.groups=[{id:'g1',name:'Э-23-1',active:true},{id:'g2',name:'Э-23-2',active:true},{id:'g3',name:'ИС-24-1',active:true}];
    this.users=[
      {id:'s1',full_name:'Алексей Соколов',login:'student',role:'student',group_id:'g1',subgroup:1},
      {id:'s2',full_name:'Дарья Морозова',login:'morozova',role:'student',group_id:'g1',subgroup:1},
      {id:'s3',full_name:'Михаил Орлов',login:'orlov',role:'student',group_id:'g1',subgroup:2},
      {id:'s4',full_name:'Анна Волкова',login:'volkova',role:'student',group_id:'g2',subgroup:1},
      {id:'t1',full_name:'Марина Андреевна Белова',login:'teacher',role:'teacher'},
      {id:'a1',full_name:'Администратор',login:'admin',role:'admin'},
    ].map(u=>({...u,status:'active',quota_bytes:(u.role==='student'?125:250)*MiB,must_change_password:false}));
    this.access=[{id:'ta1',teacher_id:'t1',group_id:'g1',subgroup:0,active:true},{id:'ta2',teacher_id:'t1',group_id:'g2',subgroup:0,active:true}];
    const definitions=[
      ['a1','Расчёт электрических цепей','Электротехника',3,'published','close'],
      ['a2','Исследование закона Ома','Электротехника',1,'published','allow'],
      ['a3','Измерение мощности в цепи','Электрические измерения',-2,'published','allow'],
      ['a4','Расчёт трёхфазной системы','Электротехника',6,'published','close'],
      ['a5','Техника безопасности в электроустановках','Охрана труда',-5,'published','allow'],
      ['a6','Подбор защитной аппаратуры','Электроснабжение',9,'published','close'],
      ['a7','Схемы соединения трансформаторов','Электротехника',null,'draft','close'],
      ['a8','Основы электрических измерений','Электрические измерения',-30,'archived','close'],
    ];
    this.assignments=definitions.map(([id,title,description,due,status,late])=>({id,title,description,teacher_id:'t1',teacher_name:this.users[4].full_name,
      instructions:'Цель работы\nЗакрепить теоретические знания и применить их при решении практических задач.\n\nПорядок выполнения\n1. Изучите методические указания.\n2. Выполните расчёты и запишите ход решения.\n3. Оформите выводы по результатам работы.\n4. Прикрепите отчёт и необходимые приложения одним комплектом.\n\nВ отчёте укажите номер группы, ФИО и название практической работы.',
      targets:[{group_id:'g1',subgroup:0},{group_id:'g2',subgroup:0}],due_at:due===null?null:iso(due),late_policy:late,publication_status:status,version:1,created_at:iso(-7),updated_at:iso(-1),materials:[]}));
    this.fileData=new Map();this.submissions=[];this.operations=new Map();this.audit=[];
    for(const a of this.assignments.slice(0,6)) a.materials=[this.file('Методические указания.txt','Учебный пример.\nВыполните расчёты и оформите отчёт.\n',a.id,'t1')];
    const seeds=[['a2','s1','pending_review',null],['a3','s1','needs_revision',null],['a5','s1','accepted',5],['a8','s1','accepted',4],['a1','s2','pending_review',null],['a1','s3','accepted',4],['a2','s4','accepted',5]];
    for(const [assignment_id,student_id,status,grade] of seeds) {
      const file=this.file('Отчёт.txt','Демонстрационный отчёт. Данные вымышлены.\n',assignment_id,student_id);
      const s={id:uid(),assignment_id,student_id,status,grade,feedback:status==='needs_revision'?'Проверьте единицы измерения в третьем расчёте и добавьте вывод.':status==='accepted'?'Работа выполнена.':'' ,submitted_at:iso(-1),started_at:iso(-1),is_late:assignment_id==='a3',generation:uid(),attempts:1,files:[file],files_deleted:false};
      this.submissions.push(s);
    }
  }
  file(name,content,assignment_id,owner_id) {
    const blob=content instanceof Blob?content:new Blob([content],{type:'text/plain'});
    const f={id:uid(),name,type:blob.type,size:blob.size,created_at:new Date().toISOString(),assignment_id,owner_id};
    this.fileData.set(f.id,{...f,blob});return f;
  }
  actor(){const id=this.token?.replace('demo:','');const u=this.users.find(u=>u.id===id);if(!u || u.status!=='active')throw new Error('Сессия завершена');return u;}
  enter(role){const u=this.users.find(u=>u.role===role);this.token='demo:'+u.id;return {token:this.token,user:{...u}};}
  log(u,action,id,details={}){this.audit.unshift({id:uid(),actor_id:u.id,action,entity_id:id,at:new Date().toISOString(),details});}
  used(u){return [...this.fileData.values()].filter(f=>f.owner_id===u.id).reduce((n,f)=>n+f.size,0);}
  sub(a,u){return this.submissions.find(s=>s.assignment_id===a && s.student_id===u);}
  targeted(a,u){return a.targets.some(t=>t.group_id===u.group_id && (!t.subgroup || t.subgroup===u.subgroup));}
  teacherCan(u,student){return this.access.some(a=>a.teacher_id===u.id && a.group_id===student.group_id && (!a.subgroup || a.subgroup===student.subgroup));}
  rows(u,a){return this.users.filter(s=>s.role==='student' && (this.targeted(a,s)||this.sub(a.id,s.id)) && (u.role==='admin'||this.teacherCan(u,s))).map(student=>({student,submission:this.sub(a.id,student.id) || null}));}
  async call(action,p={}) {
    await new Promise(resolve=>setTimeout(resolve,80));
    const u=this.actor();let a=this.assignments.find(a=>a.id===p.assignment_id);
    switch(action) {
      case 'bootstrap':return {user:{...u},groups:this.groups.filter(g=>g.active),access:this.access.filter(a=>u.role==='admin'||a.teacher_id===u.id),quota:{used:this.used(u),limit:u.quota_bytes},uploads_enabled:true,transport_verified:true,file_limit:25*MiB,release:{version:'1.0.0'}};
      case 'listAssignments':return this.assignments.filter(a=>u.role==='admin'||u.role==='teacher'&&a.teacher_id===u.id||u.role==='student'&&a.publication_status!=='draft'&&(a.publication_status==='archived'?!!this.sub(a.id,u.id):(this.targeted(a,u)||!!this.sub(a.id,u.id)))).map(a=>{
        if(u.role!=='student') {const rows=this.rows(u,a);return {...a,stats:{total:rows.length,submitted:rows.filter(r=>r.submission).length,pending:rows.filter(r=>r.submission?.status==='pending_review').length,accepted:rows.filter(r=>r.submission?.status==='accepted').length,late:rows.filter(r=>r.submission?.is_late).length}};}
        const s=this.sub(a.id,u.id),archived=a.publication_status==='archived',assigned=this.targeted(a,u)&&!archived;
        if(archived)return {id:a.id,title:a.title,publication_status:'archived',assigned:false,description:'',instructions:'',materials:[],due_at:null,submission:s?{grade:s.grade}:null,created_at:a.created_at};
        return {...a,assigned,description:assigned?a.description:'',instructions:assigned?a.instructions:'',materials:assigned?a.materials:[],submission:s?{...s,feedback:archived?'':s.feedback,files:archived?[]:s.files}:null};
      });
      case 'reviewRows':return this.rows(u,a);
      case 'review':{
        const s=this.submissions.find(s=>s.id===p.submission_id);if(!s||s.generation!==p.generation)throw new Error('Версия работы изменилась');
        Object.assign(s,{status:p.status,grade:p.status==='needs_revision'?null:p.grade===''?null:p.grade,feedback:p.feedback,reviewed_at:new Date().toISOString(),reviewer_id:u.id});this.log(u,'submission_reviewed',s.id);return {...s};
      }
      case 'saveAssignment':{
        const old=this.assignments.find(a=>a.id===p.id);const saved={...old,...p,id:old?.id||uid(),teacher_id:old?.teacher_id||u.id,teacher_name:u.full_name,version:(old?.version||0)+1,created_at:old?.created_at||iso(0),materials:old?.materials||[]};
        if(old)this.assignments[this.assignments.indexOf(old)]=saved;else this.assignments.unshift(saved);this.log(u,'assignment_saved',saved.id);return saved;
      }
      case 'beginUpload':{
        const prior=[...this.operations.values()].find(r=>r.key===p.idempotency_key&&r.user_id===u.id);if(prior)return prior;
        if(p.files.length<1||p.files.length>25||p.files.reduce((n,f)=>n+f.size,0)>25*MiB)throw new Error('Не более 25 файлов, суммарно до 25 МиБ');
        const previous=p.kind==='submission'?this.sub(a?.id,u.id):null;
        if(p.kind==='submission' && (!a||!this.targeted(a,u)||a.publication_status!=='published'||previous?.status==='accepted'))throw new Error('Повторная сдача недоступна');
        if(p.kind==='submission'&&a.due_at&&a.due_at<iso(0)&&a.late_policy==='close'&&previous?.status!=='needs_revision')throw new Error('Срок сдачи истёк');
        const oldSize=(p.kind==='materials'?a.materials:previous?.files||[]).reduce((n,f)=>n+f.size,0);
        if(this.used(u)-oldSize+p.files.reduce((n,f)=>n+f.size,0)>u.quota_bytes)throw new Error('Удалите файлы старых работ для освобождения места');
        const op={id:uid(),key:p.idempotency_key,user_id:u.id,...p,status:'reserved',started_at:iso(0)};this.operations.set(op.id,op);return op;
      }
      case 'uploadStatus':return this.operations.get(p.id);
      case 'deleteSubmissionFiles':{
        const s=this.submissions.find(s=>s.id===p.submission_id);for(const f of s.files)this.fileData.delete(f.id);s.files=[];s.files_deleted=true;this.log(u,'submission_files_deleted',s.id);return {deleted:true};
      }
      case 'deleteMaterial':{
        for(const a of this.assignments)a.materials=a.materials.filter(f=>f.id!==p.file_id);this.fileData.delete(p.file_id);return {deleted:true};
      }
      case 'downloadChunk':{
        const f=this.fileData.get(p.file_id);if(!f)throw new Error('Файл удалён');
        const data=new Uint8Array(await f.blob.slice(p.offset,p.offset+256*1024).arrayBuffer());
        let binary='';for(const b of data)binary+=String.fromCharCode(b);
        return {data:btoa(binary),offset:p.offset,size:data.length,total:f.size,name:f.name,type:f.type};
      }
      case 'adminData':return {users:this.users.map(s=>({...s,used:this.used(s)})),groups:this.groups,access:this.access,audit:this.audit,storage:{current:[...this.fileData.values()].reduce((n,f)=>n+f.size,0),physical:[...this.fileData.values()].reduce((n,f)=>n+f.size,0),pending:0},operations:[...this.operations.values()]};
      case 'importUsers':return {results:[]};
      case 'createUser':{
        if(this.users.some(u=>u.login.toLowerCase()===p.login.trim().toLowerCase()))throw new Error('Логин уже занят');
        const user={id:uid(),...p,status:'active',must_change_password:true,quota_bytes:(p.role==='student'?125:250)*MiB};this.users.push(user);this.log(u,'user_created',user.id);return {user,temporary_password:'DEMO-'+uid().slice(0,12)};
      }
      case 'updateUser':{const target=this.users.find(s=>s.id===p.id);Object.assign(target,p);this.log(u,'user_updated',p.id);return target;}
      case 'resetPassword':this.log(u,'password_reset',p.id);return {temporary_password:'DEMO-'+uid().slice(0,12)};
      case 'revokeSessions':this.log(u,'sessions_revoked',p.id);return {ok:true};
      case 'saveGroup':{const old=this.groups.find(g=>g.id===p.id);if(old)Object.assign(old,p);else this.groups.push({...p,id:uid()});this.log(u,'group_saved',p.id);return p;}
      case 'saveTeacherAccess':this.access=this.access.filter(a=>a.teacher_id!==p.teacher_id).concat(p.targets.map(t=>({...t,id:uid(),teacher_id:p.teacher_id,active:true})));this.log(u,'teacher_access_changed',p.teacher_id);return {ok:true};
      case 'changePassword':u.must_change_password=false;return {token:this.token,user:{...u}};
      case 'backupStatus':return this.backup||{last_success_at:null,last_size:0,retained:0,keep:7};
      case 'createBackup':this.backup={last_success_at:iso(0),last_size:2048,retained:1,keep:7};return this.backup;
      case 'storageHealth':return {owner:'Демонстрационный аккаунт',storageQuota:{usage:this.used(u),limit:15*1024*MiB}};
      case 'runCleanup':return {deleted:0,pending:0};
      case 'logout':this.token=null;return {ok:true};
      default:throw new Error('Действие недоступно в демонстрации');
    }
  }
  async upload(id,files) {
    const r=this.operations.get(id),u=this.actor();if(r.status==='committed')return r.result;
    const a=this.assignments.find(a=>a.id===r.assignment_id);
    const uploaded=files.map(f=>this.file(f.name,f,a?.id || '__spike',u.id));
    if(r.kind==='submission') {
      let s=this.sub(a.id,u.id);if(s)for(const f of s.files)this.fileData.delete(f.id);
      const data={id:s?.id||uid(),assignment_id:a.id,student_id:u.id,status:'pending_review',grade:null,feedback:'',files:uploaded,files_deleted:false,generation:uid(),started_at:r.started_at,submitted_at:iso(0),is_late:!!a.due_at&&r.started_at>a.due_at,attempts:(s?.attempts||0)+1};
      if(s)Object.assign(s,data);else this.submissions.push(data);r.result=data;this.log(u,'submission_saved',data.id);
    } else if(r.kind==='materials') {for(const f of a.materials)this.fileData.delete(f.id);a.materials=uploaded;r.result={saved:true};}
    else r.result={files:uploaded};
    r.status='committed';return r.result;
  }
  destroy(){this.token=null;}
}

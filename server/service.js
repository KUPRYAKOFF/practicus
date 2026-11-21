import { assert, fail, text, checkSubmit, studentAccess, sameGroup, canTeach, teacherScope,
  validateManifest, validateBytes, quotaCheck, expired, LIMIT, MiB } from './domain.js';
import { publicUser, passwordRecord, safeEqual, digest } from './auth.js';

export function createService({repo,auth,storage,now,uuid,settings,backups}) {
  const requireAvailable=()=>assert(!settings.isMaintenance?.(),'Ведутся технические работы. Повторите позже','MAINTENANCE');
  const audit=(actor,action,id,details={})=>repo.put('Audit',{id:uuid(),actor_id:actor?.id || 'system',action,entity_id:id,at:now(),details});
  const submission=(assignmentId,studentId)=>repo.all('Submissions').find(s=>s.assignment_id===assignmentId && s.student_id===studentId);
  const getAssignment=id=>{const a=repo.get('Assignments',id); assert(a,'Задание не найдено','NOT_FOUND'); return a;};
  const requireAdmin=u=>assert(u.role==='admin');
  const requireTeacher=(u,a)=>assert(u.role==='admin' || (u.role==='teacher' && a.teacher_id===u.id));
  const tableFor=r=>r.kind==='submission'?'SubmissionFiles':'Materials';
  const allFiles=()=>[...repo.all('SubmissionFiles').map(f=>({...f,table:'SubmissionFiles'})),...repo.all('Materials').map(f=>({...f,table:'Materials'}))];
  const isCurrent=f=>f.table==='Materials' ? repo.get('Assignments',f.assignment_id)?.material_generation===f.generation : repo.get('Submissions',f.submission_id)?.generation===f.generation;
  const currentFiles=()=>allFiles().filter(f=>!f.deleted_at && f.drive_id && isCurrent(f));
  const used=u=>currentFiles().filter(f=>f.owner_id===u.id).reduce((sum,f)=>sum+f.size,0);
  const publicFile=({id,name,type,size,created_at,deleted_at})=>({id,name,type,size,created_at,deleted_at});
  const filesFor=s=>s?currentFiles().filter(f=>f.submission_id===s.id).map(publicFile):[];
  const studentView=(u,a)=>{
    const s=submission(a.id,u.id); const assigned=studentAccess(u,a,s);
    const archived=a.publication_status==='archived';
    if(archived)return {id:a.id,title:a.title,publication_status:'archived',assigned:false,description:'',instructions:'',materials:[],due_at:null,submission:s?{grade:s.grade}:null};
    return {id:a.id,title:a.title,teacher_name:repo.get('Users',a.teacher_id)?.full_name || 'Преподаватель',
      description:assigned?a.description:'',instructions:assigned?a.instructions:'',due_at:a.due_at,late_policy:a.late_policy,
      publication_status:a.publication_status,version:a.version,created_at:a.created_at,assigned,
      submission:s?(archived?{grade:s.grade}:{id:s.id,status:s.status,grade:s.grade,feedback:s.feedback,
        submitted_at:s.submitted_at,started_at:s.started_at,is_late:s.is_late,generation:s.generation,files_deleted:s.files_deleted,
        files:filesFor(s)}):null,
      materials:assigned?currentFiles().filter(f=>f.table==='Materials' && f.assignment_id===a.id).map(publicFile):[]};
  };
  function checkFileAccess(u,f) {
    assert(f && !f.deleted_at && f.drive_id, 'Файл удалён или недоступен', 'NOT_FOUND');
    if(u.role==='admin') return;
    assert(isCurrent(f), 'Версия файла недоступна');
    const a=getAssignment(f.assignment_id);
    if(f.table==='SubmissionFiles') {
      const s=repo.get('Submissions',f.submission_id);
      const student=repo.get('Users',s.student_id);
      assert((u.id===s.student_id && studentAccess(u,a,s,'own')) || canTeach(u,a,student,repo.all('TeacherAccess')));
    } else {
      assert((u.role==='student' && studentAccess(u,a,submission(a.id,u.id))) ||
        (u.role==='teacher' && a.teacher_id===u.id && teacherScope(u,a.targets,repo.all('TeacherAccess'))));
    }
  }
  function reviewRows(u,a) {
    requireTeacher(u,a);
    return repo.all('Users').filter(s=>s.role==='student' &&
      (a.targets.some(t=>sameGroup(s,t)) || !!submission(a.id,s.id)) &&
      (u.role==='admin' || canTeach(u,a,s,repo.all('TeacherAccess')))).map(s=>{
        const answer=submission(a.id,s.id);
        return {student:publicUser(s),submission:answer?{...answer,files:filesFor(answer)}:null};
      });
  }
  function visibleAssignments(u) {
    return repo.all('Assignments').filter(a=>{
      if(u.role==='admin') return true;
      if(u.role==='teacher') return a.teacher_id===u.id;
      const s=submission(a.id,u.id);
      return studentAccess(u,a,s) || studentAccess(u,a,s,'own') || studentAccess(u,a,s,'grade');
    }).map(a=>{
      if(u.role==='student') return studentView(u,a);
      const rows=reviewRows(u,a);
      return {...a,materials:currentFiles().filter(f=>f.table==='Materials' && f.assignment_id===a.id).map(publicFile),
        teacher_name:repo.get('Users',a.teacher_id)?.full_name,
        stats:{total:rows.length,submitted:rows.filter(r=>r.submission).length,pending:rows.filter(r=>r.submission?.status==='pending_review').length,
          accepted:rows.filter(r=>r.submission?.status==='accepted').length,late:rows.filter(r=>r.submission?.is_late || (!r.submission && a.due_at && a.due_at<now())).length}};
    });
  }
  function reserve(u,p) {
    assert(settings.uploadsEnabled || (u.role==='admin' && p.kind==='spike'), 'Загрузка файлов отключена администратором', 'UPLOADS_DISABLED');
    assert(['submission','materials','spike'].includes(p.kind), 'Неверная операция','VALIDATION');
    const manifest=validateManifest(p.files,settings.fileLimit || LIMIT);
    const key=text(p.idempotency_key,100); assert(key.length>=16,'Нужен ключ операции','VALIDATION');
    const previous=repo.all('UploadReservations').find(r=>r.user_id===u.id && r.idempotency_key===key);
    if(previous) {
      assert(previous.assignment_id===(p.assignment_id || '__spike') && previous.kind===p.kind && JSON.stringify(previous.manifest)===JSON.stringify(manifest.files), 'Ключ уже используется другой операцией','CONFLICT');
      return {id:previous.id,status:previous.status,result:previous.result,started_at:previous.started_at};
    }
    let a,old,baseGeneration=null;
    if(p.kind==='submission') {
      a=getAssignment(p.assignment_id); old=submission(a.id,u.id); checkSubmit(u,a,old,now()); baseGeneration=old?.generation || null;
    } else if(p.kind==='materials') {
      a=getAssignment(p.assignment_id); requireTeacher(u,a);
      assert(u.role==='admin' || teacherScope(u,a.targets,repo.all('TeacherAccess')));
      old=a; baseGeneration=a.material_generation || null;
    } else requireAdmin(u);
    const assignmentId=a?.id || '__spike';
    const active=repo.all('UploadReservations').filter(r=>r.expires_at>now() && ['reserved','receiving'].includes(r.status));
    assert(!active.some(r=>r.user_id===u.id && r.assignment_id===assignmentId), 'Уже идёт загрузка в это задание','CONFLICT');
    const replaced=currentFiles().filter(f=>f.owner_id===u.id && f.assignment_id===assignmentId &&
      (p.kind==='materials'?f.table==='Materials':f.table==='SubmissionFiles')).reduce((sum,f)=>sum+f.size,0);
    const reserved=active.filter(r=>r.user_id===u.id).reduce((sum,r)=>sum+Math.max(0,r.total-r.replaced_bytes),0);
    quotaCheck(u.quota_bytes,used(u),replaced,reserved,manifest.total);
    const r={id:uuid(),user_id:u.id,assignment_id:assignmentId,kind:p.kind,manifest:manifest.files,total:manifest.total,replaced_bytes:replaced,
      started_at:now(),expires_at:new Date(Date.parse(now())+120000).toISOString(),status:'reserved',generation:uuid(),
      base_generation:baseGeneration,base_version:a?.version || null,idempotency_key:key,result:null,file_ids:[]};
    repo.put('UploadReservations',r); audit(u,'upload_reserved',r.id,{kind:p.kind,total:r.total});
    return {id:r.id,status:r.status,started_at:r.started_at};
  }
  function recoverCommitted(r) {
    if(r.kind==='submission') {
      const s=submission(r.assignment_id,r.user_id);
      if(s?.generation===r.generation) return {submission_id:s.id,generation:s.generation,status:s.status,submitted_at:s.submitted_at,is_late:s.is_late};
    } else if(r.kind==='materials' && repo.get('Assignments',r.assignment_id)?.material_generation===r.generation) return {saved:true};
    return null;
  }
  function upload(token,reservationId,blobs) {
    let r,u;
    const early=repo.lock(()=>{
      requireAvailable();u=auth.actor(token); r=repo.get('UploadReservations',reservationId);
      assert(r && r.user_id===u.id,'Операция недоступна');
      const recovered=recoverCommitted(r);
      if(r.status==='committed' || recovered) {
        if(recovered && r.status!=='committed') repo.put('UploadReservations',{...r,status:'committed',result:recovered});
        return r.result || recovered;
      }
      assert(r.status==='reserved','Загрузка уже выполняется или завершилась ошибкой','CONFLICT');
      assert(r.expires_at>=now(),'Время загрузки истекло. Начните заново','TIMEOUT');
      assert(settings.uploadsEnabled || (u.role==='admin' && r.kind==='spike'),'Загрузка файлов отключена','UPLOADS_DISABLED');
      r=repo.put('UploadReservations',{...r,status:'receiving',file_ids:r.manifest.map(()=>uuid())});
      return null;
    });
    if(early) return early;
    try {
      assert(blobs.length===r.manifest.length,'Получен неполный комплект','VALIDATION');
      // Validate the entire set before writing anything to Drive.
      blobs.forEach((blob,i)=>validateBytes(r.manifest[i],blob.getBytes()));
      const fileTable=tableFor(r);
      for(let i=0;i<blobs.length;i++) {
        assert(now()<=r.expires_at,'Загрузка превысила две минуты','TIMEOUT');
        const meta=r.manifest[i];
        repo.lock(()=>repo.put(fileTable,{id:r.file_ids[i],assignment_id:r.assignment_id,owner_id:u.id,generation:r.generation,
          name:meta.name,type:meta.type,size:meta.size,drive_id:null,created_at:now(),deleted_at:null,delete_pending:false}));
        const saved=storage.create(blobs[i],r.file_ids[i],meta);
        repo.lock(()=>repo.put(fileTable,{id:r.file_ids[i],...saved}));
      }
      return repo.lock(()=>{
        requireAvailable();u=auth.actor(token); r=repo.get('UploadReservations',r.id);
        assert(r.status==='receiving','Загрузка отменена','CONFLICT');
        assert(now()<=r.expires_at,'Загрузка превысила две минуты','TIMEOUT');
        const replacement=currentFiles().filter(f=>f.owner_id===u.id && f.assignment_id===r.assignment_id &&
          (r.kind==='materials'?f.table==='Materials':f.table==='SubmissionFiles')).reduce((n,f)=>n+f.size,0);
        const otherReserved=repo.all('UploadReservations').filter(o=>o.id!==r.id && o.user_id===u.id && o.expires_at>now() && ['reserved','receiving'].includes(o.status)).reduce((n,o)=>n+Math.max(0,o.total-o.replaced_bytes),0);
        quotaCheck(u.quota_bytes,used(u),replacement,otherReserved,r.total);
        let result;
        if(r.kind==='submission') {
          const a=getAssignment(r.assignment_id); const old=submission(a.id,u.id);
          assert((old?.generation || null)===r.base_generation,'Работа уже изменена','CONFLICT');
          const late=checkSubmit(u,a,old,r.started_at);
          const id=old?.id || uuid();
          // Prepare file rows first; switching the submission generation is the commit point.
          for(const fileId of r.file_ids) repo.put(fileTable,{id:fileId,submission_id:id});
          const s=repo.put('Submissions',{id,assignment_id:a.id,student_id:u.id,status:'pending_review',
            started_at:r.started_at,submitted_at:now(),is_late:late,generation:r.generation,attempts:(old?.attempts || 0)+1,
            grade:null,feedback:'',reviewer_id:null,reviewed_at:null,group_at_submission:u.group_id,subgroup_at_submission:u.subgroup,files_deleted:false});
          result={submission_id:s.id,generation:s.generation,status:s.status,submitted_at:s.submitted_at,is_late:s.is_late};
          audit(u,'submission_saved',s.id,{generation:s.generation,previous_grade:old?.grade ?? null,attempt:s.attempts});
        } else if(r.kind==='materials') {
          const a=getAssignment(r.assignment_id); requireTeacher(u,a);
          assert(u.role==='admin' || teacherScope(u,a.targets,repo.all('TeacherAccess')));
          assert((a.material_generation || null)===r.base_generation && a.version===r.base_version,'Задание изменилось. Повторите загрузку','CONFLICT');
          repo.put('Assignments',{...a,material_generation:r.generation,version:a.version+1,updated_at:now()});
          audit(u,'materials_saved',a.id,{generation:r.generation}); result={saved:true};
        } else { requireAdmin(u); result={files:r.file_ids.map(id=>publicFile(repo.get(fileTable,id)))}; audit(u,'spike_upload',r.id,{total:r.total}); }
        repo.put('UploadReservations',{...r,status:'committed',result});
        return result;
      });
    } catch(error) {
      repo.lock(()=>{
        const current=repo.get('UploadReservations',r.id);
        // A lost final response must never delete a generation already committed.
        const recovered=recoverCommitted(current);
        repo.put('UploadReservations',{...current,status:recovered?'committed':'failed',result:recovered,error:recovered?null:(error.code || 'INTERNAL')});
        if(!recovered) for(const id of r.file_ids) if(repo.get(tableFor(r),id)) repo.put(tableFor(r),{id,deleted_at:now(),delete_pending:true});
      });
      throw error;
    }
  }
  function markDeleted(u,files,reason) {
    for(const f of files) repo.put(f.table,{...f,deleted_at:now(),delete_pending:true});
    audit(u,reason,files[0]?.submission_id || files[0]?.assignment_id,{count:files.length});
    return {deleted:files.length,cleanup_pending:true};
  }
  function mutate(u,action,p) {
    switch(action) {
      case 'logout': {
        const session=repo.all('Sessions').find(s=>s.token_hash===digest(p.token));
        if(session) repo.put('Sessions',{...session,revoked_at:now()});
        audit(u,'logout',u.id); return {ok:true};
      }
      case 'changePassword': {
        assert(typeof p.current_password==='string','Введите текущий пароль','VALIDATION');
        const check=passwordRecord(p.current_password,u.salt,u.iterations).password_hash;
        assert(safeEqual(check,u.password_hash),'Текущий пароль неверен','VALIDATION');
        const next=passwordRecord(p.new_password,auth.random());
        const changed=repo.put('Users',{...u,...next,must_change_password:false}); auth.revoke(u.id);
        audit(u,'password_changed',u.id); return auth.session(changed);
      }
      case 'saveAssignment': {
        assert(['teacher','admin'].includes(u.role));
        const old=p.id?getAssignment(p.id):null; if(old) requireTeacher(u,old);
        assert(!old || p.version===old.version,'Задание изменилось. Обновите страницу','CONFLICT');
        const targets=p.targets;
        assert(Array.isArray(targets) && targets.length>0 && targets.length<=100,'Выберите аудиторию','VALIDATION');
        for(const target of targets) assert(repo.get('Groups',target.group_id)?.active && [0,1,2].includes(Number(target.subgroup)), 'Некорректная аудитория','VALIDATION');
        assert(u.role==='admin' || teacherScope(u,targets,repo.all('TeacherAccess')));
        const publication=p.publication_status || 'draft'; assert(['draft','published','archived'].includes(publication),'Неверный статус','VALIDATION');
        assert(['close','allow'].includes(p.late_policy),'Неверная политика сроков','VALIDATION');
        const due=p.due_at || null; assert(!due || Number.isFinite(Date.parse(due)),'Неверный срок','VALIDATION');
        const title=text(p.title,200);assert(title.length>0,'Введите название','VALIDATION');
        const a=repo.put('Assignments',{id:old?.id || uuid(),teacher_id:old?.teacher_id || u.id,title,description:text(p.description || '',2000),
          instructions:text(p.instructions || '',20000),targets:targets.map(t=>({group_id:t.group_id,subgroup:Number(t.subgroup)})),due_at:due,
          late_policy:p.late_policy,publication_status:publication,material_generation:old?.material_generation || null,version:(old?.version || 0)+1,created_at:old?.created_at || now(),updated_at:now()});
        audit(u,old?'assignment_updated':'assignment_created',a.id,{before:old?{targets:old.targets,status:old.publication_status,due_at:old.due_at}:null,after:{targets:a.targets,status:a.publication_status,due_at:a.due_at}});
        return a;
      }
      case 'review': {
        const s=repo.get('Submissions',p.submission_id); assert(s,'Сдача не найдена','NOT_FOUND');
        const a=getAssignment(s.assignment_id),student=repo.get('Users',s.student_id);
        assert(u.role==='admin' || canTeach(u,a,student,repo.all('TeacherAccess')));
        assert(s.generation===p.generation,'Студент уже загрузил новую версию. Обновите страницу','CONFLICT');
        assert(['accepted','needs_revision'].includes(p.status),'Неверное решение','VALIDATION');
        const grade=p.grade===null || p.grade==='' || p.grade===undefined?null:Number(p.grade);
        assert(grade===null || [2,3,4,5].includes(grade),'Оценка должна быть от 2 до 5','VALIDATION');
        const next=repo.put('Submissions',{...s,status:p.status,grade:p.status==='needs_revision'?null:grade,feedback:text(p.feedback || '',4000),reviewer_id:u.id,reviewed_at:now()});
        audit(u,'submission_reviewed',s.id,{previous_grade:s.grade,previous_status:s.status,grade:next.grade,status:next.status,feedback:next.feedback}); return next;
      }
      case 'beginUpload': return reserve(u,p);
      case 'deleteSubmissionFiles': {
        assert(p.confirm===true,'Подтвердите удаление','VALIDATION');
        const s=repo.get('Submissions',p.submission_id); assert(s,'Сдача не найдена','NOT_FOUND');
        assert(u.role==='admin' || (u.role==='student' && s.student_id===u.id && studentAccess(u,getAssignment(s.assignment_id),s,'own')));
        const files=currentFiles().filter(f=>f.submission_id===s.id);
        const result=markDeleted(u,files,'submission_files_deleted'); repo.put('Submissions',{...s,files_deleted:true}); return result;
      }
      case 'deleteMaterial': {
        assert(p.confirm===true,'Подтвердите удаление','VALIDATION');
        const f=allFiles().find(f=>f.id===p.file_id && f.table==='Materials'); assert(f,'Файл не найден','NOT_FOUND');
        const a=getAssignment(f.assignment_id);requireTeacher(u,a);
        assert(u.role==='admin' || teacherScope(u,a.targets,repo.all('TeacherAccess')));
        return markDeleted(u,[f],'material_deleted');
      }
      case 'createUser': {
        requireAdmin(u); const password=auth.random().slice(0,20); const created=auth.createUser(p,password);
        audit(u,'user_created',created.id,{role:created.role}); return {user:publicUser(created),temporary_password:password};
      }
      case 'importUsers': {
        requireAdmin(u);repo.normalizeIntake?.();
        const results=[];
        for(const row of repo.all('UserIntake').filter(r=>r.status!=='done').slice(0,10)) {
          try {
            const group=repo.all('Groups').find(g=>g.id===row.group_id || g.name===row.group_id);
            const password=auth.random().slice(0,20),created=auth.createUser({...row,group_id:group?.id || row.group_id},password);
            repo.put('UserIntake',{...row,status:'done',error:null});
            audit(u,'user_imported',created.id);results.push({login:created.login,temporary_password:password});
          }catch(e){repo.put('UserIntake',{...row,status:'error',error:e.code?e.message:'Ошибка импорта'});}
        }
        return {results};
      }
      case 'updateUser': {
        requireAdmin(u); const target=repo.get('Users',p.id); assert(target,'Пользователь не найден','NOT_FOUND');
        assert(['active','blocked'].includes(p.status),'Неверный статус','VALIDATION');
        assert(target.id!==u.id || p.status==='active','Нельзя заблокировать себя','VALIDATION');
        const quota=Number(p.quota_bytes); assert(Number.isSafeInteger(quota) && quota>=0 && quota<=15*1024*MiB,'Некорректная квота','VALIDATION');
        if(target.role==='student') assert(repo.get('Groups',p.group_id)?.active && [1,2].includes(Number(p.subgroup)),'Выберите группу и подгруппу','VALIDATION');
        const updated=repo.put('Users',{...target,status:p.status,quota_bytes:quota,group_id:target.role==='student'?p.group_id:null,subgroup:target.role==='student'?Number(p.subgroup):null});
        if(p.status==='blocked') auth.revoke(target.id); audit(u,'user_updated',target.id,{before:publicUser(target),after:publicUser(updated)}); return publicUser(updated);
      }
      case 'resetPassword': {
        requireAdmin(u); const target=repo.get('Users',p.id); assert(target,'Пользователь не найден','NOT_FOUND');
        const password=auth.random().slice(0,20);
        repo.put('Users',{...target,...passwordRecord(password,auth.random()),must_change_password:true}); auth.revoke(target.id);
        audit(u,'password_reset',target.id); return {temporary_password:password};
      }
      case 'revokeSessions': requireAdmin(u); auth.revoke(p.id); audit(u,'sessions_revoked',p.id); return {ok:true};
      case 'saveGroup': {
        requireAdmin(u); const group={id:p.id || uuid(),name:text(p.name,80),active:p.active!==false};
        assert(group.name.length>0,'Введите название','VALIDATION');
        assert(!repo.all('Groups').some(g=>g.id!==group.id && g.name.toLocaleLowerCase('ru')===group.name.toLocaleLowerCase('ru')),'Название группы уже используется','VALIDATION');
        repo.put('Groups',group); audit(u,'group_saved',group.id); return group;
      }
      case 'saveTeacherAccess': {
        requireAdmin(u); assert(repo.get('Users',p.teacher_id)?.role==='teacher','Выберите преподавателя','VALIDATION');
        assert(Array.isArray(p.targets),'Некорректная аудитория','VALIDATION');
        for(const t of p.targets) assert(repo.get('Groups',t.group_id)?.active && [0,1,2].includes(Number(t.subgroup)),'Некорректная аудитория','VALIDATION');
        for(const access of repo.all('TeacherAccess').filter(a=>a.teacher_id===p.teacher_id)) repo.put('TeacherAccess',{...access,active:false});
        for(const t of p.targets) repo.put('TeacherAccess',{id:uuid(),teacher_id:p.teacher_id,group_id:t.group_id,subgroup:Number(t.subgroup),active:true});
        audit(u,'teacher_access_changed',p.teacher_id,{targets:p.targets}); return {ok:true};
      }
      default: fail('Неизвестное действие','NOT_FOUND');
    }
  }
  function api(request) {
    try {
      assert(request && typeof request==='object','Некорректный запрос','VALIDATION');
      requireAvailable();
      const {action,token,payload={}}=request;
      if(action==='login') return {ok:true,data:auth.signIn(payload.login,payload.password)};
      const u=auth.actor(token,['changePassword','logout','bootstrap'].includes(action));
      if(action==='bootstrap') return {ok:true,data:{user:publicUser(u),groups:repo.all('Groups').filter(g=>g.active),
        access:u.role==='student'?[]:repo.all('TeacherAccess').filter(a=>a.active && (u.role==='admin' || a.teacher_id===u.id)),
        quota:{used:used(u),limit:u.quota_bytes},uploads_enabled:settings.uploadsEnabled,transport_verified:settings.uploadsEnabled,file_limit:settings.fileLimit || LIMIT,release:settings.release}};
      if(action==='listAssignments') return {ok:true,data:visibleAssignments(u)};
      if(action==='reviewRows') return {ok:true,data:reviewRows(u,getAssignment(payload.assignment_id))};
      if(action==='uploadStatus') {
        const r=repo.get('UploadReservations',payload.id); assert(r && r.user_id===u.id);
        const recovered=recoverCommitted(r);
        return {ok:true,data:{id:r.id,status:recovered?'committed':r.status,result:recovered || r.result}};
      }
      if(action==='downloadChunk') {
        const f=allFiles().find(f=>f.id===payload.file_id); checkFileAccess(u,f);
        const offset=Number(payload.offset); assert(Number.isSafeInteger(offset) && offset>=0 && offset<f.size,'Неверный диапазон','VALIDATION');
        const size=Math.min(256*1024,f.size-offset);
        const data=storage.chunk(f.drive_id,offset,size);
        if(offset===0) repo.lock(()=>audit(u,'file_download',f.id));
        return {ok:true,data:{data,offset,size,total:f.size,name:f.name,type:f.type}};
      }
      if(action==='adminData') {
        requireAdmin(u);
        const files=allFiles();
        return {ok:true,data:{users:repo.all('Users').map(s=>({...publicUser(s),used:used(s)})),groups:repo.all('Groups'),
          access:repo.all('TeacherAccess').filter(a=>a.active),audit:repo.all('Audit').slice(-300).reverse(),
          storage:{current:currentFiles().reduce((n,f)=>n+f.size,0),physical:files.filter(f=>f.drive_id && (!f.deleted_at || f.delete_pending)).reduce((n,f)=>n+f.size,0),
            pending:files.filter(f=>f.delete_pending).length},
          operations:repo.all('UploadReservations').slice(-30).map(({id,status,kind,started_at,total,error})=>({id,status,kind,started_at,total,error}))}};
      }
      if(action==='backupStatus') {requireAdmin(u);assert(backups,'Обновите Apps Script для резервирования','CONFIG');return {ok:true,data:backups.status()};}
      if(action==='createBackup') {requireAdmin(u);assert(backups,'Обновите Apps Script для резервирования','CONFIG');return {ok:true,data:backups.create()};}
      if(action==='storageHealth') {requireAdmin(u); return {ok:true,data:storage.check()};}
      if(action==='runCleanup') {requireAdmin(u);return {ok:true,data:housekeeping()};}
      // Recheck session after taking the lock: blocking/revocation must beat queued calls.
      return {ok:true,data:repo.lock(()=>{requireAvailable();return mutate(auth.actor(token,['changePassword','logout'].includes(action)),action,{...payload,...(action==='logout'?{token}:{})});})};
    } catch(error) {
      return {ok:false,error:{code:error.code || 'INTERNAL',message:error.code?error.message:'Ошибка сервера. Повторите действие или обратитесь к администратору'}};
    }
  }
  function housekeeping() {
    requireAvailable();
    const results={deleted:0,pending:0};
    repo.lock(()=>{
      requireAvailable();
      for(const r of repo.all('UploadReservations').filter(r=>['reserved','receiving'].includes(r.status) && Date.parse(r.expires_at)+600000<Date.parse(now()))) {
        const recovered=recoverCommitted(r);
        repo.put('UploadReservations',{...r,status:recovered?'committed':'expired',result:recovered || null});
      }
      for(const f of allFiles().filter(f=>!f.deleted_at)) {
        const reservation=repo.all('UploadReservations').find(r=>r.generation===f.generation);
        const abandoned=!isCurrent(f) && (!reservation || ['committed','failed','expired'].includes(reservation.status));
        if(expired(f,now()) || abandoned) {
          repo.put(f.table,{...f,deleted_at:now(),delete_pending:true});
          audit(null,expired(f,now())?'file_expired':'old_generation_cleanup',f.id);
        }
      }
    });
    // Network I/O outside the global lock. Only physical deletion is retried.
    for(const file of allFiles().filter(f=>f.delete_pending).slice(0,50)) {
      try {
        if(file.drive_id) storage.remove(file.drive_id);
        else if(storage.findByLogicalId)for(const orphan of storage.findByLogicalId(file.id))storage.remove(orphan.id);
        repo.lock(()=>repo.put(file.table,{id:file.id,delete_pending:false}));results.deleted++;
      }
      catch {results.pending++;}
    }
    return results;
  }
  return {api,upload,housekeeping};
}

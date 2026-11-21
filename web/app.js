import { RemoteApi, downloadFile } from './api.js';
import { DemoApi } from './demo.js';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  book:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3V4Z',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  check:'m5 12 4 4L19 6', file:'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8M8 16h6',
  review:'M9 5H5v16h14V5h-4M9 3h6v4H9zM8 13l2 2 5-5',
  clock:'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  refresh:'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3',
  users:'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M19 8a4 4 0 0 1 0 8M23 21v-2a4 4 0 0 0-3-3M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  user:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 9l-1 3 1 3h3l2 4 3 2 3-2 2-4h3l1-3-1-3h-3l-2-4-3-2-3 2-2 4H4Z',
  logout:'M9 4H3v16h6M14 8l5 4-5 4M8 12h11',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  calendar:'M4 5h16v16H4zM8 2v6M16 2v6M4 10h16',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',plus:'M12 5v14M5 12h14',close:'m6 6 12 12M6 18 18 6',
  moon:'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z',sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  info:'M12 11v6m0-10v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5',folder:'M3 6h6l2 3h10v12H3V6Z',back:'m14 5-7 7 7 7',
  mail:'M3 5h18v14H3zM3 5l9 7 9-7',bolt:'m14 2-9 12h7l-2 8 9-12h-7l2-8',chart:'M4 20V10m8 10V4m8 16v-7',
};
const icon=(name,size=19)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
const MiB=1024*1024;
const size=value=>value>=MiB?`${(value/MiB).toLocaleString('ru-RU',{maximumFractionDigits:1})} МиБ`:value>=1024?`${Math.ceil(value/1024)} КБ`:`${value} Б`;
const date=value=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Irkutsk',day:'numeric',month:'short',year:'numeric'}).format(new Date(value)):'Без срока';
const time=value=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Irkutsk',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'';
const roles={student:'Студент',teacher:'Преподаватель',admin:'Администратор'};
const statuses={not_submitted:['Не сдано','','file'],pending_review:['На проверке','blue','clock'],needs_revision:['На доработке','orange','refresh'],accepted:['Принято','green','check']};
const badge=status=>{const s=statuses[status]||statuses.not_submitted;return `<span class="badge ${s[1]}">${icon(s[2],13)}${s[0]}</span>`;};
const pubBadge=a=>a.publication_status==='draft'?'<span class="badge">Черновик</span>':a.publication_status==='archived'?'<span class="badge">Архив</span>':'<span class="badge green">Опубликовано</span>';
const brand=()=>`<div class="brand"><span class="brand-mark">${icon('book',23)}</span><span class="brand-name">practicus<span style="display:none"></span></span></div>`;
const btn=(action,label,kind='',extra='')=>`<button class="btn ${kind}" data-action="${action}" ${extra}>${label}</button>`;
const empty=(title,description='',action='')=>`<div class="empty"><div class="empty-icon">${icon('folder',26)}</div><h3>${title}</h3><p>${description}</p>${action}</div>`;
const stat=(label,number,hint,i,color='')=>`<div class="stat"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${color}">${icon(i,17)}</span></div><div class="stat-number">${esc(number)}</div><div class="stat-bottom">${hint}</div></div>`;
const field=(label,name,value='',type='text',extra='')=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const search=placeholder=>`<div class="search">${icon('search',17)}<input id="search" type="search" aria-label="Поиск" placeholder="${placeholder}" value="${esc(state.query)}"></div>`;
const option=(v,label,current)=>`<option value="${esc(v)}" ${String(v)===String(current)?'selected':''}>${esc(label)}</option>`;
const groupName=id=>state.boot?.groups.find(g=>g.id===id)?.name || '—';
const groupList=a=>a.targets.map(t=>`${groupName(t.group_id)}${t.subgroup?' · '+t.subgroup+' подгр.':''}`).join(', ');
const initials=name=>name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('');
const actionNames={login:'Вход в приложение',login_failed:'Ошибка входа',logout:'Выход',assignment_created:'Создано задание',assignment_updated:'Изменено задание',assignment_saved:'Сохранено задание',submission_saved:'Сдана работа',submission_reviewed:'Проверена работа',file_download:'Скачан файл',user_created:'Создан пользователь',user_updated:'Изменён пользователь',password_reset:'Сброшен пароль',password_changed:'Изменён пароль',sessions_revoked:'Отозваны сессии',teacher_access_changed:'Изменён доступ преподавателя',group_saved:'Сохранена группа',submission_files_deleted:'Удалены файлы сдачи',file_expired:'Истёк срок хранения',old_generation_cleanup:'Удалена старая версия',materials_saved:'Обновлены материалы',upload_reserved:'Начата загрузка',spike_upload:'Тестовая загрузка'};
const state={api:null,boot:null,assignments:[],admin:null,route:'assignments',query:'',filter:'all',sort:'due',group:'all',subgroup:'all',activeId:null,rows:[],selectedFiles:[],pendingOp:null,uploading:false};
const demo=new DemoApi();
const uploadsEnabled=()=>state.boot?.uploads_enabled??state.boot?.transport_verified;
function backupInfo(){
 const b=state.backup;if(!b)return `<div class="notice orange">${esc(state.backupError||'Обновите Apps Script и запустите runInitialSetup, чтобы включить резервирование.')}</div>`;
 const stale=!b.last_success_at||Date.now()-Date.parse(b.last_success_at)>48*3600000;
 return `<div class="notice ${stale?'orange':'blue'}">${b.last_success_at?'Последняя копия: '+date(b.last_success_at)+' в '+time(b.last_success_at):'Резервных копий пока нет.'}${b.last_success_at?'<br>Размер: '+size(b.last_size)+' · сохранено '+b.retained+' из '+b.keep:''}${stale?'<br>Нужно создать свежую копию.':''}${b.cleanup_pending?'<br>Ожидают очистки старые копии: '+b.cleanup_pending:''}${b.last_error?'<br>Последняя ошибка: '+esc(b.last_error):''}</div>`;
}
let toastTimeout;
try{document.documentElement.dataset.theme=localStorage.getItem('practicus-theme')||'light';}catch{}
function toast(message,persistent=false){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimeout);if(!persistent)toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
function themeButton(){return `<button class="icon-btn" data-action="theme" title="Сменить тему" aria-label="Сменить тему">${icon(document.documentElement.dataset.theme==='dark'?'sun':'moon',18)}</button>`;}
function loginPage(){
  state.boot=null;
  $('#app').innerHTML=`<div class="login-page"><section class="login-story">${brand()}<div class="brand-sub">Практические работы</div><div class="story-content"><div class="story-kicker">Учиться. Практиковаться. Достигать.</div><h1>От задания<br>к результату.</h1><p>Практические работы, материалы и обратная связь преподавателя — в одном месте.</p><div class="story-mini"><div class="story-mini-icon">${icon('check',24)}</div><div><strong>Всё готово к следующему шагу</strong><p>Сдавайте работы и следите за результатами</p></div></div></div><div class="story-footer">Рабочее пространство студентов и преподавателей</div><div class="story-deco"></div></section><section class="login-main"><div class="login-tools">${themeButton()}</div><div class="login-box"><div class="login-title"><div class="eyebrow">ВАШЕ УЧЕБНОЕ ПРОСТРАНСТВО</div><h1>С возвращением</h1><p>Войдите, чтобы продолжить работу</p></div><form id="login-form" class="login-form">${field('Логин','login','','text','required autocomplete="username" placeholder="Введите логин" maxlength="100"')}${field('Пароль','password','','password','required autocomplete="current-password" placeholder="Введите пароль" maxlength="128"')}<div id="login-error" class="error-text" role="alert"></div><button class="btn primary full" type="submit" ${window.PRACTICUS_CONFIG.apiUrl?'':'disabled'}>Войти в приложение</button></form>${window.PRACTICUS_CONFIG.apiUrl?'<p class="login-info">Забыли пароль? Обратитесь к администратору.</p>':'<div class="notice blue small">Подключение к Google ещё не настроено. Пока можно познакомиться с приложением в демонстрационном режиме.</div>'}</div><div class="login-foot">Practicus · Система сдачи практических работ</div></section></div>`;
}
async function refresh(){
  const boot=await state.api.call('bootstrap');state.boot=boot;
  if(boot.user.must_change_password){state.assignments=[];state.admin=null;render();passwordModal(true);return;}
  const [assignments,admin]=await Promise.all([state.api.call('listAssignments'),boot.user.role==='admin'?state.api.call('adminData'):Promise.resolve(null)]);
  state.assignments=assignments;state.admin=admin;
  render();
}
async function enterDemo(role){state.api?.destroy();state.api=demo;const result=demo.enter(role);state.boot={user:result.user};resetRoute(role);closeModal();await refresh();}
function resetRoute(role){Object.assign(state,{route:role==='admin'?'overview':'assignments',query:'',filter:'all',group:'all',activeId:null,selectedFiles:[],pendingOp:null});}
const navs={student:[['assignments','book','Мои практические'],['profile','user','Профиль']],teacher:[['assignments','book','Практические'],['review','review','Проверка работ'],['profile','user','Профиль']],admin:[['overview','grid','Обзор'],['users','users','Пользователи'],['groups','folder','Группы'],['access','shield','Доступ преподавателей'],['assignments','book','Практические и сдачи'],['audit','clock','Журнал'],['settings','settings','Настройки']]};
function render(){
  if(!state.boot)return loginPage();
  const u=state.boot.user;const nav=navs[u.role];const active=state.route==='detail'?'assignments':state.route;
  const label=nav.find(n=>n[0]===active)?.[2]||'Профиль';
  $('#app').innerHTML=`<aside class="sidebar">${brand()}<div class="brand-sub">Практические работы</div><div class="nav-label">Рабочее пространство</div><nav class="nav" aria-label="Главная навигация">${nav.map(([route,i,title])=>`<button class="nav-link ${active===route?'active':''}" data-action="nav" data-route="${route}" title="${title}" ${active===route?'aria-current="page"':''}>${icon(i)}<span class="nav-text">${title}</span>${route==='review'&&state.assignments.reduce((n,a)=>n+(a.stats?.pending||0),0)?`<span class="nav-count">${state.assignments.reduce((n,a)=>n+(a.stats?.pending||0),0)}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="storage-mini"><div class="row between small">${icon('folder',16)}<span>Моё хранилище</span></div><div class="meter"><span style="width:${Math.min(100,state.boot.quota.used/state.boot.quota.limit*100)||0}%"></span></div><div class="small muted">${size(state.boot.quota.used)} из ${size(state.boot.quota.limit)}</div></div><nav class="nav"><button class="nav-link" data-action="logout" title="Выйти">${icon('logout')}<span class="nav-text">Выйти</span></button></nav><div class="sidebar-foot">Practicus · ${esc(state.boot.release?.version||'0.1.0')}</div></div></aside><div class="layout"><header class="topbar"><div class="breadcrumb"><span>Рабочее пространство</span><span>/</span><b>${label}</b></div><div class="mobile-brand brand"><span class="brand-mark">${icon('book',19)}</span>practicus</div><div class="row">${themeButton()}<div class="top-divider"></div><button class="text-btn account" data-action="nav" data-route="profile" aria-label="Открыть профиль"><div><div class="account-name">${esc(u.full_name)}</div><div class="account-role">${roles[u.role]}${u.role==='student'?' · '+esc(groupName(u.group_id)):''}</div></div><span class="avatar">${esc(initials(u.full_name))}</span></button></div></header>${state.api.demo?`<div class="demo-banner"><div class="row">${icon('info',15)}<strong>Демонстрационный режим</strong><span class="demo-description">· Данные вымышлены, изменения не сохраняются</span></div><div class="row"><label for="demo-role">Кабинет:</label><select id="demo-role">${Object.entries(roles).map(([v,l])=>option(v,l,u.role)).join('')}</select></div></div>`:''}<main class="main" id="main">${page()}</main></div>`;
}
function head(title,description,actions=''){return `<div class="page-head"><div><h1>${esc(title)}</h1>${description?`<p>${description}</p>`:''}</div>${actions?`<div class="row">${actions}</div>`:''}</div>`;}
function page(){switch(state.route){case 'overview':return overviewPage();case 'assignments':return assignmentsPage();case 'detail':return detailPage();case 'review':return reviewPage();case 'users':return usersPage();case 'groups':return groupsPage();case 'access':return accessPage();case 'audit':return auditPage();case 'settings':return settingsPage();case 'profile':return profilePage();default:return '';}}
function assignmentsPage(){
  const student=state.boot.user.role==='student',all=state.assignments;
  const tally=status=>all.filter(a=>(a.submission?.status||'not_submitted')===status && a.publication_status!=='archived').length;
  const total=all.filter(a=>a.publication_status!=='archived').length;
  let html=head(student?'Мои практические':'Практические работы',student?'Все задания, материалы и результаты — здесь.':'Создавайте задания и следите за результатами групп.',student?'':btn('new-assignment',icon('plus',17)+'Создать задание','primary'));
  html+=`<div class="stats">${student?stat('Всего работ',total,'Назначено вашей группе','book')+stat('Ожидают сдачи',tally('not_submitted'),'Можно приступить к работе','file','orange')+stat('На проверке',tally('pending_review'),'Ожидают решения преподавателя','clock')+stat('Принято',tally('accepted'),'Работы завершены','check','green'):stat('Всего заданий',all.length,'Включая черновики и архив','book')+stat('На проверке',all.reduce((n,a)=>n+(a.stats?.pending||0),0),'Работы ждут вашего решения','review','orange')+stat('Принято',all.reduce((n,a)=>n+(a.stats?.accepted||0),0),'Проверенные работы','check','green')+stat('Опубликовано',all.filter(a=>a.publication_status==='published').length,'Доступно студентам','file') }</div>`;
  const filters=student?[['all','Все'],['not_submitted','Не сдано'],['pending_review','На проверке'],['needs_revision','На доработке'],['accepted','Принято'],['late','Просрочено'],['archived','Архив']]:[['all','Все'],['published','Опубликованные'],['draft','Черновики'],['archived','Архив']];
  html+=`<div class="toolbar"><div class="tabs" aria-label="Фильтр заданий">${filters.map(([value,label])=>`<button class="tab ${state.filter===value?'active':''}" data-action="filter" data-value="${value}" aria-pressed="${state.filter===value}">${label}${value==='all'?`<span>${all.length}</span>`:''}</button>`).join('')}</div>${search('Найти практическую…')}</div><div class="panel"><div class="panel-header"><div><h2>Список практических</h2><p>${student?esc(groupName(state.boot.user.group_id))+' · '+state.boot.user.subgroup+' подгруппа':'Ваши задания и учебные группы'}</p></div><select id="sort" aria-label="Сортировка" style="width:auto;max-width:200px">${option('due','По сроку сдачи',state.sort)+option('new','Сначала новые',state.sort)+option('title','По названию',state.sort)}</select></div>${assignmentTable(filteredAssignments(),student)}<div class="table-footer"><span>Показано ${filteredAssignments().length} из ${all.length} работ</span><span>Время указано по Иркутску · UTC+8</span></div></div><div class="footer-note">${icon('info',15)}${student?'Повторная сдача заменяет предыдущий комплект файлов целиком.':'Материалы задания и ответы студентов доступны только после проверки прав.'}</div>`;
  return html;
}
function filteredAssignments(){
  const student=state.boot.user.role==='student';
  let list=state.assignments.filter(a=>{
    if(state.query&&!`${a.title} ${a.description} ${a.teacher_name}`.toLowerCase().includes(state.query.toLowerCase()))return false;
    if(state.filter==='all')return true;
    if(!student)return a.publication_status===state.filter;
    if(state.filter==='archived')return a.publication_status==='archived';
    if(a.publication_status==='archived')return false;
    if(state.filter==='late')return a.submission?.is_late||(!a.submission&&a.due_at&&Date.parse(a.due_at)<Date.now());
    return (a.submission?.status||'not_submitted')===state.filter;
  });
  return list.sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title,'ru'):state.sort==='new'?(b.created_at||'').localeCompare(a.created_at||''):(a.due_at||'9999').localeCompare(b.due_at||'9999'));
}
function assignmentTable(list,student){
  if(!list.length)return empty('Работ пока нет',state.query||state.filter!=='all'?'Попробуйте изменить поиск или фильтры.':student?'Опубликованные задания вашей группы появятся здесь.':'Создайте первую практическую работу.',student?'':btn('new-assignment','Создать задание','primary'));
  return `<div class="table-scroll"><table><thead><tr><th>Практическая работа</th>${student?'':'<th>Группы</th>'}<th>Срок сдачи</th><th>${student?'Статус':'Сдали'}</th><th>${student?'Оценка':'Публикация'}</th><th></th></tr></thead><tbody>${list.map(a=>{
    const overdue=a.due_at&&Date.parse(a.due_at)<Date.now()&&!a.submission;
    return `<tr><td><div class="task-title"><div class="task-icon">${icon('file',21)}</div><div><button class="text-btn task-name" data-action="open-assignment" data-id="${a.id}">${esc(a.title)}</button><div class="task-subtitle">${esc(a.description|| (a.publication_status==='archived'?'Архивная работа':'Практическая работа'))}</div></div></div></td>${student?'':`<td><span class="small">${esc(groupList(a))}</span></td>`}<td><div class="date">${student&&a.publication_status==='archived'?'—':date(a.due_at)}</div><div class="date-hint ${overdue?'overdue':''}">${student&&a.publication_status==='archived'?'Только оценка':a.due_at?(overdue?'Срок истёк':`до ${time(a.due_at)}`):'Приём до архивирования'}</div></td><td>${student?(a.publication_status==='archived'?'<span class="badge">Архив</span>':badge(a.submission?.status||'not_submitted')):`<span class="strong">${a.stats?.submitted||0}</span><span class="muted"> / ${a.stats?.total||0}</span>`}</td><td>${student?(a.submission?.grade?`<span class="grade">${a.submission.grade}</span>`:'<span class="muted">—</span>'):pubBadge(a)}</td><td>${student?btn('open-assignment','Открыть','compact',`data-id="${a.id}"`):`<div class="row gap8">${btn('review-assignment','Проверить','compact',`data-id="${a.id}"`)}<button class="icon-btn" data-action="edit-assignment" data-id="${a.id}" aria-label="Изменить задание">${icon('edit',16)}</button></div>`}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function renderFile(file,removeAction=''){return `<div class="file-row"><div class="file-info"><span class="file-symbol">${icon('file',18)}</span><div><div class="file-name">${esc(file.name)}</div><div class="file-size">${size(file.size)}</div></div></div><div class="row gap8"><button class="icon-btn" data-action="download" data-id="${file.id}" aria-label="Скачать ${esc(file.name)}" title="Скачать">${icon('download',17)}</button>${removeAction?`<button class="icon-btn" data-action="${removeAction}" data-id="${file.id}" aria-label="Удалить файл">${icon('trash',16)}</button>`:''}</div></div>`;}
function uploadZone(){return `<label class="upload-zone" data-drop="files">${icon('upload',27)}<strong>Перетащите файлы сюда</strong><p>или нажмите, чтобы выбрать<br>До 25 файлов · суммарно до ${size(state.boot.file_limit)}</p><input id="upload-files" type="file" multiple aria-label="Выберите файлы" accept=".pdf,.docx,.xlsx,.pptx,.txt,.zip,.jpg,.jpeg,.png"></label><p class="muted" style="font-size:.7rem">PDF, DOCX, XLSX, PPTX, TXT, ZIP, JPG, PNG</p><div id="selected-files">${selectedFilesHtml()}</div>`;}
function selectedFilesHtml(){return state.selectedFiles.map((f,i)=>`<div class="file-row"><div><div class="file-name">${esc(f.name)}</div><div class="file-size">${size(f.size)}</div></div><button class="icon-btn" data-action="remove-selected" data-index="${i}" aria-label="Убрать ${esc(f.name)}">${icon('close',15)}</button></div>`).join('')+(state.selectedFiles.length?`<div class="row between small" style="margin:12px 0"><span>${state.selectedFiles.length} файлов</span><strong>${size(state.selectedFiles.reduce((n,f)=>n+f.size,0))}</strong></div>`:'');}
function detailPage(){
  const a=state.assignments.find(a=>a.id===state.activeId);if(!a)return empty('Задание недоступно','Возможно, преподаватель изменил его публикацию.');
  const student=state.boot.user.role==='student',s=a.submission;
  let html=`<div style="margin-bottom:20px">${btn('nav',icon('back',15)+'Все практические','ghost compact','data-route="assignments"')}</div>`;
  html+=head(a.title,a.description,!student?btn('edit-assignment',icon('edit',16)+'Изменить','',`data-id="${a.id}"`):'');
  if(student&&a.publication_status==='archived')return html+`<div class="panel panel-pad"><div class="row between"><div><h2>Архивная работа</h2><p class="muted small" style="margin-top:6px">В архиве доступна только оценка.</p></div><span class="grade-large">${s?.grade||'—'}</span></div></div>`;
  html+=`<div class="detail-grid"><div class="stack"><section class="panel panel-pad"><h2>О практической</h2><div class="details-meta"><span class="row">${icon('calendar',16)}${date(a.due_at)} ${time(a.due_at)}</span><span class="row">${icon('user',16)}${esc(a.teacher_name||'Преподаватель')}</span></div>${a.instructions?`<div class="instruction">${esc(a.instructions)}</div>`:'<div class="notice" style="margin-top:18px">Материалы и инструкции этого задания вам недоступны.</div>'}</section>${a.materials?.length||!student?`<section class="panel"><div class="panel-header"><h2>Материалы задания</h2>${!student?btn('upload-materials',icon('upload',16)+'Загрузить','compact',`data-id="${a.id}"`):''}</div><div class="panel-pad" style="padding-top:8px;padding-bottom:8px">${a.materials?.length?a.materials.map(f=>renderFile(f,!student?'delete-material':'')).join(''):'<p class="muted small" style="padding:18px 0">Материалы ещё не добавлены.</p>'}</div></section>`:''}${student&&s?`<section class="panel panel-pad"><div class="submission-summary"><h2>Ваша сдача</h2>${badge(s.status)}</div><p class="small muted">${date(s.submitted_at)} в ${time(s.submitted_at)} · ${s.is_late?'С опозданием':'В срок'}</p>${s.files?.map(f=>renderFile(f)).join('')}${s.files_deleted?'<div class="notice orange" style="margin-top:15px">Файлы этой сдачи удалены. Выставленная оценка сохранена.</div>':''}${s.feedback?`<div style="margin-top:22px"><div class="small strong" style="margin-bottom:10px">Комментарий преподавателя</div><div class="feedback">${esc(s.feedback)}</div></div>`:''}${s.grade?`<div class="row between" style="margin-top:20px"><span class="small">Оценка за работу</span><span class="grade-large">${s.grade}</span></div>`:''}${s.files?.length?`<div style="margin-top:20px">${btn('delete-submission',icon('trash',15)+'Удалить файлы','ghost compact',`data-id="${s.id}"`)}</div>`:''}</section>`:''}</div><aside class="stack">${student?studentUploadCard(a):`<div class="panel panel-pad"><h2>Проверка работ</h2><p class="muted small" style="margin:12px 0 20px">Откройте реестр студентов, чтобы скачать ответы и выставить результаты.</p>${btn('review-assignment','Открыть реестр','primary full',`data-id="${a.id}"`)}<div style="margin-top:20px">${pubBadge(a)}</div><p class="small muted" style="margin-top:12px">${esc(groupList(a))}</p></div>`}<div class="notice">${icon('info',15)} Сроки указаны по Иркутску. Файлы хранятся до двух лет с момента загрузки.</div></aside></div>`;
  return html;
}
function studentUploadCard(a){
  const s=a.submission;let reason='';
  if(!a.assigned)reason='Вы больше не входите в аудиторию задания. Ваши предыдущие сдачи доступны для просмотра.';
  else if(s?.status==='accepted')reason='Работа принята. Повторная сдача станет доступна, если преподаватель вернёт её на доработку.';
  else if(a.due_at&&Date.parse(a.due_at)<Date.now()&&a.late_policy==='close'&&s?.status!=='needs_revision')reason='Срок сдачи истёк. Приём новых работ закрыт.';
  else if(!uploadsEnabled())reason='Приём файлов отключён администратором.';
  return `<section class="panel panel-pad"><h2>${s?'Новая версия работы':'Сдать практическую'}</h2>${reason?`<p class="notice ${s?.status==='accepted'?'blue':'orange'}" style="margin-top:18px">${reason}</p>`:`${uploadZone()}<div class="notice small" style="margin:17px 0">${s?'Весь предыдущий комплект будет заменён.':''} ${a.late_policy==='allow'||s?.status==='needs_revision'?'Сдача после срока разрешена с отметкой об опоздании.':'Приём до указанного срока.'}</div><div class="small muted" style="margin:14px 0">Доступно: ${size(Math.max(0,state.boot.quota.limit-state.boot.quota.used+(s?.files||[]).reduce((n,f)=>n+f.size,0)))}</div>${btn('submit-files',state.uploading?'Сохраняем…':icon('upload',17)+'Отправить работу','primary full',state.uploading?'disabled':'')}<div id="upload-state" role="status"></div>${state.pendingOp?btn('check-upload','Проверить состояние','full','style="margin-top:12px"'):''}`}</section>`;
}
function reviewPage(){
  const list=state.assignments.filter(a=>a.publication_status!=='draft');const a=list.find(a=>a.id===state.activeId);
  let html=head('Проверка работ','Результаты студентов и обратная связь.');
  html+=`<div class="panel panel-pad" style="margin-bottom:23px"><div class="field"><label for="review-assignment">Практическая работа</label><select id="review-assignment">${option('','Выберите задание',state.activeId)}${list.map(a=>option(a.id,a.title,state.activeId)).join('')}</select></div></div>`;
  if(!a)return html+`<div class="panel">${empty('Выберите практическую','Здесь появится реестр студентов, включая тех, кто ещё не сдал работу.')}</div>`;
  let rows=state.rows.filter(r=>(state.group==='all'||r.student.group_id===state.group)&&(state.subgroup==='all'||String(r.student.subgroup)===state.subgroup)&&(!state.query||r.student.full_name.toLowerCase().includes(state.query.toLowerCase()))&&(state.filter==='all'||state.filter==='late'&&r.submission?.is_late||(r.submission?.status||'not_submitted')===state.filter));
  html+=`<div class="toolbar">${search('Поиск по студенту…')}<div class="filters"><select id="review-group" aria-label="Группа">${option('all','Все группы',state.group)}${state.boot.groups.map(g=>option(g.id,g.name,state.group)).join('')}</select><select id="review-subgroup" aria-label="Подгруппа">${option('all','Все подгруппы',state.subgroup)+option('1','Подгруппа 1',state.subgroup)+option('2','Подгруппа 2',state.subgroup)}</select><select id="review-filter" aria-label="Статус">${option('all','Все статусы',state.filter)}${Object.entries(statuses).map(([v,s])=>option(v,s[0],state.filter)).join('')}${option('late','С опозданием',state.filter)}</select></div></div><div class="panel"><div class="panel-header"><div><h2>${esc(a.title)}</h2><p>${rows.length} студентов · ${esc(groupList(a))}</p></div>${pubBadge(a)}</div>${rows.length?`<div class="table-scroll"><table><thead><tr><th>Студент</th><th>Последняя сдача</th><th>Статус</th><th>Файлы</th><th>Оценка</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><div class="row"><span class="avatar">${esc(initials(r.student.full_name))}</span><div><div class="strong small">${esc(r.student.full_name)}</div><div class="task-subtitle">${esc(groupName(r.student.group_id))} · ${r.student.subgroup} подгр.</div></div></div></td><td><div class="date">${r.submission?date(r.submission.submitted_at):'—'}</div><div class="date-hint ${r.submission?.is_late?'overdue':''}">${r.submission?r.submission.is_late?'С опозданием':time(r.submission.submitted_at):'Ещё не сдано'}</div></td><td>${badge(r.submission?.status||'not_submitted')}</td><td><span class="small">${r.submission?.files?.length||0}</span><div class="task-subtitle">${r.submission?.files_deleted?'Удалены студентом':size((r.submission?.files||[]).reduce((n,f)=>n+f.size,0))}</div></td><td>${r.submission?.grade?`<span class="grade">${r.submission.grade}</span>`:'<span class="muted">—</span>'}</td><td>${r.submission?btn('review-row','Проверить','compact',`data-id="${r.submission.id}"`):'<span class="muted small">Ожидаем сдачу</span>'}</td></tr>`).join('')}</tbody></table></div>`:empty('Студенты не найдены','Измените параметры поиска.')}<div class="table-footer"><span>Показано ${rows.length} студентов</span><span>Оценки и изменения решений сохраняются в журнале</span></div></div>`;
  return html;
}
function overviewPage(){
  const a=state.admin;if(!a)return '';
  return head('Обзор приложения','Пользователи, работы и состояние хранилища.',btn('refresh',icon('refresh',16)+'Обновить'))+`<div class="stats">${stat('Пользователи',a.users.length,`${a.users.filter(u=>u.status==='active').length} активных аккаунтов`,'users')}${stat('Учебные группы',a.groups.filter(g=>g.active).length,'Доступны для назначения','folder')}${stat('Практические',state.assignments.length,'Во всех учебных группах','book')}${stat('Файлы',size(a.storage.current),'Актуальные материалы и сдачи','file','green')}</div><div class="split"><section class="panel"><div class="panel-header"><h2>Последние задания</h2>${btn('nav','Все задания','compact','data-route="assignments"')}</div><div class="panel-pad" style="padding-top:5px;padding-bottom:5px">${state.assignments.slice(0,5).map(task=>`<div class="file-row"><div><button class="text-btn task-name" data-action="open-assignment" data-id="${task.id}">${esc(task.title)}</button><div class="task-subtitle">${esc(groupList(task))}</div></div>${pubBadge(task)}</div>`).join('')||empty('Заданий пока нет','Преподаватели смогут создать их после настройки доступа.')}</div></section><section class="panel"><div class="panel-header"><h2>Состояние системы</h2></div><div class="panel-pad stack"><div class="row between"><span class="small">Подключение</span><span class="badge ${state.api.demo?'orange':'green'}">${state.api.demo?'Демонстрация':'Apps Script'}</span></div><div class="row between"><span class="small">Приём файлов</span><span class="badge ${uploadsEnabled()?'green':'orange'}">${state.api.demo?'Демо':uploadsEnabled()?'Разрешён':'Отключён'}</span></div><div class="row between"><span class="small">Ожидают удаления</span><strong>${a.storage.pending}</strong></div><div class="notice">${state.api.demo?'Это учебный стенд. Google Sheets и Drive не подключены.':'Состояние хранилища и резервных копий доступно на вкладке «Настройки».'}</div>${btn('nav','Настройки приложения','','data-route="settings"')}</div></section></div><div class="footer-note">${icon('shield',15)} Закрытое хранилище · доступ по ролям · журнал действий</div>`;
}
function usersPage(){
  const users=(state.admin?.users||[]).filter(u=>(state.filter==='all'||u.role===state.filter)&&(!state.query||`${u.full_name} ${u.login}`.toLowerCase().includes(state.query.toLowerCase())));
  return head('Пользователи','Управление аккаунтами, квотами и доступом.',btn('import-users','Импорт из Sheets')+btn('new-user',icon('plus',17)+'Добавить пользователя','primary'))+`<div class="toolbar"><div class="tabs">${[['all','Все'],...Object.entries(roles)].map(([v,l])=>`<button class="tab ${state.filter===v?'active':''}" data-action="filter" data-value="${v}">${v==='all'?l:({student:'Студенты',teacher:'Преподаватели',admin:'Администраторы'})[v]}</button>`).join('')}</div>${search('Имя или логин…')}</div><div class="panel">${users.length?`<div class="table-scroll"><table><thead><tr><th>Пользователь</th><th>Роль</th><th>Группа</th><th>Хранилище</th><th>Статус</th><th></th></tr></thead><tbody>${users.map(u=>`<tr><td><div class="row"><span class="avatar">${esc(initials(u.full_name))}</span><div><div class="strong small">${esc(u.full_name)}</div><div class="task-subtitle">${esc(u.login)}</div></div></div></td><td><span class="small">${roles[u.role]}</span></td><td><span class="small">${u.group_id?esc(groupName(u.group_id))+' · '+u.subgroup:'—'}</span></td><td><div class="small">${size(u.used||0)} <span class="muted">/ ${size(u.quota_bytes)}</span></div></td><td><span class="badge ${u.status==='active'?'green':'red'}">${u.status==='active'?'Активен':'Заблокирован'}</span></td><td>${btn('edit-user','Управление','compact',`data-id="${u.id}"`)}</td></tr>`).join('')}</tbody></table></div>`:empty('Пользователи не найдены','Измените поиск или добавьте новый аккаунт.')}<div class="table-footer"><span>${users.length} пользователей</span><span>Самостоятельная регистрация отключена</span></div></div>`;
}
function groupsPage(){const groups=state.admin?.groups||[];return head('Учебные группы','Группы, подгруппы и распределение студентов.',btn('new-group',icon('plus',17)+'Добавить группу','primary'))+`<div class="panel">${groups.length?`<div class="table-scroll"><table><thead><tr><th>Группа</th><th>Студенты</th><th>Подгруппа 1</th><th>Подгруппа 2</th><th>Статус</th><th></th></tr></thead><tbody>${groups.map(g=>{const students=state.admin.users.filter(u=>u.group_id===g.id);return `<tr><td><div class="row">${icon('folder')}<strong>${esc(g.name)}</strong></div></td><td>${students.length}</td><td>${students.filter(u=>u.subgroup===1).length}</td><td>${students.filter(u=>u.subgroup===2).length}</td><td><span class="badge ${g.active?'green':''}">${g.active?'Активна':'Неактивна'}</span></td><td>${btn('edit-group','Изменить','compact',`data-id="${g.id}"`)}</td></tr>`;}).join('')}</tbody></table></div>`:empty('Добавьте первую группу','После этого можно создать студентов и назначить преподавателей.')}</div>`;}
function accessPage(){const teachers=state.admin.users.filter(u=>u.role==='teacher');return head('Доступ преподавателей','Назначьте группы и подгруппы каждому преподавателю.')+`<div class="panel">${teachers.length?`<div class="table-scroll"><table><thead><tr><th>Преподаватель</th><th>Доступные группы</th><th></th></tr></thead><tbody>${teachers.map(u=>`<tr><td><div class="row"><span class="avatar">${esc(initials(u.full_name))}</span><strong class="small">${esc(u.full_name)}</strong></div></td><td><span class="small">${state.admin.access.filter(a=>a.teacher_id===u.id).map(a=>`${esc(groupName(a.group_id))}${a.subgroup?' · '+a.subgroup+' подгр.':''}`).join(', ')||'<span class="muted">Не назначены</span>'}</span></td><td>${btn('edit-access','Настроить','compact',`data-id="${u.id}"`)}</td></tr>`).join('')}</tbody></table></div>`:empty('Преподавателей пока нет','Создайте аккаунт преподавателя в разделе пользователей.')}</div>`;}
function auditPage(){const rows=(state.admin?.audit||[]).filter(e=>!state.query||`${actionNames[e.action]||e.action} ${e.actor_id}`.toLowerCase().includes(state.query.toLowerCase()));return head('Журнал действий','Последние 300 событий. Пароли и токены в журнал не записываются.',btn('refresh',icon('refresh',16)+'Обновить'))+`<div class="toolbar">${search('Поиск по событию…')}</div><div class="panel">${rows.length?`<div class="table-scroll"><table><thead><tr><th>Дата и время</th><th>Пользователь</th><th>Событие</th><th>Объект</th></tr></thead><tbody>${rows.map(e=>`<tr><td><div class="date">${date(e.at)}</div><div class="date-hint">${time(e.at)}</div></td><td class="small">${esc(state.admin.users.find(u=>u.id===e.actor_id)?.full_name||'Система')}</td><td><span class="audit-action">${esc(actionNames[e.action]||e.action)}</span></td><td><span class="audit-details">${esc(e.entity_id||'—')}</span></td></tr>`).join('')}</tbody></table></div>`:empty('Событий пока нет','Здесь появятся действия пользователей приложения.')}</div>`;}
function settingsPage(){return head('Настройки приложения','Хранилище, резервные копии и обслуживание.')+`
<div class="split"><section class="panel panel-pad stack"><h2>Хранилище приложения</h2>
<div class="notice">Google Sheets, Apps Script и закрытый Drive принадлежат одному выделенному аккаунту.</div>
<div class="row between small"><span>Версия сервера</span><strong>${esc(state.boot.release?.version||'Предыдущая версия')}</strong></div>
<div class="row between small"><span>Приём файлов</span><span class="badge ${uploadsEnabled()?'green':'orange'}">${uploadsEnabled()?'Разрешён':'Отключён'}</span></div>
<p class="small muted">Приём управляется свойством FILE_UPLOADS_ENABLED в Apps Script. Испытания загрузок исключены из подготовки этого выпуска по решению владельца.</p>
${btn('storage-health',icon('shield',16)+'Проверить Drive')}<div id="storage-health"></div>
${btn('run-cleanup',icon('trash',16)+'Повторить очистку')}<p class="small muted">Ожидают удаления: ${state.admin?.storage.pending||0}. Физические файлы: ${size(state.admin?.storage.physical||0)}.</p></section>
<section class="panel panel-pad stack"><h2>Резервные копии</h2>
<p class="small muted">Метаданные копируются ежедневно около 03:30 по Иркутску. По умолчанию сохраняются последние 7 копий. Работы повторно не копируются.</p>
${state.api.demo?'<div class="notice blue">В демонстрации резервная копия виртуальная.</div>':''}
${backupInfo()}<div class="row wrap">${btn('create-backup',icon('folder',16)+'Создать копию','primary')}${btn('backup-status','Обновить состояние')}</div>
<div class="notice">Восстановление выполняет владелец из редактора Apps Script. Оно создаёт отдельную таблицу, сохраняет оценки и завершает прежние сессии. Рабочая база автоматически не заменяется.</div></section></div>
<section class="panel panel-pad" style="margin-top:24px"><h2>Хранение и диагностика</h2><p class="small muted" style="margin:12px 0 18px">Файлы удаляются через два года после загрузки. Оценки сохраняются. Ошибки удаления остаются в очереди для повтора.</p>
${btn('spike-upload',icon('upload',16)+'Диагностическая загрузка')}<div id="spike-results"></div></section>`;}
function profilePage(){const u=state.boot.user;return head('Мой профиль','Данные учётной записи и безопасность.')+`<div class="split"><section class="panel panel-pad stack"><div class="row"><span class="avatar" style="width:54px;height:54px;font-size:1rem">${esc(initials(u.full_name))}</span><div><h2>${esc(u.full_name)}</h2><p class="muted small">${roles[u.role]}</p></div></div><div class="row between small"><span class="muted">Логин</span><strong>${esc(u.login)}</strong></div>${u.group_id?`<div class="row between small"><span class="muted">Группа</span><strong>${esc(groupName(u.group_id))} · ${u.subgroup} подгруппа</strong></div>`:''}<div class="row between small"><span class="muted">Хранилище</span><strong>${size(state.boot.quota.used)} / ${size(u.quota_bytes)}</strong></div><div class="notice">Для изменения ФИО, группы или восстановления доступа обратитесь к администратору.</div></section><section class="panel panel-pad stack"><h2>Безопасность</h2><p class="muted small">Используйте пароль длиной от 10 до 128 символов. После смены пароля остальные сессии будут завершены.</p>${btn('password','Сменить пароль','primary')}${btn('logout',icon('logout',16)+'Выйти из приложения')}</section></div>`;}

function modal(title,body,footer='',wide=false){const element=$('#modal');element.className=wide?'wide':'';element.innerHTML=`<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Закрыть">${icon('close',18)}</button></div>${body}${footer}<div class="modal-error error-text" role="alert"></div>`;if(!element.open)element.showModal();}
function closeModal(){if(state.boot?.user.must_change_password)return;$('#modal').close();$('#modal').innerHTML='';}
function formButtons(label='Сохранить'){return `<div class="modal-footer">${btn('close-modal','Отмена')}<button type="submit" class="btn primary">${label}</button></div>`;}
function targetInputs(targets=[],scope=null){return state.boot.groups.filter(g=>!scope||scope.some(a=>a.group_id===g.id)).map(g=>{
  const current=targets.find(t=>t.group_id===g.id),allowed=scope?.filter(a=>a.group_id===g.id),whole=!allowed||allowed.some(a=>!a.subgroup);
  const scopes=whole?[0,1,2]:[...new Set(allowed.map(a=>a.subgroup))];
  return `<div class="target-row"><label class="check-row"><input type="checkbox" name="target" value="${g.id}" ${current?'checked':''}>${esc(g.name)}</label><select name="scope-${g.id}" aria-label="Подгруппа ${esc(g.name)}">${scopes.map(s=>option(s,s?'Подгруппа '+s:'Вся группа',current?.subgroup||0)).join('')}</select></div>`;
}).join('')||'<p class="notice orange">Сначала добавьте группы и назначьте доступ преподавателю.</p>';}
const readTargets=form=>[...form.querySelectorAll('input[name="target"]:checked')].map(input=>({group_id:input.value,subgroup:Number(form.elements['scope-'+input.value].value)}));
function assignmentModal(id){
  const a=state.assignments.find(a=>a.id===id),scope=state.boot.user.role==='admin'?null:state.boot.access;
  let localDue='';if(a?.due_at)localDue=new Date(new Date(a.due_at).getTime()+8*3600000).toISOString().slice(0,16);
  modal(a?'Изменить практическую':'Новая практическая',`<form id="assignment-form" data-id="${a?.id||''}"><div class="modal-body"><div class="form-grid"><div class="wide">${field('Название','title',a?.title||'','text','required maxlength="200" placeholder="Например, расчёт электрических цепей"')}</div><div class="wide">${field('Тема / краткое описание','description',a?.description||'','text','maxlength="2000" placeholder="Название дисциплины или тема"')}</div><div class="field wide"><label for="instructions">Инструкция</label><textarea id="instructions" name="instructions" rows="7" maxlength="20000" placeholder="Цель, порядок выполнения, требования к отчёту">${esc(a?.instructions||'')}</textarea><span class="hint">Обычный текст с переносами строк.</span></div><div class="field">${field('Срок сдачи · Иркутск','due_at',localDue,'datetime-local')}</div><div class="field"><label for="late-policy">После срока</label><select id="late-policy" name="late_policy">${option('close','Закрыть приём',a?.late_policy||'close')+option('allow','Принимать с опозданием',a?.late_policy)}</select></div><div class="field wide"><span>Аудитория</span><div>${targetInputs(a?.targets||[],scope)}</div></div><div class="field wide"><label for="publication">Публикация</label><select id="publication" name="publication_status">${option('draft','Черновик',a?.publication_status||'draft')+option('published','Опубликовано',a?.publication_status)+option('archived','Архив',a?.publication_status)}</select></div></div>${a?'<div class="notice">Изменение аудитории не удаляет существующие сдачи. При возврате в черновик задание полностью скрывается от студентов.</div>':'<div class="notice">Материалы можно добавить после создания задания.</div>'}</div>${formButtons(a?'Сохранить изменения':'Создать задание')}</form>`,'',true);
}
function reviewModal(id){const row=state.rows.find(r=>r.submission?.id===id);if(!row)return;const s=row.submission;
  modal('Проверка работы',`<form id="review-form" data-id="${s.id}" data-generation="${s.generation}"><div class="modal-body"><div class="row between"><div><h3>${esc(row.student.full_name)}</h3><p class="muted small">${esc(groupName(row.student.group_id))} · ${row.student.subgroup} подгруппа</p></div>${badge(s.status)}</div><div>${s.files?.map(f=>renderFile(f)).join('')||'<div class="notice orange">Файлы сдачи удалены. Оценка и история сохранены.</div>'}</div><div class="form-grid"><div class="field"><label for="decision">Решение</label><select id="decision" name="status">${option('accepted','Принять работу',s.status==='needs_revision'?'needs_revision':'accepted')+option('needs_revision','На доработку',s.status)}</select></div><div class="field"><label for="grade">Оценка</label><select id="grade" name="grade">${option('','Без оценки',s.grade||'')+[2,3,4,5].map(g=>option(g,g,s.grade)).join('')}</select></div><div class="field wide"><label for="feedback">Комментарий</label><textarea id="feedback" name="feedback" rows="4" maxlength="4000" placeholder="Необязательно">${esc(s.feedback||'')}</textarea></div></div><div class="notice">Возврат на доработку сбрасывает актуальную оценку и разрешает пересдачу после срока. Предыдущее решение сохраняется в журнале.</div></div>${formButtons('Сохранить решение')}</form>`);
}
function userModal(id){const u=state.admin.users.find(u=>u.id===id);modal(u?'Управление пользователем':'Новый пользователь',`<form id="user-form" data-id="${u?.id||''}"><div class="modal-body"><div class="form-grid"><div class="wide">${field('ФИО','full_name',u?.full_name||'','text',`required maxlength="160" ${u?'readonly':''}`)}</div>${field('Логин','login',u?.login||'','text',`required minlength="3" maxlength="100" ${u?'readonly':''}`)}<div class="field"><label for="role">Роль</label><select id="role" name="role" ${u?'disabled':''}>${Object.entries(roles).map(([v,l])=>option(v,l,u?.role||'student')).join('')}</select></div><div class="field"><label for="user-group">Группа студента</label><select id="user-group" name="group_id">${option('','Не выбрана',u?.group_id)}${state.boot.groups.map(g=>option(g.id,g.name,u?.group_id)).join('')}</select></div><div class="field"><label for="user-subgroup">Подгруппа</label><select id="user-subgroup" name="subgroup">${option(1,'Подгруппа 1',u?.subgroup||1)+option(2,'Подгруппа 2',u?.subgroup)}</select></div>${u?`<div class="field"><label for="user-status">Статус</label><select id="user-status" name="status">${option('active','Активен',u.status)+option('blocked','Заблокирован',u.status)}</select></div>${field('Квота · МиБ','quota',u.quota_bytes/MiB,'number','required min="0" max="15360" step="1"')}`:''}</div>${u?`<div class="row wrap">${btn('reset-password',icon('refresh',15)+'Сбросить пароль','compact',`data-id="${u.id}"`)}${btn('revoke-sessions',icon('logout',15)+'Отозвать сессии','compact',`data-id="${u.id}"`)}</div>`:'<div class="notice">Случайный временный пароль будет показан однократно после создания аккаунта. При первом входе потребуется его сменить.</div>'}</div>${formButtons(u?'Сохранить изменения':'Создать пользователя')}</form>`);}
function groupModal(id){const g=state.admin.groups.find(g=>g.id===id);modal(g?'Изменить группу':'Новая группа',`<form id="group-form" data-id="${g?.id||''}"><div class="modal-body">${field('Название группы','name',g?.name||'','text','required maxlength="80" placeholder="Например, Э-23-1"')}<label class="check-row"><input type="checkbox" name="active" ${g?.active!==false?'checked':''}>Активная группа</label></div>${formButtons()}</form>`);}
function accessModal(id){const u=state.admin.users.find(u=>u.id===id);modal('Доступ преподавателя',`<form id="access-form" data-id="${id}"><div class="modal-body"><h3>${esc(u.full_name)}</h3><div>${targetInputs(state.admin.access.filter(a=>a.teacher_id===id))}</div><div class="notice">После отзыва доступа преподаватель не сможет открыть работы студентов этих групп, включая ранее сданные.</div></div>${formButtons()}</form>`);}
function passwordModal(forced=false){modal(forced?'Смените временный пароль':'Смена пароля',`<form id="password-form"><div class="modal-body">${forced?'<div class="notice blue">Для продолжения установите собственный пароль.</div>':''}${field('Текущий пароль','current_password','','password','required autocomplete="current-password" minlength="10" maxlength="128"')}${field('Новый пароль','new_password','','password','required autocomplete="new-password" minlength="10" maxlength="128"')}${field('Повторите новый пароль','repeat_password','','password','required autocomplete="new-password" minlength="10" maxlength="128"')}</div>${formButtons('Сменить пароль')}</form>`);}
function revealPassword(password){modal('Временный пароль',`<div class="modal-body"><div class="notice orange">Скопируйте и передайте пароль пользователю безопасным способом. После закрытия он больше не будет показан.</div><div class="password-reveal">${esc(password)}</div><p class="muted small">При первом входе пользователь должен сменить пароль.</p></div>`,`<div class="modal-footer">${btn('close-modal','Пароль сохранён','primary')}</div>`);}
async function confirmAction(title,description,action){modal(title,`<p class="muted small">${esc(description)}</p>`,`<div class="modal-footer">${btn('close-modal','Отмена')}${btn('confirm','Подтвердить','danger')}</div>`);const confirmButton=$('#modal [data-action="confirm"]');confirmButton.addEventListener('click',async()=>{confirmButton.disabled=true;try{await action();if(confirmButton.isConnected)closeModal();}catch(e){if($('.modal-error'))$('.modal-error').textContent=e.message;else toast(e.message);confirmButton.disabled=false;}});}
function uploadModal(kind,assignmentId){state.selectedFiles=[];state.uploadKind=kind;state.uploadAssignment=assignmentId;modal(kind==='spike'?'Тестовая загрузка':'Материалы задания',`<div class="modal-body"><div class="notice">${kind==='spike'?'Файлы этого теста доступны только администратору и будут очищены автоматически.':'Новый комплект полностью заменит предыдущие материалы задания.'}</div>${uploadZone()}<div id="upload-state" role="status"></div></div>`,`<div class="modal-footer">${btn('close-modal','Отмена')}${btn('upload-modal-send','Загрузить','primary')}</div>`);}
function setFiles(files){
  const list=[...state.selectedFiles,...files];const total=list.reduce((n,f)=>n+f.size,0);
  if(list.length>25)throw new Error('В комплекте может быть до 25 файлов');
  if(total>state.boot.file_limit)throw new Error('Суммарный размер не должен превышать '+size(state.boot.file_limit));
  const ext=/\.(pdf|docx|xlsx|pptx|txt|zip|jpe?g|png)$/i;
  for(const f of files)if(!ext.test(f.name)||!f.size)throw new Error('Проверьте тип и размер файла: '+f.name);
  state.selectedFiles=list;if($('#selected-files'))$('#selected-files').innerHTML=selectedFilesHtml();
}
async function sendFiles(kind,assignmentId){
  if(state.uploading)return;
  const files=[...state.selectedFiles];if(!files.length)throw new Error('Выберите файлы для загрузки');
  state.uploading=true;const started=performance.now();
  const status=message=>{const el=$('#upload-state');if(el)el.innerHTML=`<div class="progress-line" style="margin-top:15px"><span class="spinner"></span>${message}</div>`;};
  try{
    status('Подготавливаем загрузку…');
    const operation=await state.api.call('beginUpload',{kind,assignment_id:assignmentId,idempotency_key:crypto.randomUUID(),files:files.map(f=>({name:f.name,size:f.size,type:f.type}))});
    state.pendingOp=operation.id;status('Передаём и сохраняем файлы…');
    const result=operation.status==='committed'?operation.result:await state.api.upload(operation.id,files);
    state.selectedFiles=[];state.pendingOp=null;
    if(kind==='spike'){
      closeModal();const elapsed=((performance.now()-started)/1000).toFixed(1);
      $('#spike-results').innerHTML=`<div class="notice blue">Загрузка: ${elapsed} с · ${size(files.reduce((n,f)=>n+f.size,0))}. Скачайте файлы и сравните содержимое.</div>${result.files.map(f=>renderFile(f)).join('')}`;
      state.spikeFiles=result.files;
    }else{closeModal();await refresh();}
    toast('Файлы сохранены');
  }catch(error){if($('#upload-state'))$('#upload-state').innerHTML=`<p class="error-text" style="margin-top:12px">${esc(error.message)}</p>${state.pendingOp?btn('check-upload','Проверить состояние','compact','style="margin-top:12px"'):''}`;throw error;}
  finally{state.uploading=false;if(kind==='submission' && state.route==='detail')render();}
}
function findFile(id){return [...state.assignments.flatMap(a=>[...(a.materials||[]),...(a.submission?.files||[])]),...state.rows.flatMap(r=>r.submission?.files||[]),...(state.spikeFiles||[])].find(f=>f.id===id);}
async function navigate(route,id=null){state.route=route;state.query='';state.filter='all';state.group='all';state.subgroup='all';state.selectedFiles=[];if(id!==null)state.activeId=id;
  if(route==='review'&&state.activeId&&state.assignments.some(a=>a.id===state.activeId))state.rows=await state.api.call('reviewRows',{assignment_id:state.activeId});
  if(route==='settings'){try{state.backup=await state.api.call('backupStatus');state.backupError=null;}catch(e){state.backup=null;state.backupError='Резервирование недоступно: обновите файлы Apps Script и выполните runInitialSetup.';}}
  render();window.scrollTo(0,0);
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.id;
  try{
    switch(action){
      case 'theme':{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('practicus-theme',theme);}catch{}document.querySelectorAll('[data-action="theme"]').forEach(b=>b.innerHTML=icon(theme==='dark'?'sun':'moon',18));break;}
      case 'demo':break;
      case 'nav':await navigate(button.dataset.route);break;
      case 'filter':state.filter=button.dataset.value;render();break;
      case 'open-assignment':if(state.boot.user.role==='student')await navigate('detail',id);else await navigate('detail',id);break;
      case 'review-assignment':await navigate('review',id);break;
      case 'new-assignment':assignmentModal();break;
      case 'edit-assignment':assignmentModal(id);break;
      case 'review-row':reviewModal(id);break;
      case 'new-user':userModal();break;
      case 'import-users':{
        button.disabled=true;const result=await state.api.call('importUsers');await refresh();
        if(result.results.length)modal('Временные пароли импорта',`<div class="modal-body"><div class="notice orange">Сохраните пароли сейчас. Повторно они не показываются. Проверьте ошибки остальных строк в UserIntake.</div>${result.results.map(r=>`<div><p class="small strong">${esc(r.login)}</p><div class="password-reveal">${esc(r.temporary_password)}</div></div>`).join('')}</div>`,`<div class="modal-footer">${btn('close-modal','Пароли сохранены','primary')}</div>`);
        else toast('Новых пользователей не создано. Проверьте строки UserIntake и колонку error.');break;
      }
      case 'edit-user':userModal(id);break;
      case 'new-group':groupModal();break;
      case 'edit-group':groupModal(id);break;
      case 'edit-access':accessModal(id);break;
      case 'password':passwordModal();break;
      case 'close-modal':closeModal();break;
      case 'remove-selected':state.selectedFiles.splice(Number(button.dataset.index),1);$('#selected-files').innerHTML=selectedFilesHtml();break;
      case 'submit-files':{
        const a=state.assignments.find(a=>a.id===state.activeId);
        if(a.submission)await confirmAction('Заменить комплект файлов?','Все файлы предыдущей сдачи будут удалены после успешного сохранения нового комплекта. Оценка сбросится.',async()=>{closeModal();await sendFiles('submission',a.id);});
        else {button.disabled=true;await sendFiles('submission',a.id);}break;
      }
      case 'upload-materials':uploadModal('materials',id);break;
      case 'spike-upload':uploadModal('spike',null);break;
      case 'upload-modal-send':button.disabled=true;await sendFiles(state.uploadKind,state.uploadAssignment);break;
      case 'check-upload':{
        if(!state.pendingOp)break;
        const r=await state.api.call('uploadStatus',{id:state.pendingOp});
        if(r.status==='committed'){state.pendingOp=null;closeModal();await refresh();toast('Сохранение подтверждено');}
        else if(['failed','expired'].includes(r.status)){state.pendingOp=null;toast('Комплект не сохранён. Можно загрузить заново.');}
        else toast('Операция ещё выполняется. Подождите и проверьте снова.');break;
      }
      case 'download':{
        const f=findFile(id);if(!f)throw new Error('Файл недоступен');button.disabled=true;
        await downloadFile(state.api,f,progress=>toast('Скачивание: '+Math.round(progress*100)+'%',true));toast('Файл скачан');break;
      }
      case 'delete-submission':await confirmAction('Удалить файлы сдачи?','Файлы будут удалены безвозвратно. Существующая оценка сохранится. Работы на проверке также можно удалить.',async()=>{await state.api.call('deleteSubmissionFiles',{submission_id:id,confirm:true});await refresh();toast('Файлы удалены из сдачи. Физическая очистка выполняется в фоне.');});break;
      case 'delete-material':await confirmAction('Удалить материал?','Файл станет недоступен студентам и будет удалён из хранилища.',async()=>{await state.api.call('deleteMaterial',{file_id:id,confirm:true});await refresh();});break;
      case 'reset-password':await confirmAction('Сбросить пароль?','Действующие сессии пользователя будут завершены.',async()=>{const r=await state.api.call('resetPassword',{id});revealPassword(r.temporary_password);});break;
      case 'revoke-sessions':await state.api.call('revokeSessions',{id});toast('Сессии пользователя завершены');break;
      case 'run-cleanup':button.disabled=true;{const result=await state.api.call('runCleanup');await refresh();toast('Удалено: '+result.deleted+'. Ожидают повтора: '+result.pending);}break;
      case 'backup-status':button.disabled=true;state.backup=await state.api.call('backupStatus');state.backupError=null;render();break;
      case 'create-backup':button.disabled=true;toast('Создаём резервную копию…',true);state.backup=await state.api.call('createBackup');state.backupError=null;render();toast('Резервная копия сохранена');break;
      case 'storage-health':{
        button.disabled=true;const r=await state.api.call('storageHealth');$('#storage-health').innerHTML=`<div class="notice blue">Аккаунт: ${esc(r.owner)}<br>Использовано ${size(Number(r.storageQuota.usage||0))} из ${size(Number(r.storageQuota.limit||0))}</div>`;break;
      }
      case 'refresh':button.disabled=true;await refresh();toast('Данные обновлены');break;
      case 'logout':await state.api.call('logout');state.api.destroy();state.api=null;state.boot=null;state.assignments=[];state.rows=[];state.admin=null;state.selectedFiles=[];closeModal();loginPage();break;
    }
  }catch(error){if($('#modal').open&&$('.modal-error'))$('.modal-error').textContent=error.message;else toast(error.message);if(error.code==='UNAUTHORIZED'){state.api?.destroy();state.boot=null;loginPage();}}
  finally{if(button.isConnected)button.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
  const values=Object.fromEntries(new FormData(form));const submit=form.querySelector('[type="submit"]');if(submit?.disabled)return;if(submit)submit.disabled=true;
  try{
    switch(form.id){
      case 'login-form':{
        if(!window.PRACTICUS_CONFIG.apiUrl)throw new Error('Подключение ещё не настроено');
        state.api?.destroy();state.api=new RemoteApi(window.PRACTICUS_CONFIG.apiUrl);
        const result=await state.api.call('login',values);state.api.token=result.token;state.boot={user:result.user};resetRoute(result.user.role);form.reset();await refresh();break;
      }
      case 'assignment-form':{
        const old=state.assignments.find(a=>a.id===form.dataset.id),targets=readTargets(form);if(!targets.length)throw new Error('Выберите хотя бы одну группу');
        if(old?.publication_status==='published'&&values.publication_status==='draft'&&!confirm('Скрыть задание и все результаты от студентов?'))return;
        const p={...values,targets,id:old?.id,version:old?.version,due_at:values.due_at?new Date(values.due_at+':00+08:00').toISOString():null};
        const saved=await state.api.call('saveAssignment',p);closeModal();await refresh();await navigate('detail',saved.id);toast('Задание сохранено');break;
      }
      case 'review-form':{
        await state.api.call('review',{...values,grade:values.grade===''?null:Number(values.grade),submission_id:form.dataset.id,generation:form.dataset.generation});
        closeModal();await refresh();await navigate('review',state.activeId);toast('Решение сохранено');break;
      }
      case 'user-form':{
        if(form.dataset.id){await state.api.call('updateUser',{...values,id:form.dataset.id,quota_bytes:Number(values.quota)*MiB,subgroup:Number(values.subgroup)});closeModal();await refresh();toast('Пользователь обновлён');}
        else{const result=await state.api.call('createUser',{...values,subgroup:Number(values.subgroup)});await refresh();revealPassword(result.temporary_password);}break;
      }
      case 'group-form':await state.api.call('saveGroup',{id:form.dataset.id||undefined,name:values.name,active:!!form.elements.active.checked});closeModal();await refresh();toast('Группа сохранена');break;
      case 'access-form':await state.api.call('saveTeacherAccess',{teacher_id:form.dataset.id,targets:readTargets(form)});closeModal();await refresh();toast('Доступ обновлён');break;
      case 'password-form':{
        if(values.new_password!==values.repeat_password)throw new Error('Новые пароли не совпадают');
        const result=await state.api.call('changePassword',values);state.api.token=result.token;state.boot.user=result.user;form.reset();closeModal();await refresh();toast('Пароль изменён');break;
      }
    }
  }catch(error){const target=form.id==='login-form'?$('#login-error'):$('.modal-error');if(target)target.textContent=error.message;else toast(error.message);}
  finally{if(submit?.isConnected)submit.disabled=false;}
});
document.addEventListener('change',async event=>{
  const element=event.target;
  try{switch(element.id){
    case 'demo-role':await enterDemo(element.value);break;
    case 'sort':state.sort=element.value;render();break;
    case 'upload-files':setFiles([...element.files]);element.value='';break;
    case 'review-assignment':state.activeId=element.value;state.rows=element.value?await state.api.call('reviewRows',{assignment_id:element.value}):[];render();break;
    case 'review-group':state.group=element.value;render();break;
    case 'review-subgroup':state.subgroup=element.value;render();break;
    case 'review-filter':state.filter=element.value;render();break;
  }}catch(error){toast(error.message);}
});
document.addEventListener('input',event=>{if(event.target.id==='search'){const position=event.target.selectionStart;state.query=event.target.value;render();const input=$('#search');input.focus();input.setSelectionRange(position,position);}});
document.addEventListener('dragover',event=>{const zone=event.target.closest('[data-drop]');if(zone){event.preventDefault();zone.classList.add('dragover');}});
document.addEventListener('dragleave',event=>{const zone=event.target.closest('[data-drop]');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('dragover');});
document.addEventListener('drop',event=>{const zone=event.target.closest('[data-drop]');if(zone){event.preventDefault();zone.classList.remove('dragover');try{setFiles([...event.dataTransfer.files]);}catch(error){toast(error.message);}}});
$('#modal').addEventListener('cancel',event=>{if(state.boot?.user.must_change_password||state.uploading)event.preventDefault();});
const role=new URLSearchParams(location.search).get('demo');
loginPage();

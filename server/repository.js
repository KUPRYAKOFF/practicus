import { assert } from './domain.js';
export const SCHEMA = {
  Users: ['id','full_name','login','role','group_id','subgroup','status','quota_bytes','password_hash','salt','iterations','must_change_password','created_at'],
  UserIntake: ['id','full_name','login','role','group_id','subgroup','status','error'],
  Groups: ['id','name','active'],
  TeacherAccess: ['id','teacher_id','group_id','subgroup','active'],
  Assignments: ['id','teacher_id','title','description','instructions','targets','due_at','late_policy','publication_status','material_generation','version','created_at','updated_at'],
  Materials: ['id','assignment_id','owner_id','generation','drive_id','name','type','size','created_at','deleted_at','delete_pending'],
  Submissions: ['id','assignment_id','student_id','status','started_at','submitted_at','is_late','generation','attempts','grade','feedback','reviewer_id','reviewed_at','group_at_submission','subgroup_at_submission','files_deleted'],
  SubmissionFiles: ['id','submission_id','assignment_id','owner_id','generation','drive_id','name','type','size','created_at','deleted_at','delete_pending'],
  Sessions: ['id','user_id','token_hash','issued_at','expires_at','revoked_at'],
  LoginAttempts: ['id','count','window_at','blocked_until'],
  UploadReservations: ['id','user_id','assignment_id','kind','manifest','total','replaced_bytes','started_at','expires_at','status','generation','base_generation','base_version','idempotency_key','result','file_ids','error'],
  Audit: ['id','actor_id','action','entity_id','at','details'],
  Settings: ['id','value'],
};
export class SheetRepository {
  constructor(id) { this.book = SpreadsheetApp.openById(id); this.cache = {}; }
  sheet(table) {
    assert(SCHEMA[table], 'Неизвестная таблица', 'INTERNAL');
    const sheet = this.book.getSheetByName(table);
    assert(sheet, 'Сначала выполните setup_', 'CONFIG');
    const headers = sheet.getRange(1,1,1,SCHEMA[table].length).getValues()[0];
    assert(JSON.stringify(headers) === JSON.stringify(SCHEMA[table]), 'Неверная схема листа ' + table, 'CONFIG');
    return sheet;
  }
  all(table) {
    if (this.cache[table]) return this.cache[table];
    const sheet = this.sheet(table); const count = sheet.getLastRow() - 1;
    const rows = count ? sheet.getRange(2,1,count,SCHEMA[table].length).getValues() : [];
    this.cache[table] = rows.filter(r => r[0] !== '').map(row => Object.fromEntries(SCHEMA[table].map((key,i) => {
      try { return [key, row[i] === '' ? null : JSON.parse(String(row[i]))]; }
      catch { throw new Error('Повреждён формат листа ' + table); }
    })));
    return this.cache[table];
  }
  get(table, id) { return this.all(table).find(row => row.id === id); }
  put(table, record) {
    const rows = this.all(table); const index = rows.findIndex(row => row.id === record.id);
    const next = { ...(index >= 0 ? rows[index] : {}), ...record };
    const cells = SCHEMA[table].map(key => JSON.stringify(next[key] ?? null));
    this.sheet(table).getRange(index >= 0 ? index + 2 : rows.length + 2,1,1,cells.length).setValues([cells]);
    if (index >= 0) rows[index] = next; else rows.push(next);
    return next;
  }
  refresh() { this.cache = {}; }
  normalizeIntake() {
    const sheet=this.sheet('UserIntake'),count=sheet.getLastRow()-1;if(count<=0)return;
    const rows=sheet.getRange(2,1,count,SCHEMA.UserIntake.length).getValues();
    const decode=value=>{try{return JSON.parse(String(value));}catch{return value;}};
    const normalized=rows.map(row=>{
      const values=row.map(decode);if(values.every(v=>v==='' || v===null))return row;
      if(!values[0])values[0]=Utilities.getUuid();
      return values.map(v=>JSON.stringify(v===''?null:v));
    });
    sheet.getRange(2,1,count,SCHEMA.UserIntake.length).setValues(normalized);delete this.cache.UserIntake;
  }
  lock(fn) {
    const lock = LockService.getScriptLock();
    assert(lock.tryLock(15000), 'Сервер занят. Повторите запрос', 'BUSY');
    try { this.refresh(); return fn(); } finally { lock.releaseLock(); }
  }
}
export function initializeSheets(id) {
  const book = SpreadsheetApp.openById(id);
  for (const [table, columns] of Object.entries(SCHEMA)) {
    const sheet = book.getSheetByName(table) || book.insertSheet(table);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1,1,1,columns.length).setValues([columns]);
      sheet.setFrozenRows(1);
    }
  }
}

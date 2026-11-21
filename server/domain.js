export const MiB = 1024 * 1024;
export const LIMIT = 25 * MiB;
export const MAX_FILES = 25;
export const ALLOWED = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'], zip: ['application/zip', 'application/x-zip-compressed'],
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'],
};
export function fail(message, code = 'VALIDATION') {
  const error = new Error(message); error.code = code; throw error;
}
export function assert(condition, message = 'Доступ запрещён', code = 'FORBIDDEN') {
  if (!condition) fail(message, code);
}
export function text(value, max = 2000) {
  assert(typeof value === 'string' && value.length <= max, 'Недопустимое значение', 'VALIDATION');
  return value.trim();
}
export function name(value) {
  return text(value, 240).normalize('NFC').replace(/[\x00-\x1f\x7f/\\]/g, '_');
}
export function login(value) { return text(value, 100).toLocaleLowerCase('en-US'); }
export function sameGroup(user, target) {
  return user.group_id === target.group_id && (!target.subgroup || Number(user.subgroup) === Number(target.subgroup));
}
export function teacherScope(teacher, targets, access) {
  return targets.every(target => access.some(a => a.teacher_id === teacher.id && a.active &&
    a.group_id === target.group_id && (!a.subgroup || Number(a.subgroup) === Number(target.subgroup))));
}
export function canTeach(teacher, assignment, student, access) {
  return teacher.role === 'teacher' && teacher.id === assignment.teacher_id &&
    access.some(a => a.teacher_id === teacher.id && a.active && sameGroup(student, a));
}
export function studentAccess(student, assignment, submission, purpose = 'view') {
  if (assignment.publication_status === 'draft') return false;
  if (assignment.publication_status === 'archived') return purpose === 'grade' && !!submission;
  const targeted = assignment.targets.some(t => sameGroup(student, t));
  if (purpose === 'own') return !!submission;
  return targeted;
}
export function checkSubmit(student, assignment, submission, startedAt) {
  assert(student.role === 'student');
  assert(studentAccess(student, assignment, submission), 'Задание недоступно');
  assert(assignment.publication_status === 'published', 'Приём закрыт');
  assert(submission?.status !== 'accepted', 'Работа принята. Для пересдачи нужен возврат на доработку');
  const late = !!assignment.due_at && Date.parse(startedAt) > Date.parse(assignment.due_at);
  assert(!late || assignment.late_policy === 'allow' || submission?.status === 'needs_revision', 'Срок сдачи истёк');
  return late;
}
export function validateManifest(files, limit = LIMIT) {
  assert(Array.isArray(files) && files.length > 0 && files.length <= MAX_FILES,
    'Нужно от 1 до 25 файлов', 'VALIDATION');
  let total = 0;
  const result = files.map(file => {
    const filename = name(file.name); const ext = filename.split('.').pop().toLowerCase();
    assert(filename.includes('.') && ALLOWED[ext], 'Недопустимый тип файла: ' + filename, 'VALIDATION');
    assert(Number.isSafeInteger(file.size) && file.size > 0, 'Пустой или некорректный файл', 'VALIDATION');
    const mime = file.type || ALLOWED[ext][0];
    assert(ALLOWED[ext].includes(mime) || mime === 'application/octet-stream', 'MIME не соответствует расширению', 'VALIDATION');
    total += file.size;
    return { name: filename, size: file.size, type: ALLOWED[ext][0] };
  });
  assert(total <= limit, 'Превышен суммарный лимит файлов', 'QUOTA');
  return { files: result, total };
}
export function validateBytes(meta, bytes) {
  assert(bytes.length === meta.size, 'Размер принятого файла не совпал', 'VALIDATION');
  const ext = meta.name.split('.').pop().toLowerCase();
  const starts = prefix => prefix.every((v, i) => ((bytes[i]+256)%256) === v);
  if (ext === 'pdf') assert(starts([37,80,68,70,45]), 'Неверная сигнатура PDF', 'VALIDATION');
  if (ext === 'png') assert(starts([137,80,78,71,13,10,26,10]), 'Неверная сигнатура PNG', 'VALIDATION');
  if (['jpg','jpeg'].includes(ext)) assert(starts([255,216,255]), 'Неверная сигнатура JPEG', 'VALIDATION');
  if (['zip','docx','xlsx','pptx'].includes(ext)) assert(starts([80,75,3,4]) || starts([80,75,5,6]), 'Неверная сигнатура ZIP/Office', 'VALIDATION');
  if (ext === 'txt') assert(!bytes.includes(0), 'TXT содержит бинарные данные', 'VALIDATION');
}
export function quotaCheck(quota, used, replaced, reserved, total) {
  assert(used - replaced + reserved + total <= quota, 'Недостаточно места. Удалите файлы старых работ', 'QUOTA');
}
export function expired(file, now) {
  const deadline = new Date(file.created_at); deadline.setUTCFullYear(deadline.getUTCFullYear() + 2);
  return deadline.getTime() <= new Date(now).getTime();
}

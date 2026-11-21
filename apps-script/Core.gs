/*
@noble/hashes 2.0.1 (bundled in Apps Script Core.gs)
The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

esbuild 0.27.0 is a development-only build tool distributed under MIT.

*/
var Core = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name2 in all)
      __defProp(target, name2, { get: all[name2], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // server/main.js
  var main_exports = {};
  __export(main_exports, {
    api: () => api,
    backupMetadata: () => backupMetadata,
    housekeeping: () => housekeeping,
    prepareRestore: () => prepareRestore,
    publicStatus: () => publicStatus,
    setup: () => setup,
    uploadForm: () => uploadForm
  });

  // server/domain.js
  var MiB = 1024 * 1024;
  var LIMIT = 25 * MiB;
  var MAX_FILES = 25;
  var ALLOWED = {
    pdf: ["application/pdf"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    txt: ["text/plain"],
    zip: ["application/zip", "application/x-zip-compressed"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"]
  };
  function fail(message, code = "VALIDATION") {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
  function assert(condition, message = "\u0414\u043E\u0441\u0442\u0443\u043F \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D", code = "FORBIDDEN") {
    if (!condition) fail(message, code);
  }
  function text(value, max = 2e3) {
    assert(typeof value === "string" && value.length <= max, "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", "VALIDATION");
    return value.trim();
  }
  function name(value) {
    return text(value, 240).normalize("NFC").replace(/[\x00-\x1f\x7f/\\]/g, "_");
  }
  function login(value) {
    return text(value, 100).toLocaleLowerCase("en-US");
  }
  function sameGroup(user, target) {
    return user.group_id === target.group_id && (!target.subgroup || Number(user.subgroup) === Number(target.subgroup));
  }
  function teacherScope(teacher, targets, access) {
    return targets.every((target) => access.some((a) => a.teacher_id === teacher.id && a.active && a.group_id === target.group_id && (!a.subgroup || Number(a.subgroup) === Number(target.subgroup))));
  }
  function canTeach(teacher, assignment, student, access) {
    return teacher.role === "teacher" && teacher.id === assignment.teacher_id && access.some((a) => a.teacher_id === teacher.id && a.active && sameGroup(student, a));
  }
  function studentAccess(student, assignment, submission, purpose = "view") {
    if (assignment.publication_status === "draft") return false;
    if (assignment.publication_status === "archived") return purpose === "grade" && !!submission;
    const targeted = assignment.targets.some((t) => sameGroup(student, t));
    if (purpose === "own") return !!submission;
    return targeted;
  }
  function checkSubmit(student, assignment, submission, startedAt) {
    assert(student.role === "student");
    assert(studentAccess(student, assignment, submission), "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E");
    assert(assignment.publication_status === "published", "\u041F\u0440\u0438\u0451\u043C \u0437\u0430\u043A\u0440\u044B\u0442");
    assert(submission?.status !== "accepted", "\u0420\u0430\u0431\u043E\u0442\u0430 \u043F\u0440\u0438\u043D\u044F\u0442\u0430. \u0414\u043B\u044F \u043F\u0435\u0440\u0435\u0441\u0434\u0430\u0447\u0438 \u043D\u0443\u0436\u0435\u043D \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u0430 \u0434\u043E\u0440\u0430\u0431\u043E\u0442\u043A\u0443");
    const late = !!assignment.due_at && Date.parse(startedAt) > Date.parse(assignment.due_at);
    assert(!late || assignment.late_policy === "allow" || submission?.status === "needs_revision", "\u0421\u0440\u043E\u043A \u0441\u0434\u0430\u0447\u0438 \u0438\u0441\u0442\u0451\u043A");
    return late;
  }
  function validateManifest(files, limit = LIMIT) {
    assert(
      Array.isArray(files) && files.length > 0 && files.length <= MAX_FILES,
      "\u041D\u0443\u0436\u043D\u043E \u043E\u0442 1 \u0434\u043E 25 \u0444\u0430\u0439\u043B\u043E\u0432",
      "VALIDATION"
    );
    let total = 0;
    const result = files.map((file) => {
      const filename = name(file.name);
      const ext = filename.split(".").pop().toLowerCase();
      assert(filename.includes(".") && ALLOWED[ext], "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u0442\u0438\u043F \u0444\u0430\u0439\u043B\u0430: " + filename, "VALIDATION");
      assert(Number.isSafeInteger(file.size) && file.size > 0, "\u041F\u0443\u0441\u0442\u043E\u0439 \u0438\u043B\u0438 \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u0430\u0439\u043B", "VALIDATION");
      const mime = file.type || ALLOWED[ext][0];
      assert(ALLOWED[ext].includes(mime) || mime === "application/octet-stream", "MIME \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u044E", "VALIDATION");
      total += file.size;
      return { name: filename, size: file.size, type: ALLOWED[ext][0] };
    });
    assert(total <= limit, "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u0441\u0443\u043C\u043C\u0430\u0440\u043D\u044B\u0439 \u043B\u0438\u043C\u0438\u0442 \u0444\u0430\u0439\u043B\u043E\u0432", "QUOTA");
    return { files: result, total };
  }
  function validateBytes(meta, bytes) {
    assert(bytes.length === meta.size, "\u0420\u0430\u0437\u043C\u0435\u0440 \u043F\u0440\u0438\u043D\u044F\u0442\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u043B", "VALIDATION");
    const ext = meta.name.split(".").pop().toLowerCase();
    const starts = (prefix) => prefix.every((v, i) => (bytes[i] + 256) % 256 === v);
    if (ext === "pdf") assert(starts([37, 80, 68, 70, 45]), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0438\u0433\u043D\u0430\u0442\u0443\u0440\u0430 PDF", "VALIDATION");
    if (ext === "png") assert(starts([137, 80, 78, 71, 13, 10, 26, 10]), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0438\u0433\u043D\u0430\u0442\u0443\u0440\u0430 PNG", "VALIDATION");
    if (["jpg", "jpeg"].includes(ext)) assert(starts([255, 216, 255]), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0438\u0433\u043D\u0430\u0442\u0443\u0440\u0430 JPEG", "VALIDATION");
    if (["zip", "docx", "xlsx", "pptx"].includes(ext)) assert(starts([80, 75, 3, 4]) || starts([80, 75, 5, 6]), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0438\u0433\u043D\u0430\u0442\u0443\u0440\u0430 ZIP/Office", "VALIDATION");
    if (ext === "txt") assert(!bytes.includes(0), "TXT \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0431\u0438\u043D\u0430\u0440\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435", "VALIDATION");
  }
  function quotaCheck(quota, used, replaced, reserved, total) {
    assert(used - replaced + reserved + total <= quota, "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043C\u0435\u0441\u0442\u0430. \u0423\u0434\u0430\u043B\u0438\u0442\u0435 \u0444\u0430\u0439\u043B\u044B \u0441\u0442\u0430\u0440\u044B\u0445 \u0440\u0430\u0431\u043E\u0442", "QUOTA");
  }
  function expired(file, now) {
    const deadline = new Date(file.created_at);
    deadline.setUTCFullYear(deadline.getUTCFullYear() + 2);
    return deadline.getTime() <= new Date(now).getTime();
  }

  // server/repository.js
  function ensureSheetRows(sheet, required) {
    const available = sheet.getMaxRows();
    if (required > available) sheet.insertRowsAfter(available, Math.max(500, required - available));
  }
  var SCHEMA = {
    Users: ["id", "full_name", "login", "role", "group_id", "subgroup", "status", "quota_bytes", "password_hash", "salt", "iterations", "must_change_password", "created_at"],
    UserIntake: ["id", "full_name", "login", "role", "group_id", "subgroup", "status", "error"],
    Groups: ["id", "name", "active"],
    TeacherAccess: ["id", "teacher_id", "group_id", "subgroup", "active"],
    Assignments: ["id", "teacher_id", "title", "description", "instructions", "targets", "due_at", "late_policy", "publication_status", "material_generation", "version", "created_at", "updated_at"],
    Materials: ["id", "assignment_id", "owner_id", "generation", "drive_id", "name", "type", "size", "created_at", "deleted_at", "delete_pending"],
    Submissions: ["id", "assignment_id", "student_id", "status", "started_at", "submitted_at", "is_late", "generation", "attempts", "grade", "feedback", "reviewer_id", "reviewed_at", "group_at_submission", "subgroup_at_submission", "files_deleted"],
    SubmissionFiles: ["id", "submission_id", "assignment_id", "owner_id", "generation", "drive_id", "name", "type", "size", "created_at", "deleted_at", "delete_pending"],
    Sessions: ["id", "user_id", "token_hash", "issued_at", "expires_at", "revoked_at"],
    LoginAttempts: ["id", "count", "window_at", "blocked_until"],
    UploadReservations: ["id", "user_id", "assignment_id", "kind", "manifest", "total", "replaced_bytes", "started_at", "expires_at", "status", "generation", "base_generation", "base_version", "idempotency_key", "result", "file_ids", "error"],
    Audit: ["id", "actor_id", "action", "entity_id", "at", "details"],
    Settings: ["id", "value"]
  };
  var SheetRepository = class {
    constructor(id) {
      this.book = SpreadsheetApp.openById(id);
      this.cache = {};
    }
    sheet(table) {
      assert(SCHEMA[table], "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430", "INTERNAL");
      const sheet = this.book.getSheetByName(table);
      assert(sheet, "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 setup_", "CONFIG");
      const headers = sheet.getRange(1, 1, 1, SCHEMA[table].length).getValues()[0];
      assert(JSON.stringify(headers) === JSON.stringify(SCHEMA[table]), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0445\u0435\u043C\u0430 \u043B\u0438\u0441\u0442\u0430 " + table, "CONFIG");
      return sheet;
    }
    all(table) {
      if (this.cache[table]) return this.cache[table];
      const sheet = this.sheet(table);
      const count = sheet.getLastRow() - 1;
      const rows = count ? sheet.getRange(2, 1, count, SCHEMA[table].length).getValues() : [];
      this.cache[table] = rows.filter((r) => r[0] !== "").map((row) => Object.fromEntries(SCHEMA[table].map((key, i) => {
        try {
          return [key, row[i] === "" ? null : JSON.parse(String(row[i]))];
        } catch {
          throw new Error("\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u0444\u043E\u0440\u043C\u0430\u0442 \u043B\u0438\u0441\u0442\u0430 " + table);
        }
      })));
      return this.cache[table];
    }
    get(table, id) {
      return this.all(table).find((row) => row.id === id);
    }
    put(table, record) {
      const rows = this.all(table);
      const index = rows.findIndex((row2) => row2.id === record.id);
      const next = { ...index >= 0 ? rows[index] : {}, ...record };
      const cells = SCHEMA[table].map((key) => JSON.stringify(next[key] ?? null));
      const sheet = this.sheet(table), row = index >= 0 ? index + 2 : rows.length + 2;
      ensureSheetRows(sheet, row);
      sheet.getRange(row, 1, 1, cells.length).setValues([cells]);
      if (index >= 0) rows[index] = next;
      else rows.push(next);
      return next;
    }
    refresh() {
      this.cache = {};
    }
    writeEmptyTable(table, records) {
      assert(this.all(table).length === 0, "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043F\u0443\u0441\u0442\u043E\u0439 \u043B\u0438\u0441\u0442", "BACKUP");
      if (records.length) {
        const sheet = this.sheet(table);
        ensureSheetRows(sheet, records.length + 1);
        sheet.getRange(2, 1, records.length, SCHEMA[table].length).setValues(records.map((record) => SCHEMA[table].map((key) => JSON.stringify(record[key] ?? null))));
      }
      delete this.cache[table];
    }
    normalizeIntake() {
      const sheet = this.sheet("UserIntake"), count = sheet.getLastRow() - 1;
      if (count <= 0) return;
      const rows = sheet.getRange(2, 1, count, SCHEMA.UserIntake.length).getValues();
      const decode = (value) => {
        try {
          return JSON.parse(String(value));
        } catch {
          return value;
        }
      };
      const normalized = rows.map((row) => {
        const values = row.map(decode);
        if (values.every((v) => v === "" || v === null)) return row;
        if (!values[0]) values[0] = Utilities.getUuid();
        return values.map((v) => JSON.stringify(v === "" ? null : v));
      });
      sheet.getRange(2, 1, count, SCHEMA.UserIntake.length).setValues(normalized);
      delete this.cache.UserIntake;
    }
    lock(fn) {
      const lock = LockService.getScriptLock();
      assert(lock.tryLock(15e3), "\u0421\u0435\u0440\u0432\u0435\u0440 \u0437\u0430\u043D\u044F\u0442. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441", "BUSY");
      try {
        this.refresh();
        return fn();
      } finally {
        lock.releaseLock();
      }
    }
  };
  function initializeSheets(id) {
    const book = SpreadsheetApp.openById(id);
    for (const [table, columns] of Object.entries(SCHEMA)) {
      const sheet = book.getSheetByName(table) || book.insertSheet(table);
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
        sheet.setFrozenRows(1);
      }
    }
  }

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
  }
  function anumber(n, title = "") {
    if (!Number.isSafeInteger(n) || n < 0) {
      const prefix = title && `"${title}" `;
      throw new Error(`${prefix}expected integer >= 0, got ${n}`);
    }
  }
  function abytes(value, length, title = "") {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== void 0;
    if (!bytes || needsLen && len !== length) {
      const prefix = title && `"${title}" `;
      const ofLen = needsLen ? ` of length ${length}` : "";
      const got = bytes ? `length=${len}` : `type=${typeof value}`;
      throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
    }
    return value;
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new Error("Hash must wrapped by utils.createHasher");
    anumber(h.outputLen);
    anumber(h.blockLen);
  }
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "digestInto() output");
    const min = instance.outputLen;
    if (out.length < min) {
      throw new Error('"digestInto() output" expected to be of length >=' + min);
    }
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new Error("string expected");
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function kdfInputToBytes(data, errorTitle = "") {
    if (typeof data === "string")
      return utf8ToBytes(data);
    return abytes(data, void 0, errorTitle);
  }
  function checkOpts(defaults, opts) {
    if (opts !== void 0 && {}.toString.call(opts) !== "[object Object]")
      throw new Error("options must be object or undefined");
    const merged = Object.assign(defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  var oidNist = (suffix) => ({
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/hashes/hmac.js
  var _HMAC = class {
    constructor(hash, key) {
      __publicField(this, "oHash");
      __publicField(this, "iHash");
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "finished", false);
      __publicField(this, "destroyed", false);
      ahash(hash);
      abytes(key, void 0, "key");
      this.iHash = hash.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("Expected instance of class which extends utils.Hash");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad = new Uint8Array(blockLen);
      pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54;
      this.iHash.update(pad);
      this.oHash = hash.create();
      for (let i = 0; i < pad.length; i++)
        pad[i] ^= 54 ^ 92;
      this.oHash.update(pad);
      clean(pad);
    }
    update(buf) {
      aexists(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      aexists(this);
      abytes(out, this.outputLen, "output");
      this.finished = true;
      this.iHash.digestInto(out);
      this.oHash.update(out);
      this.oHash.digestInto(out);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to || (to = Object.create(Object.getPrototypeOf(this), {}));
      const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  };
  var hmac = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
  hmac.create = (hash, key) => new _HMAC(hash, key);

  // node_modules/@noble/hashes/pbkdf2.js
  function pbkdf2Init(hash, _password, _salt, _opts) {
    ahash(hash);
    const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
    const { c, dkLen, asyncTick } = opts;
    anumber(c, "c");
    anumber(dkLen, "dkLen");
    anumber(asyncTick, "asyncTick");
    if (c < 1)
      throw new Error("iterations (c) must be >= 1");
    const password = kdfInputToBytes(_password, "password");
    const salt = kdfInputToBytes(_salt, "salt");
    const DK = new Uint8Array(dkLen);
    const PRF = hmac.create(hash, password);
    const PRFSalt = PRF._cloneInto().update(salt);
    return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
  }
  function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
    PRF.destroy();
    PRFSalt.destroy();
    if (prfW)
      prfW.destroy();
    clean(u);
    return DK;
  }
  function pbkdf2(hash, password, salt, opts) {
    const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts);
    let prfW;
    const arr = new Uint8Array(4);
    const view = createView(arr);
    const u = new Uint8Array(PRF.outputLen);
    for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
      const Ti = DK.subarray(pos, pos + PRF.outputLen);
      view.setInt32(0, ti, false);
      (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
      Ti.set(u.subarray(0, Ti.length));
      for (let ui = 1; ui < c; ui++) {
        PRF._cloneInto(prfW).update(u).digestInto(u);
        for (let i = 0; i < Ti.length; i++)
          Ti[i] ^= u[i];
      }
    }
    return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
  }

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    constructor(blockLen, outputLen, padOffset, isLE) {
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "padOffset");
      __publicField(this, "isLE");
      // For partial updates less than block size
      __publicField(this, "buffer");
      __publicField(this, "view");
      __publicField(this, "finished", false);
      __publicField(this, "length", 0);
      __publicField(this, "pos", 0);
      __publicField(this, "destroyed", false);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
        }
      }
      this.length += data.length;
      this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      clean(this.buffer.subarray(pos));
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        pos = 0;
      }
      for (let i = pos; i < blockLen; i++)
        buffer[i] = 0;
      view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
      this.process(view, 0);
      const oview = createView(out);
      const len = this.outputLen;
      if (len % 4)
        throw new Error("_sha2: outputLen must be aligned to 32bit");
      const outLen = len / 4;
      const state = this.get();
      if (outLen > state.length)
        throw new Error("_sha2: outputLen bigger than state");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      to || (to = new this.constructor());
      to.set(...this.get());
      const { blockLen, buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (length % blockLen)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    constructor(outputLen) {
      super(64, outputLen, 8, false);
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32);
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      __publicField(this, "A", SHA256_IV[0] | 0);
      __publicField(this, "B", SHA256_IV[1] | 0);
      __publicField(this, "C", SHA256_IV[2] | 0);
      __publicField(this, "D", SHA256_IV[3] | 0);
      __publicField(this, "E", SHA256_IV[4] | 0);
      __publicField(this, "F", SHA256_IV[5] | 0);
      __publicField(this, "G", SHA256_IV[6] | 0);
      __publicField(this, "H", SHA256_IV[7] | 0);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );

  // server/auth.js
  var utf8 = (value) => {
    const result = [];
    for (const ch of value) {
      let cp = ch.codePointAt(0);
      if (cp >= 55296 && cp <= 57343) cp = 65533;
      if (cp < 128) result.push(cp);
      else if (cp < 2048) result.push(192 | cp >> 6, 128 | cp & 63);
      else if (cp < 65536) result.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63);
      else result.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63);
    }
    return new Uint8Array(result);
  };
  var hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
  var digest = (value) => hex(sha256(utf8(value)));
  function safeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return difference === 0;
  }
  function passwordRecord(password, salt, iterations = 6e5) {
    assert(
      typeof password === "string" && password.length >= 10 && password.length <= 128,
      "\u041F\u0430\u0440\u043E\u043B\u044C \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043E\u0442 10 \u0434\u043E 128 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432",
      "VALIDATION"
    );
    return { salt, iterations, password_hash: hex(pbkdf2(sha256, utf8(password), utf8(salt), { c: iterations, dkLen: 32 })) };
  }
  function publicUser(user) {
    const { id, full_name, login: login2, role, group_id, subgroup, status, quota_bytes, must_change_password } = user;
    return { id, full_name, login: login2, role, group_id, subgroup, status, quota_bytes, must_change_password };
  }
  var Auth = class {
    constructor(repo, secret, now, uuid) {
      assert(secret?.length >= 43, "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 AUTH_SECRET (32 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0445 \u0431\u0430\u0439\u0442\u0430 \u0432 base64)", "CONFIG");
      this.repo = repo;
      this.secret = secret;
      this.now = now;
      this.uuid = uuid;
    }
    random() {
      return hex(hmac(sha256, utf8(this.secret), utf8(this.uuid() + ":" + this.now() + ":" + this.uuid())));
    }
    session(user) {
      const token = this.random();
      const at = this.now();
      this.repo.put("Sessions", {
        id: this.uuid(),
        user_id: user.id,
        token_hash: digest(token),
        issued_at: at,
        expires_at: new Date(Date.parse(at) + 8 * 36e5).toISOString(),
        revoked_at: null
      });
      return { token, user: publicUser(user) };
    }
    actor(token, allowPasswordChange = false) {
      assert(typeof token === "string" && token.length === 64, "\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0441\u043D\u043E\u0432\u0430", "UNAUTHORIZED");
      const hash = digest(token);
      const session = this.repo.all("Sessions").find((s) => safeEqual(s.token_hash, hash));
      const user = session && this.repo.get("Users", session.user_id);
      assert(session && !session.revoked_at && session.expires_at > this.now() && user?.status === "active", "\u0421\u0435\u0441\u0441\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u0441\u043D\u043E\u0432\u0430", "UNAUTHORIZED");
      assert(allowPasswordChange || !user.must_change_password, "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043C\u0435\u043D\u0438\u0442\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C", "PASSWORD_CHANGE");
      return user;
    }
    revoke(userId) {
      for (const s of this.repo.all("Sessions").filter((s2) => s2.user_id === userId && !s2.revoked_at)) this.repo.put("Sessions", { ...s, revoked_at: this.now() });
    }
    signIn(rawLogin, password) {
      const normalized = login(rawLogin);
      assert(typeof password === "string" && password.length <= 128, "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C", "UNAUTHORIZED");
      const attemptId = digest(normalized);
      this.repo.lock(() => {
        const global = this.repo.get("LoginAttempts", "__global");
        const globalFresh = !global || Date.parse(this.now()) - Date.parse(global.window_at) > 9e5;
        assert(globalFresh || global.count < 120, "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A \u0432\u0445\u043E\u0434\u0430. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0437\u0436\u0435", "RATE_LIMIT");
        this.repo.put("LoginAttempts", { id: "__global", count: globalFresh ? 1 : global.count + 1, window_at: globalFresh ? this.now() : global.window_at });
        const previous = this.repo.get("LoginAttempts", attemptId);
        assert(!previous?.blocked_until || previous.blocked_until <= this.now(), "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 15 \u043C\u0438\u043D\u0443\u0442", "RATE_LIMIT");
        const fresh = !previous || Date.parse(this.now()) - Date.parse(previous.window_at) > 9e5;
        const count = fresh ? 1 : previous.count + 1;
        this.repo.put("LoginAttempts", {
          id: attemptId,
          count,
          window_at: fresh ? this.now() : previous.window_at,
          blocked_until: count >= 8 ? new Date(Date.parse(this.now()) + 9e5).toISOString() : null
        });
      });
      const user = this.repo.all("Users").find((u) => u.login === normalized);
      const hash = passwordRecord(password.length >= 10 ? password : password.padEnd(10, " "), user?.salt || digest(this.secret + "dummy"), user?.iterations || 6e5).password_hash;
      const valid = !!user && user.status === "active" && safeEqual(hash, user.password_hash) && password.length >= 10;
      return this.repo.lock(() => {
        const current = user && this.repo.get("Users", user.id);
        this.repo.put("Audit", { id: this.uuid(), actor_id: valid ? user.id : null, action: valid ? "login" : "login_failed", at: this.now(), details: { login_fingerprint: attemptId } });
        assert(valid && current?.status === "active" && current.password_hash === user.password_hash, "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C", "UNAUTHORIZED");
        this.repo.put("LoginAttempts", { id: attemptId, count: 0, window_at: this.now(), blocked_until: null });
        return this.session(current);
      });
    }
    createUser(input, password) {
      const role = input.role;
      assert(["student", "teacher", "admin"].includes(role), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0440\u043E\u043B\u044C", "VALIDATION");
      const userLogin = login(input.login);
      assert(userLogin.length >= 3, "\u041B\u043E\u0433\u0438\u043D \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439", "VALIDATION");
      const fullName = text(input.full_name, 160);
      assert(fullName.length > 0, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0424\u0418\u041E", "VALIDATION");
      assert(!this.repo.all("Users").some((u) => u.login === userLogin), "\u041B\u043E\u0433\u0438\u043D \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442", "VALIDATION");
      if (role === "student") {
        assert(this.repo.get("Groups", input.group_id)?.active, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u043A\u0442\u0438\u0432\u043D\u0443\u044E \u0433\u0440\u0443\u043F\u043F\u0443", "VALIDATION");
        assert([1, 2].includes(Number(input.subgroup)), "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0443 1 \u0438\u043B\u0438 2", "VALIDATION");
      }
      const record = passwordRecord(password, this.random());
      return this.repo.put("Users", {
        id: this.uuid(),
        full_name: fullName,
        login: userLogin,
        role,
        group_id: role === "student" ? input.group_id : null,
        subgroup: role === "student" ? Number(input.subgroup) : null,
        status: "active",
        quota_bytes: role === "student" ? 125 * MiB : 250 * MiB,
        ...record,
        must_change_password: true,
        created_at: this.now()
      });
    }
  };

  // server/drive.js
  function ensureStorageRoot(properties) {
    let id = properties.getProperty("DRIVE_ROOT_ID");
    if (!id) {
      id = DriveApp.createFolder("Practicus_Private_Storage").getId();
      properties.setProperty("DRIVE_ROOT_ID", id);
    }
    return id;
  }
  var PrivateDrive = class {
    constructor(properties) {
      this.props = properties;
      this.token = null;
    }
    get(key) {
      const value = this.props.getProperty(key);
      assert(value, "\u041D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D " + key, "CONFIG");
      return value;
    }
    accessToken() {
      if (this.token) return this.token;
      this.token = ScriptApp.getOAuthToken();
      assert(this.token, "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u044F Drive \u0432 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F", "STORAGE");
      return this.token;
    }
    request(path, options = {}) {
      const response = UrlFetchApp.fetch("https://www.googleapis.com/" + path, {
        ...options,
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + this.accessToken(), ...options.headers }
      });
      assert(response.getResponseCode() >= 200 && response.getResponseCode() < 300, "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u043E\u0433\u043E \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430 (" + response.getResponseCode() + ")", "STORAGE");
      return response;
    }
    check() {
      const account = JSON.parse(this.request("drive/v3/about?fields=user,storageQuota").getContentText());
      const root = JSON.parse(this.request("drive/v3/files/" + encodeURIComponent(this.get("DRIVE_ROOT_ID")) + "?fields=id,mimeType,ownedByMe,trashed,permissions(type,role)").getContentText());
      assert(root.ownedByMe && !root.trashed && root.mimeType === "application/vnd.google-apps.folder", "\u041A\u043E\u0440\u043D\u0435\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0443, \u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0432\u0448\u0435\u043C\u0443 Apps Script", "CONFIG");
      assert(!root.permissions?.some((p) => ["anyone", "domain"].includes(p.type)), "\u0423\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0439 \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043F\u0430\u043F\u043A\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0430", "CONFIG");
      return { storageQuota: account.storageQuota, owner: account.user.emailAddress };
    }
    create(blob, id, meta) {
      const response = this.request("upload/drive/v3/files?uploadType=resumable&fields=id,size,createdTime", {
        method: "post",
        contentType: "application/json",
        headers: { "X-Upload-Content-Type": meta.type, "X-Upload-Content-Length": String(meta.size) },
        payload: JSON.stringify({ name: "file_" + id + "__" + meta.name, parents: [this.get("DRIVE_ROOT_ID")], appProperties: { practicusFile: id } })
      });
      const headers = response.getAllHeaders();
      const location = headers.Location || headers.location;
      assert(typeof location === "string" && location.startsWith("https://www.googleapis.com/"), "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 Drive", "STORAGE");
      const uploaded = UrlFetchApp.fetch(location, {
        method: "put",
        contentType: meta.type,
        payload: blob,
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + this.accessToken() }
      });
      assert(uploaded.getResponseCode() >= 200 && uploaded.getResponseCode() < 300, "Drive \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443", "STORAGE");
      const result = JSON.parse(uploaded.getContentText());
      assert(Number(result.size) === meta.size, "Drive \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u043B \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0440\u0430\u0437\u043C\u0435\u0440", "STORAGE");
      return { drive_id: result.id, created_at: result.createdTime };
    }
    remove(driveId) {
      const response = UrlFetchApp.fetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveId),
        { method: "delete", muteHttpExceptions: true, headers: { Authorization: "Bearer " + this.accessToken() } }
      );
      assert([204, 404, 410].includes(response.getResponseCode()), "\u0424\u0430\u0439\u043B \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0433\u043E \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F", "STORAGE");
    }
    findByLogicalId(id) {
      assert(/^[a-zA-Z0-9-]+$/.test(id), "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 ID", "VALIDATION");
      const query = "trashed = false and appProperties has { key='practicusFile' and value='" + id + "' }";
      const result = JSON.parse(this.request("drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,size,createdTime)&pageSize=100").getContentText());
      return result.files || [];
    }
    chunk(driveId, offset, size) {
      const response = this.request(
        "drive/v3/files/" + encodeURIComponent(driveId) + "?alt=media",
        { headers: { Range: "bytes=" + offset + "-" + (offset + size - 1) } }
      );
      const bytes = response.getContent();
      assert(bytes.length <= size, "Drive \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0430\u043B \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u044B\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u044F", "STORAGE");
      return Utilities.base64Encode(bytes);
    }
  };

  // server/service.js
  function createService({ repo, auth, storage, now, uuid, settings, backups }) {
    const requireAvailable = () => assert(!settings.isMaintenance?.(), "\u0412\u0435\u0434\u0443\u0442\u0441\u044F \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0440\u0430\u0431\u043E\u0442\u044B. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u0437\u0436\u0435", "MAINTENANCE");
    const audit = (actor, action, id, details = {}) => repo.put("Audit", { id: uuid(), actor_id: actor?.id || "system", action, entity_id: id, at: now(), details });
    const submission = (assignmentId, studentId) => repo.all("Submissions").find((s) => s.assignment_id === assignmentId && s.student_id === studentId);
    const getAssignment = (id) => {
      const a = repo.get("Assignments", id);
      assert(a, "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", "NOT_FOUND");
      return a;
    };
    const requireAdmin = (u) => assert(u.role === "admin");
    const requireTeacher = (u, a) => assert(u.role === "admin" || u.role === "teacher" && a.teacher_id === u.id);
    const tableFor = (r) => r.kind === "submission" ? "SubmissionFiles" : "Materials";
    const allFiles = () => [...repo.all("SubmissionFiles").map((f) => ({ ...f, table: "SubmissionFiles" })), ...repo.all("Materials").map((f) => ({ ...f, table: "Materials" }))];
    const isCurrent = (f) => f.table === "Materials" ? repo.get("Assignments", f.assignment_id)?.material_generation === f.generation : repo.get("Submissions", f.submission_id)?.generation === f.generation;
    const currentFiles = () => allFiles().filter((f) => !f.deleted_at && f.drive_id && isCurrent(f));
    const used = (u) => currentFiles().filter((f) => f.owner_id === u.id).reduce((sum, f) => sum + f.size, 0);
    const publicFile = ({ id, name: name2, type, size, created_at, deleted_at }) => ({ id, name: name2, type, size, created_at, deleted_at });
    const filesFor = (s) => s ? currentFiles().filter((f) => f.submission_id === s.id).map(publicFile) : [];
    const studentView = (u, a) => {
      const s = submission(a.id, u.id);
      const assigned = studentAccess(u, a, s);
      const archived = a.publication_status === "archived";
      if (archived) return { id: a.id, title: a.title, publication_status: "archived", assigned: false, description: "", instructions: "", materials: [], due_at: null, submission: s ? { grade: s.grade } : null };
      return {
        id: a.id,
        title: a.title,
        teacher_name: repo.get("Users", a.teacher_id)?.full_name || "\u041F\u0440\u0435\u043F\u043E\u0434\u0430\u0432\u0430\u0442\u0435\u043B\u044C",
        description: assigned ? a.description : "",
        instructions: assigned ? a.instructions : "",
        due_at: a.due_at,
        late_policy: a.late_policy,
        publication_status: a.publication_status,
        version: a.version,
        created_at: a.created_at,
        assigned,
        submission: s ? archived ? { grade: s.grade } : {
          id: s.id,
          status: s.status,
          grade: s.grade,
          feedback: s.feedback,
          submitted_at: s.submitted_at,
          started_at: s.started_at,
          is_late: s.is_late,
          generation: s.generation,
          files_deleted: s.files_deleted,
          files: filesFor(s)
        } : null,
        materials: assigned ? currentFiles().filter((f) => f.table === "Materials" && f.assignment_id === a.id).map(publicFile) : []
      };
    };
    function checkFileAccess(u, f) {
      assert(f && !f.deleted_at && f.drive_id, "\u0424\u0430\u0439\u043B \u0443\u0434\u0430\u043B\u0451\u043D \u0438\u043B\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D", "NOT_FOUND");
      if (u.role === "admin") return;
      assert(isCurrent(f), "\u0412\u0435\u0440\u0441\u0438\u044F \u0444\u0430\u0439\u043B\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430");
      const a = getAssignment(f.assignment_id);
      if (f.table === "SubmissionFiles") {
        const s = repo.get("Submissions", f.submission_id);
        const student = repo.get("Users", s.student_id);
        assert(u.id === s.student_id && studentAccess(u, a, s, "own") || canTeach(u, a, student, repo.all("TeacherAccess")));
      } else {
        assert(u.role === "student" && studentAccess(u, a, submission(a.id, u.id)) || u.role === "teacher" && a.teacher_id === u.id && teacherScope(u, a.targets, repo.all("TeacherAccess")));
      }
    }
    function reviewRows(u, a) {
      requireTeacher(u, a);
      return repo.all("Users").filter((s) => s.role === "student" && (a.targets.some((t) => sameGroup(s, t)) || !!submission(a.id, s.id)) && (u.role === "admin" || canTeach(u, a, s, repo.all("TeacherAccess")))).map((s) => {
        const answer = submission(a.id, s.id);
        return { student: publicUser(s), submission: answer ? { ...answer, files: filesFor(answer) } : null };
      });
    }
    function visibleAssignments(u) {
      return repo.all("Assignments").filter((a) => {
        if (u.role === "admin") return true;
        if (u.role === "teacher") return a.teacher_id === u.id;
        const s = submission(a.id, u.id);
        return studentAccess(u, a, s) || studentAccess(u, a, s, "own") || studentAccess(u, a, s, "grade");
      }).map((a) => {
        if (u.role === "student") return studentView(u, a);
        const rows = reviewRows(u, a);
        return {
          ...a,
          materials: currentFiles().filter((f) => f.table === "Materials" && f.assignment_id === a.id).map(publicFile),
          teacher_name: repo.get("Users", a.teacher_id)?.full_name,
          stats: {
            total: rows.length,
            submitted: rows.filter((r) => r.submission).length,
            pending: rows.filter((r) => r.submission?.status === "pending_review").length,
            accepted: rows.filter((r) => r.submission?.status === "accepted").length,
            late: rows.filter((r) => r.submission?.is_late || !r.submission && a.due_at && a.due_at < now()).length
          }
        };
      });
    }
    function reserve(u, p) {
      assert(settings.uploadsEnabled || u.role === "admin" && p.kind === "spike", "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C", "UPLOADS_DISABLED");
      assert(["submission", "materials", "spike"].includes(p.kind), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u044F", "VALIDATION");
      const manifest = validateManifest(p.files, settings.fileLimit || LIMIT);
      const key = text(p.idempotency_key, 100);
      assert(key.length >= 16, "\u041D\u0443\u0436\u0435\u043D \u043A\u043B\u044E\u0447 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438", "VALIDATION");
      const previous = repo.all("UploadReservations").find((r2) => r2.user_id === u.id && r2.idempotency_key === key);
      if (previous) {
        assert(previous.assignment_id === (p.assignment_id || "__spike") && previous.kind === p.kind && JSON.stringify(previous.manifest) === JSON.stringify(manifest.files), "\u041A\u043B\u044E\u0447 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u043E\u0439 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0435\u0439", "CONFLICT");
        return { id: previous.id, status: previous.status, result: previous.result, started_at: previous.started_at };
      }
      let a, old, baseGeneration = null;
      if (p.kind === "submission") {
        a = getAssignment(p.assignment_id);
        old = submission(a.id, u.id);
        checkSubmit(u, a, old, now());
        baseGeneration = old?.generation || null;
      } else if (p.kind === "materials") {
        a = getAssignment(p.assignment_id);
        requireTeacher(u, a);
        assert(u.role === "admin" || teacherScope(u, a.targets, repo.all("TeacherAccess")));
        old = a;
        baseGeneration = a.material_generation || null;
      } else requireAdmin(u);
      const assignmentId = a?.id || "__spike";
      const active = repo.all("UploadReservations").filter((r2) => r2.expires_at > now() && ["reserved", "receiving"].includes(r2.status));
      assert(!active.some((r2) => r2.user_id === u.id && r2.assignment_id === assignmentId), "\u0423\u0436\u0435 \u0438\u0434\u0451\u0442 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0432 \u044D\u0442\u043E \u0437\u0430\u0434\u0430\u043D\u0438\u0435", "CONFLICT");
      const replaced = currentFiles().filter((f) => f.owner_id === u.id && f.assignment_id === assignmentId && (p.kind === "materials" ? f.table === "Materials" : f.table === "SubmissionFiles")).reduce((sum, f) => sum + f.size, 0);
      const reserved = active.filter((r2) => r2.user_id === u.id).reduce((sum, r2) => sum + Math.max(0, r2.total - r2.replaced_bytes), 0);
      quotaCheck(u.quota_bytes, used(u), replaced, reserved, manifest.total);
      const r = {
        id: uuid(),
        user_id: u.id,
        assignment_id: assignmentId,
        kind: p.kind,
        manifest: manifest.files,
        total: manifest.total,
        replaced_bytes: replaced,
        started_at: now(),
        expires_at: new Date(Date.parse(now()) + 12e4).toISOString(),
        status: "reserved",
        generation: uuid(),
        base_generation: baseGeneration,
        base_version: a?.version || null,
        idempotency_key: key,
        result: null,
        file_ids: []
      };
      repo.put("UploadReservations", r);
      audit(u, "upload_reserved", r.id, { kind: p.kind, total: r.total });
      return { id: r.id, status: r.status, started_at: r.started_at };
    }
    function recoverCommitted(r) {
      if (r.kind === "submission") {
        const s = submission(r.assignment_id, r.user_id);
        if (s?.generation === r.generation) return { submission_id: s.id, generation: s.generation, status: s.status, submitted_at: s.submitted_at, is_late: s.is_late };
      } else if (r.kind === "materials" && repo.get("Assignments", r.assignment_id)?.material_generation === r.generation) return { saved: true };
      return null;
    }
    function upload(token, reservationId, blobs) {
      let r, u;
      const early = repo.lock(() => {
        requireAvailable();
        u = auth.actor(token);
        r = repo.get("UploadReservations", reservationId);
        assert(r && r.user_id === u.id, "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430");
        const recovered = recoverCommitted(r);
        if (r.status === "committed" || recovered) {
          if (recovered && r.status !== "committed") repo.put("UploadReservations", { ...r, status: "committed", result: recovered });
          return r.result || recovered;
        }
        assert(r.status === "reserved", "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0443\u0436\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0438\u043B\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u043E\u0448\u0438\u0431\u043A\u043E\u0439", "CONFLICT");
        assert(r.expires_at >= now(), "\u0412\u0440\u0435\u043C\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438\u0441\u0442\u0435\u043A\u043B\u043E. \u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0437\u0430\u043D\u043E\u0432\u043E", "TIMEOUT");
        assert(settings.uploadsEnabled || u.role === "admin" && r.kind === "spike", "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430", "UPLOADS_DISABLED");
        r = repo.put("UploadReservations", { ...r, status: "receiving", file_ids: r.manifest.map(() => uuid()) });
        return null;
      });
      if (early) return early;
      try {
        assert(blobs.length === r.manifest.length, "\u041F\u043E\u043B\u0443\u0447\u0435\u043D \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442", "VALIDATION");
        blobs.forEach((blob, i) => validateBytes(r.manifest[i], blob.getBytes()));
        const fileTable = tableFor(r);
        for (let i = 0; i < blobs.length; i++) {
          assert(now() <= r.expires_at, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u0435\u0432\u044B\u0441\u0438\u043B\u0430 \u0434\u0432\u0435 \u043C\u0438\u043D\u0443\u0442\u044B", "TIMEOUT");
          const meta = r.manifest[i];
          repo.lock(() => repo.put(fileTable, {
            id: r.file_ids[i],
            assignment_id: r.assignment_id,
            owner_id: u.id,
            generation: r.generation,
            name: meta.name,
            type: meta.type,
            size: meta.size,
            drive_id: null,
            created_at: now(),
            deleted_at: null,
            delete_pending: false
          }));
          const saved = storage.create(blobs[i], r.file_ids[i], meta);
          repo.lock(() => repo.put(fileTable, { id: r.file_ids[i], ...saved }));
        }
        return repo.lock(() => {
          requireAvailable();
          u = auth.actor(token);
          r = repo.get("UploadReservations", r.id);
          assert(r.status === "receiving", "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430", "CONFLICT");
          assert(now() <= r.expires_at, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043F\u0440\u0435\u0432\u044B\u0441\u0438\u043B\u0430 \u0434\u0432\u0435 \u043C\u0438\u043D\u0443\u0442\u044B", "TIMEOUT");
          const replacement = currentFiles().filter((f) => f.owner_id === u.id && f.assignment_id === r.assignment_id && (r.kind === "materials" ? f.table === "Materials" : f.table === "SubmissionFiles")).reduce((n, f) => n + f.size, 0);
          const otherReserved = repo.all("UploadReservations").filter((o) => o.id !== r.id && o.user_id === u.id && o.expires_at > now() && ["reserved", "receiving"].includes(o.status)).reduce((n, o) => n + Math.max(0, o.total - o.replaced_bytes), 0);
          quotaCheck(u.quota_bytes, used(u), replacement, otherReserved, r.total);
          let result;
          if (r.kind === "submission") {
            const a = getAssignment(r.assignment_id);
            const old = submission(a.id, u.id);
            assert((old?.generation || null) === r.base_generation, "\u0420\u0430\u0431\u043E\u0442\u0430 \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0430", "CONFLICT");
            const late = checkSubmit(u, a, old, r.started_at);
            const id = old?.id || uuid();
            for (const fileId of r.file_ids) repo.put(fileTable, { id: fileId, submission_id: id });
            const s = repo.put("Submissions", {
              id,
              assignment_id: a.id,
              student_id: u.id,
              status: "pending_review",
              started_at: r.started_at,
              submitted_at: now(),
              is_late: late,
              generation: r.generation,
              attempts: (old?.attempts || 0) + 1,
              grade: null,
              feedback: "",
              reviewer_id: null,
              reviewed_at: null,
              group_at_submission: u.group_id,
              subgroup_at_submission: u.subgroup,
              files_deleted: false
            });
            result = { submission_id: s.id, generation: s.generation, status: s.status, submitted_at: s.submitted_at, is_late: s.is_late };
            audit(u, "submission_saved", s.id, { generation: s.generation, previous_grade: old?.grade ?? null, attempt: s.attempts });
          } else if (r.kind === "materials") {
            const a = getAssignment(r.assignment_id);
            requireTeacher(u, a);
            assert(u.role === "admin" || teacherScope(u, a.targets, repo.all("TeacherAccess")));
            assert((a.material_generation || null) === r.base_generation && a.version === r.base_version, "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443", "CONFLICT");
            repo.put("Assignments", { ...a, material_generation: r.generation, version: a.version + 1, updated_at: now() });
            audit(u, "materials_saved", a.id, { generation: r.generation });
            result = { saved: true };
          } else {
            requireAdmin(u);
            result = { files: r.file_ids.map((id) => publicFile(repo.get(fileTable, id))) };
            audit(u, "spike_upload", r.id, { total: r.total });
          }
          repo.put("UploadReservations", { ...r, status: "committed", result });
          return result;
        });
      } catch (error) {
        repo.lock(() => {
          const current = repo.get("UploadReservations", r.id);
          const recovered = recoverCommitted(current);
          repo.put("UploadReservations", { ...current, status: recovered ? "committed" : "failed", result: recovered, error: recovered ? null : error.code || "INTERNAL" });
          if (!recovered) {
            for (const id of r.file_ids) if (repo.get(tableFor(r), id)) repo.put(tableFor(r), { id, deleted_at: now(), delete_pending: true });
          }
        });
        throw error;
      }
    }
    function markDeleted(u, files, reason) {
      for (const f of files) repo.put(f.table, { ...f, deleted_at: now(), delete_pending: true });
      audit(u, reason, files[0]?.submission_id || files[0]?.assignment_id, { count: files.length });
      return { deleted: files.length, cleanup_pending: true };
    }
    function mutate(u, action, p) {
      switch (action) {
        case "logout": {
          const session = repo.all("Sessions").find((s) => s.token_hash === digest(p.token));
          if (session) repo.put("Sessions", { ...session, revoked_at: now() });
          audit(u, "logout", u.id);
          return { ok: true };
        }
        case "changePassword": {
          assert(typeof p.current_password === "string", "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C", "VALIDATION");
          const check = passwordRecord(p.current_password, u.salt, u.iterations).password_hash;
          assert(safeEqual(check, u.password_hash), "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u043D\u0435\u0432\u0435\u0440\u0435\u043D", "VALIDATION");
          const next = passwordRecord(p.new_password, auth.random());
          const changed = repo.put("Users", { ...u, ...next, must_change_password: false });
          auth.revoke(u.id);
          audit(u, "password_changed", u.id);
          return auth.session(changed);
        }
        case "saveAssignment": {
          assert(["teacher", "admin"].includes(u.role));
          const old = p.id ? getAssignment(p.id) : null;
          if (old) requireTeacher(u, old);
          assert(!old || p.version === old.version, "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443", "CONFLICT");
          const targets = p.targets;
          assert(Array.isArray(targets) && targets.length > 0 && targets.length <= 100, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u044E", "VALIDATION");
          for (const target of targets) assert(repo.get("Groups", target.group_id)?.active && [0, 1, 2].includes(Number(target.subgroup)), "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u044F", "VALIDATION");
          assert(u.role === "admin" || teacherScope(u, targets, repo.all("TeacherAccess")));
          const publication = p.publication_status || "draft";
          assert(["draft", "published", "archived"].includes(publication), "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441", "VALIDATION");
          assert(["close", "allow"].includes(p.late_policy), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u0441\u0440\u043E\u043A\u043E\u0432", "VALIDATION");
          const due = p.due_at || null;
          assert(!due || Number.isFinite(Date.parse(due)), "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0440\u043E\u043A", "VALIDATION");
          const title = text(p.title, 200);
          assert(title.length > 0, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", "VALIDATION");
          const a = repo.put("Assignments", {
            id: old?.id || uuid(),
            teacher_id: old?.teacher_id || u.id,
            title,
            description: text(p.description || "", 2e3),
            instructions: text(p.instructions || "", 2e4),
            targets: targets.map((t) => ({ group_id: t.group_id, subgroup: Number(t.subgroup) })),
            due_at: due,
            late_policy: p.late_policy,
            publication_status: publication,
            material_generation: old?.material_generation || null,
            version: (old?.version || 0) + 1,
            created_at: old?.created_at || now(),
            updated_at: now()
          });
          audit(u, old ? "assignment_updated" : "assignment_created", a.id, { before: old ? { targets: old.targets, status: old.publication_status, due_at: old.due_at } : null, after: { targets: a.targets, status: a.publication_status, due_at: a.due_at } });
          return a;
        }
        case "review": {
          const s = repo.get("Submissions", p.submission_id);
          assert(s, "\u0421\u0434\u0430\u0447\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", "NOT_FOUND");
          const a = getAssignment(s.assignment_id), student = repo.get("Users", s.student_id);
          assert(u.role === "admin" || canTeach(u, a, student, repo.all("TeacherAccess")));
          assert(s.generation === p.generation, "\u0421\u0442\u0443\u0434\u0435\u043D\u0442 \u0443\u0436\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043B \u043D\u043E\u0432\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443", "CONFLICT");
          assert(["accepted", "needs_revision"].includes(p.status), "\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435", "VALIDATION");
          const grade = p.grade === null || p.grade === "" || p.grade === void 0 ? null : Number(p.grade);
          assert(grade === null || [2, 3, 4, 5].includes(grade), "\u041E\u0446\u0435\u043D\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043E\u0442 2 \u0434\u043E 5", "VALIDATION");
          const next = repo.put("Submissions", { ...s, status: p.status, grade: p.status === "needs_revision" ? null : grade, feedback: text(p.feedback || "", 4e3), reviewer_id: u.id, reviewed_at: now() });
          audit(u, "submission_reviewed", s.id, { previous_grade: s.grade, previous_status: s.status, grade: next.grade, status: next.status, feedback: next.feedback });
          return next;
        }
        case "beginUpload":
          return reserve(u, p);
        case "deleteSubmissionFiles": {
          assert(p.confirm === true, "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435", "VALIDATION");
          const s = repo.get("Submissions", p.submission_id);
          assert(s, "\u0421\u0434\u0430\u0447\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", "NOT_FOUND");
          assert(u.role === "admin" || u.role === "student" && s.student_id === u.id && studentAccess(u, getAssignment(s.assignment_id), s, "own"));
          const files = currentFiles().filter((f) => f.submission_id === s.id);
          const result = markDeleted(u, files, "submission_files_deleted");
          repo.put("Submissions", { ...s, files_deleted: true });
          return result;
        }
        case "deleteMaterial": {
          assert(p.confirm === true, "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u0435", "VALIDATION");
          const f = allFiles().find((f2) => f2.id === p.file_id && f2.table === "Materials");
          assert(f, "\u0424\u0430\u0439\u043B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", "NOT_FOUND");
          const a = getAssignment(f.assignment_id);
          requireTeacher(u, a);
          assert(u.role === "admin" || teacherScope(u, a.targets, repo.all("TeacherAccess")));
          return markDeleted(u, [f], "material_deleted");
        }
        case "createUser": {
          requireAdmin(u);
          const password = auth.random().slice(0, 20);
          const created = auth.createUser(p, password);
          audit(u, "user_created", created.id, { role: created.role });
          return { user: publicUser(created), temporary_password: password };
        }
        case "importUsers": {
          requireAdmin(u);
          repo.normalizeIntake?.();
          const results = [];
          for (const row of repo.all("UserIntake").filter((r) => r.status !== "done").slice(0, 10)) {
            try {
              const group = repo.all("Groups").find((g) => g.id === row.group_id || g.name === row.group_id);
              const password = auth.random().slice(0, 20), created = auth.createUser({ ...row, group_id: group?.id || row.group_id }, password);
              repo.put("UserIntake", { ...row, status: "done", error: null });
              audit(u, "user_imported", created.id);
              results.push({ login: created.login, temporary_password: password });
            } catch (e) {
              repo.put("UserIntake", { ...row, status: "error", error: e.code ? e.message : "\u041E\u0448\u0438\u0431\u043A\u0430 \u0438\u043C\u043F\u043E\u0440\u0442\u0430" });
            }
          }
          return { results };
        }
        case "updateUser": {
          requireAdmin(u);
          const target = repo.get("Users", p.id);
          assert(target, "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", "NOT_FOUND");
          assert(["active", "blocked"].includes(p.status), "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441", "VALIDATION");
          assert(target.id !== u.id || p.status === "active", "\u041D\u0435\u043B\u044C\u0437\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u0435\u0431\u044F", "VALIDATION");
          const quota = Number(p.quota_bytes);
          assert(Number.isSafeInteger(quota) && quota >= 0 && quota <= 15 * 1024 * MiB, "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u043A\u0432\u043E\u0442\u0430", "VALIDATION");
          if (target.role === "student") assert(repo.get("Groups", p.group_id)?.active && [1, 2].includes(Number(p.subgroup)), "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0433\u0440\u0443\u043F\u043F\u0443 \u0438 \u043F\u043E\u0434\u0433\u0440\u0443\u043F\u043F\u0443", "VALIDATION");
          const updated = repo.put("Users", { ...target, status: p.status, quota_bytes: quota, group_id: target.role === "student" ? p.group_id : null, subgroup: target.role === "student" ? Number(p.subgroup) : null });
          if (p.status === "blocked") auth.revoke(target.id);
          audit(u, "user_updated", target.id, { before: publicUser(target), after: publicUser(updated) });
          return publicUser(updated);
        }
        case "resetPassword": {
          requireAdmin(u);
          const target = repo.get("Users", p.id);
          assert(target, "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", "NOT_FOUND");
          const password = auth.random().slice(0, 20);
          repo.put("Users", { ...target, ...passwordRecord(password, auth.random()), must_change_password: true });
          auth.revoke(target.id);
          audit(u, "password_reset", target.id);
          return { temporary_password: password };
        }
        case "revokeSessions":
          requireAdmin(u);
          auth.revoke(p.id);
          audit(u, "sessions_revoked", p.id);
          return { ok: true };
        case "saveGroup": {
          requireAdmin(u);
          const group = { id: p.id || uuid(), name: text(p.name, 80), active: p.active !== false };
          assert(group.name.length > 0, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", "VALIDATION");
          assert(!repo.all("Groups").some((g) => g.id !== group.id && g.name.toLocaleLowerCase("ru") === group.name.toLocaleLowerCase("ru")), "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0433\u0440\u0443\u043F\u043F\u044B \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F", "VALIDATION");
          repo.put("Groups", group);
          audit(u, "group_saved", group.id);
          return group;
        }
        case "saveTeacherAccess": {
          requireAdmin(u);
          assert(repo.get("Users", p.teacher_id)?.role === "teacher", "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u0435\u043F\u043E\u0434\u0430\u0432\u0430\u0442\u0435\u043B\u044F", "VALIDATION");
          assert(Array.isArray(p.targets), "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u044F", "VALIDATION");
          for (const t of p.targets) assert(repo.get("Groups", t.group_id)?.active && [0, 1, 2].includes(Number(t.subgroup)), "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u044F", "VALIDATION");
          for (const access of repo.all("TeacherAccess").filter((a) => a.teacher_id === p.teacher_id)) repo.put("TeacherAccess", { ...access, active: false });
          for (const t of p.targets) repo.put("TeacherAccess", { id: uuid(), teacher_id: p.teacher_id, group_id: t.group_id, subgroup: Number(t.subgroup), active: true });
          audit(u, "teacher_access_changed", p.teacher_id, { targets: p.targets });
          return { ok: true };
        }
        default:
          fail("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435", "NOT_FOUND");
      }
    }
    function api2(request) {
      try {
        assert(request && typeof request === "object", "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441", "VALIDATION");
        requireAvailable();
        const { action, token, payload = {} } = request;
        if (action === "login") return { ok: true, data: auth.signIn(payload.login, payload.password) };
        const u = auth.actor(token, ["changePassword", "logout", "bootstrap"].includes(action));
        if (action === "bootstrap") return { ok: true, data: {
          user: publicUser(u),
          groups: repo.all("Groups").filter((g) => g.active),
          access: u.role === "student" ? [] : repo.all("TeacherAccess").filter((a) => a.active && (u.role === "admin" || a.teacher_id === u.id)),
          quota: { used: used(u), limit: u.quota_bytes },
          uploads_enabled: settings.uploadsEnabled,
          transport_verified: settings.uploadsEnabled,
          file_limit: settings.fileLimit || LIMIT,
          release: settings.release
        } };
        if (action === "listAssignments") return { ok: true, data: visibleAssignments(u) };
        if (action === "reviewRows") return { ok: true, data: reviewRows(u, getAssignment(payload.assignment_id)) };
        if (action === "uploadStatus") {
          const r = repo.get("UploadReservations", payload.id);
          assert(r && r.user_id === u.id);
          const recovered = recoverCommitted(r);
          return { ok: true, data: { id: r.id, status: recovered ? "committed" : r.status, result: recovered || r.result } };
        }
        if (action === "downloadChunk") {
          const f = allFiles().find((f2) => f2.id === payload.file_id);
          checkFileAccess(u, f);
          const offset = Number(payload.offset);
          assert(Number.isSafeInteger(offset) && offset >= 0 && offset < f.size, "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D", "VALIDATION");
          const size = Math.min(256 * 1024, f.size - offset);
          const data = storage.chunk(f.drive_id, offset, size);
          if (offset === 0) repo.lock(() => audit(u, "file_download", f.id));
          return { ok: true, data: { data, offset, size, total: f.size, name: f.name, type: f.type } };
        }
        if (action === "adminData") {
          requireAdmin(u);
          const files = allFiles();
          return { ok: true, data: {
            users: repo.all("Users").map((s) => ({ ...publicUser(s), used: used(s) })),
            groups: repo.all("Groups"),
            access: repo.all("TeacherAccess").filter((a) => a.active),
            audit: repo.all("Audit").slice(-300).reverse(),
            storage: {
              current: currentFiles().reduce((n, f) => n + f.size, 0),
              physical: files.filter((f) => f.drive_id && (!f.deleted_at || f.delete_pending)).reduce((n, f) => n + f.size, 0),
              pending: files.filter((f) => f.delete_pending).length
            },
            operations: repo.all("UploadReservations").slice(-30).map(({ id, status, kind, started_at, total, error }) => ({ id, status, kind, started_at, total, error }))
          } };
        }
        if (action === "backupStatus") {
          requireAdmin(u);
          assert(backups, "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 Apps Script \u0434\u043B\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F", "CONFIG");
          return { ok: true, data: backups.status() };
        }
        if (action === "createBackup") {
          requireAdmin(u);
          assert(backups, "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 Apps Script \u0434\u043B\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F", "CONFIG");
          return { ok: true, data: backups.create() };
        }
        if (action === "storageHealth") {
          requireAdmin(u);
          return { ok: true, data: storage.check() };
        }
        if (action === "runCleanup") {
          requireAdmin(u);
          return { ok: true, data: housekeeping2() };
        }
        return { ok: true, data: repo.lock(() => {
          requireAvailable();
          return mutate(auth.actor(token, ["changePassword", "logout"].includes(action)), action, { ...payload, ...action === "logout" ? { token } : {} });
        }) };
      } catch (error) {
        return { ok: false, error: { code: error.code || "INTERNAL", message: error.code ? error.message : "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438\u043B\u0438 \u043E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u043A \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443" } };
      }
    }
    function housekeeping2() {
      requireAvailable();
      const results = { deleted: 0, pending: 0 };
      repo.lock(() => {
        requireAvailable();
        for (const r of repo.all("UploadReservations").filter((r2) => ["reserved", "receiving"].includes(r2.status) && Date.parse(r2.expires_at) + 6e5 < Date.parse(now()))) {
          const recovered = recoverCommitted(r);
          repo.put("UploadReservations", { ...r, status: recovered ? "committed" : "expired", result: recovered || null });
        }
        for (const f of allFiles().filter((f2) => !f2.deleted_at)) {
          const reservation = repo.all("UploadReservations").find((r) => r.generation === f.generation);
          const abandoned = !isCurrent(f) && (!reservation || ["committed", "failed", "expired"].includes(reservation.status));
          if (expired(f, now()) || abandoned) {
            repo.put(f.table, { ...f, deleted_at: now(), delete_pending: true });
            audit(null, expired(f, now()) ? "file_expired" : "old_generation_cleanup", f.id);
          }
        }
      });
      for (const file of allFiles().filter((f) => f.delete_pending).slice(0, 50)) {
        try {
          if (file.drive_id) storage.remove(file.drive_id);
          else if (storage.findByLogicalId) for (const orphan of storage.findByLogicalId(file.id)) storage.remove(orphan.id);
          repo.lock(() => repo.put(file.table, { id: file.id, delete_pending: false }));
          results.deleted++;
        } catch {
          results.pending++;
        }
      }
      return results;
    }
    return { api: api2, upload, housekeeping: housekeeping2 };
  }

  // server/backups.js
  var BACKUP_TABLES = ["Users", "Groups", "TeacherAccess", "Assignments", "Materials", "Submissions", "SubmissionFiles", "Audit", "Settings"];
  var MAX_BACKUP_BYTES = 20 * 1024 * 1024;
  var canonical = (value) => {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
    return JSON.stringify(value);
  };
  function makeSnapshot(repo, { id, at, sourceDb, storageRoot, release }) {
    const tables = {};
    for (const table of BACKUP_TABLES) tables[table] = repo.all(table).map((row) => Object.fromEntries(SCHEMA[table].map((key) => [key, row[key] ?? null])));
    const payload = {
      format: "practicus-metadata",
      version: 1,
      id,
      created_at: at,
      source_db: sourceDb,
      storage_root: storageRoot,
      release,
      schema: Object.fromEntries(BACKUP_TABLES.map((table) => [table, SCHEMA[table]])),
      tables
    };
    const normalized = JSON.parse(JSON.stringify(payload));
    return { payload: normalized, sha256: digest(canonical(normalized)) };
  }
  function validateSnapshot(envelope, storageRoot) {
    const p = envelope?.payload;
    assert(p?.format === "practicus-metadata" && p.version === 1, "\u041D\u0435\u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043C\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438", "BACKUP");
    assert(typeof envelope.sha256 === "string" && digest(canonical(p)) === envelope.sha256, "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u043B\u0430", "BACKUP");
    assert(p.storage_root === storageRoot, "\u041A\u043E\u043F\u0438\u044F \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043A \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0443 Drive", "BACKUP");
    assert(Number.isFinite(Date.parse(p.created_at)) && typeof p.id === "string" && p.id.length > 0, "\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0435\u043D\u044B \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u043A\u043E\u043F\u0438\u0438", "BACKUP");
    assert(p.tables && p.schema && typeof p.tables === "object" && typeof p.schema === "object", "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438", "BACKUP");
    assert(JSON.stringify(Object.keys(p.tables).sort()) === JSON.stringify([...BACKUP_TABLES].sort()), "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u043E\u0441\u0442\u0430\u0432 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438", "BACKUP");
    for (const table of BACKUP_TABLES) {
      assert(JSON.stringify(p.schema[table]) === JSON.stringify(SCHEMA[table]), "\u041D\u0435\u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u0430\u044F \u0441\u0445\u0435\u043C\u0430 " + table, "BACKUP");
      const ids = /* @__PURE__ */ new Set();
      assert(Array.isArray(p.tables[table]), "\u041F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D \u043B\u0438\u0441\u0442 " + table, "BACKUP");
      for (const row of p.tables[table]) {
        assert(row && typeof row.id === "string" && row.id && !ids.has(row.id), "\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0449\u0438\u0439\u0441\u044F \u0438\u043B\u0438 \u043F\u0443\u0441\u0442\u043E\u0439 ID \u0432 " + table, "BACKUP");
        ids.add(row.id);
        assert(JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...SCHEMA[table]].sort()), "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u043F\u043E\u043B\u044F " + table, "BACKUP");
      }
    }
    assert(p.tables.Users.some((u) => u.role === "admin" && u.status === "active"), "\u0412 \u043A\u043E\u043F\u0438\u0438 \u043D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0430", "BACKUP");
    return p;
  }
  function reconcileFiles(tables, inventory, tombstones, historyAvailable, at) {
    const copy = JSON.parse(JSON.stringify(tables));
    let unavailable = 0;
    for (const table of ["Materials", "SubmissionFiles"]) for (const file of copy[table]) {
      file.delete_pending = false;
      const actual = inventory.get(file.drive_id);
      if (file.deleted_at || !historyAvailable || tombstones.has(file.id) || !actual || Number(actual.size) !== file.size) {
        if (!file.deleted_at) unavailable++;
        file.deleted_at = file.deleted_at || at;
      }
    }
    for (const s of copy.Submissions) s.files_deleted = !copy.SubmissionFiles.some((f) => f.submission_id === s.id && f.generation === s.generation && !f.deleted_at);
    return { tables: copy, unavailable };
  }
  function createBackups({ repo, store, props, now, uuid, release, createRestoreRepo }) {
    const event = (action, details = {}) => repo.put("Audit", { id: uuid(), actor_id: "system", action, at: now(), details });
    const status = () => ({
      last_success_at: props.getProperty("BACKUP_LAST_SUCCESS_AT"),
      last_size: Number(props.getProperty("BACKUP_LAST_SIZE") || 0),
      last_error_at: props.getProperty("BACKUP_LAST_ERROR_AT"),
      last_error: props.getProperty("BACKUP_LAST_ERROR"),
      retained: Number(props.getProperty("BACKUP_RETAINED") || 0),
      keep: Number(props.getProperty("BACKUP_KEEP") || 7),
      cleanup_pending: Number(props.getProperty("BACKUP_CLEANUP_PENDING") || 0),
      restore_status: props.getProperty("RESTORE_STATUS")
    });
    function create() {
      const operation = uuid();
      let leased = false;
      try {
        const snapshot = repo.lock(() => {
          assert(!props.getProperty("BACKUP_LEASE_UNTIL") || props.getProperty("BACKUP_LEASE_UNTIL") <= now(), "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u0443\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F", "BUSY");
          props.setProperty("BACKUP_LEASE_ID", operation);
          props.setProperty("BACKUP_LEASE_UNTIL", new Date(Date.parse(now()) + 10 * 6e4).toISOString());
          leased = true;
          event("backup_started");
          return makeSnapshot(repo, { id: operation, at: now(), sourceDb: props.getProperty("DB_ID"), storageRoot: props.getProperty("DRIVE_ROOT_ID"), release });
        });
        const raw = JSON.stringify(snapshot);
        const file = store.write(raw, "practicus-metadata-" + snapshot.payload.created_at.replace(/[:.]/g, "-") + "-" + operation + ".json");
        const stored = JSON.parse(store.read(file.id));
        validateSnapshot(stored, props.getProperty("DRIVE_ROOT_ID"));
        assert(stored.sha256 === snapshot.sha256, "Drive \u0432\u0435\u0440\u043D\u0443\u043B \u0434\u0440\u0443\u0433\u0443\u044E \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E", "BACKUP");
        store.commit?.(file.id);
        const keep = Number(props.getProperty("BACKUP_KEEP") || 7);
        assert(Number.isInteger(keep) && keep >= 2 && keep <= 30, "BACKUP_KEEP \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0442 2 \u0434\u043E 30", "CONFIG");
        const copies = [file, ...store.list().filter((f) => f.id !== file.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))];
        let pending = 0;
        for (const old of copies.slice(keep)) try {
          store.remove(old.id);
        } catch {
          pending++;
        }
        pending += store.prunePending?.() || 0;
        props.setProperty("BACKUP_LAST_SUCCESS_AT", now());
        props.setProperty("BACKUP_LAST_SIZE", String(file.size));
        props.setProperty("BACKUP_RETAINED", String(Math.min(keep, copies.length) + pending));
        props.setProperty("BACKUP_CLEANUP_PENDING", String(pending));
        props.deleteProperty("BACKUP_LAST_ERROR");
        props.deleteProperty("BACKUP_LAST_ERROR_AT");
        repo.lock(() => event("backup_completed", { bytes: file.size, retained: Math.min(keep, copies.length) + pending, cleanup_pending: pending }));
        return { ...status(), cleanup_pending: pending };
      } catch (error) {
        if (leased) {
          props.setProperty("BACKUP_LAST_ERROR_AT", now());
          props.setProperty("BACKUP_LAST_ERROR", error.code || "INTERNAL");
        }
        throw error;
      } finally {
        if (leased) repo.lock(() => {
          if (props.getProperty("BACKUP_LEASE_ID") === operation) {
            props.deleteProperty("BACKUP_LEASE_ID");
            props.deleteProperty("BACKUP_LEASE_UNTIL");
          }
        });
      }
    }
    function prepareRestore2(id) {
      assert(props.getProperty("MAINTENANCE_MODE") === "true", "\u041F\u0435\u0440\u0435\u0434 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435\u043C \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 MAINTENANCE_MODE=true", "MAINTENANCE");
      const p = validateSnapshot(JSON.parse(store.read(id)), props.getProperty("DRIVE_ROOT_ID"));
      let tombstones = /* @__PURE__ */ new Set(), historyAvailable = true;
      try {
        repo.lock(() => {
          for (const table of ["Materials", "SubmissionFiles"]) for (const f of repo.all(table)) if (f.deleted_at) tombstones.add(f.id);
        });
      } catch {
        historyAvailable = false;
      }
      const reconciled = reconcileFiles(p.tables, store.inventory(), tombstones, historyAvailable, now());
      props.setProperty("RESTORE_STATUS", "preparing");
      props.deleteProperty("RESTORED_DB_ID");
      try {
        const target = createRestoreRepo();
        assert(target.id !== props.getProperty("DB_ID"), "\u041D\u0435\u043B\u044C\u0437\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0442\u044C \u043F\u043E\u0432\u0435\u0440\u0445 \u0440\u0430\u0431\u043E\u0447\u0435\u0439 \u0431\u0430\u0437\u044B", "BACKUP");
        for (const table of BACKUP_TABLES) target.repo.writeEmptyTable(table, reconciled.tables[table]);
        for (const table of BACKUP_TABLES) assert(canonical(target.repo.all(table)) === canonical(reconciled.tables[table]), "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u043B\u0438\u0441\u0442\u0430 \u043D\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u0430: " + table, "BACKUP");
        for (const table of ["Sessions", "LoginAttempts", "UploadReservations", "UserIntake"]) assert(target.repo.all(table).length === 0, "\u0421\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0439 \u043B\u0438\u0441\u0442 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0435 \u043F\u0443\u0441\u0442", "BACKUP");
        target.complete?.();
        const report = { prepared_at: now(), snapshot_at: p.created_at, records: BACKUP_TABLES.reduce((n, t) => n + p.tables[t].length, 0), unavailable_files: reconciled.unavailable, deletion_history_available: historyAvailable };
        props.setProperty("RESTORED_DB_ID", target.id);
        props.setProperty("RESTORE_REPORT", JSON.stringify(report));
        props.setProperty("RESTORE_STATUS", "ready");
        return report;
      } catch (error) {
        props.setProperty("RESTORE_STATUS", "failed");
        throw error;
      }
    }
    return { create, status, prepareRestore: prepareRestore2 };
  }

  // server/backup-store.js
  function ensureBackupRoot(props) {
    let id = props.getProperty("BACKUP_ROOT_ID");
    if (!id) {
      id = DriveApp.createFolder("Practicus_Metadata_Backups").getId();
      props.setProperty("BACKUP_ROOT_ID", id);
    }
    return id;
  }
  var BackupStore = class {
    constructor(props, drive) {
      this.props = props;
      this.drive = drive;
      this.checked = false;
    }
    folder() {
      const id = this.props.getProperty("BACKUP_ROOT_ID");
      assert(id, "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 runInitialSetup \u0434\u043B\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 \u043A\u043E\u043F\u0438\u0439", "CONFIG");
      const folder = DriveApp.getFolderById(id);
      if (!this.checked) {
        assert(
          folder.getOwner()?.getEmail() === Session.getEffectiveUser().getEmail() && folder.getSharingAccess() === DriveApp.Access.PRIVATE && !folder.getEditors().length && !folder.getViewers().length,
          "\u041F\u0430\u043F\u043A\u0430 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 \u043A\u043E\u043F\u0438\u0439 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0443",
          "BACKUP"
        );
        this.checked = true;
      }
      return folder;
    }
    write(raw, name2) {
      const folder = this.folder(), blob = Utilities.newBlob(raw, "application/json", "pending-" + name2);
      assert(blob.getBytes().length <= MAX_BACKUP_BYTES, "\u0420\u0435\u0437\u0435\u0440\u0432\u043D\u0430\u044F \u043A\u043E\u043F\u0438\u044F \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0435\u0442 20 \u041C\u0438\u0411", "BACKUP");
      const file = folder.createFile(blob);
      return { id: file.getId(), size: file.getSize(), created_at: file.getDateCreated().toISOString() };
    }
    file(id) {
      const folder = this.folder(), file = DriveApp.getFileById(id), parents = file.getParents();
      let belongs = false;
      while (parents.hasNext()) if (parents.next().getId() === folder.getId()) belongs = true;
      assert(
        belongs && /^(?:pending-)?practicus-metadata-.*\.json$/.test(file.getName()) && file.getSize() <= MAX_BACKUP_BYTES && file.getOwner()?.getEmail() === Session.getEffectiveUser().getEmail() && file.getSharingAccess() === DriveApp.Access.PRIVATE && !file.getEditors().length && !file.getViewers().length,
        "\u0424\u0430\u0439\u043B \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0437\u0430\u043A\u0440\u044B\u0442\u043E\u0439 \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0435\u0439 \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
        "BACKUP"
      );
      return file;
    }
    read(id) {
      return this.file(id).getBlob().getDataAsString("UTF-8");
    }
    commit(id) {
      const file = this.file(id);
      assert(file.getName().startsWith("pending-"), "\u041A\u043E\u043F\u0438\u044F \u0443\u0436\u0435 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u0430", "BACKUP");
      file.setName(file.getName().slice(8));
    }
    prunePending() {
      const files = this.folder().getFiles();
      let failed = 0;
      while (files.hasNext()) {
        const f = files.next();
        if (f.getName().startsWith("pending-practicus-metadata-") && Date.now() - f.getDateCreated().getTime() > 2 * 864e5) try {
          this.drive.remove(f.getId());
        } catch {
          failed++;
        }
      }
      return failed;
    }
    list() {
      const files = this.folder().getFiles(), result = [];
      while (files.hasNext()) {
        const f = files.next();
        if (/^practicus-metadata-.*\.json$/.test(f.getName())) result.push({ id: f.getId(), size: f.getSize(), created_at: f.getDateCreated().toISOString() });
      }
      return result;
    }
    remove(id) {
      this.file(id);
      this.drive.remove(id);
    }
    inventory() {
      this.drive.check();
      const root = this.props.getProperty("DRIVE_ROOT_ID");
      assert(/^[a-zA-Z0-9_-]+$/.test(root), "\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u043F\u0430\u043F\u043A\u0430 Drive", "CONFIG");
      const files = /* @__PURE__ */ new Map();
      let page = "";
      do {
        const query = "'" + root + "' in parents and trashed = false";
        const result = JSON.parse(this.drive.request("drive/v3/files?q=" + encodeURIComponent(query) + "&fields=nextPageToken,files(id,size)&pageSize=1000" + (page ? "&pageToken=" + encodeURIComponent(page) : "")).getContentText());
        for (const file of result.files || []) files.set(file.id, { size: Number(file.size) });
        page = result.nextPageToken || "";
      } while (page);
      return files;
    }
  };

  // server/main.js
  function publicStatus() {
    return { application: "practicus", version: true ? "1.0.0" : "development", backend_build: true ? "c0cb66d1554f3cff099726e6cbc61021fac2045a3c72484c9cf8a91bafc55501" : "development" };
  }
  function context() {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty("DB_ID");
    assert(id, "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 setup_", "CONFIG");
    const repo = new SheetRepository(id);
    const now = () => (/* @__PURE__ */ new Date()).toISOString(), uuid = () => Utilities.getUuid();
    const auth = new Auth(repo, props.getProperty("AUTH_SECRET"), now, uuid);
    const storage = new PrivateDrive(props);
    const limit = Number(props.getProperty("FILE_LIMIT_BYTES") || LIMIT);
    assert(Number.isSafeInteger(limit) && limit > 0 && limit <= LIMIT, "\u041B\u0438\u043C\u0438\u0442 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 25 \u041C\u0438\u0411", "CONFIG");
    const uploadFlag = props.getProperty("FILE_UPLOADS_ENABLED");
    const ctx = { props, repo, auth, storage, now, uuid, settings: {
      uploadsEnabled: uploadFlag === null ? props.getProperty("FILE_TRANSPORT_VERIFIED") === "true" : uploadFlag === "true",
      fileLimit: limit,
      isMaintenance: () => props.getProperty("MAINTENANCE_MODE") === "true",
      release: publicStatus()
    } };
    ctx.backups = createBackups({ ...ctx, store: new BackupStore(props, storage), release: publicStatus(), createRestoreRepo: () => {
      const book = SpreadsheetApp.create("Practicus_Restore_INCOMPLETE_" + now().replace(/[:.]/g, "-"));
      initializeSheets(book.getId());
      return { id: book.getId(), repo: new SheetRepository(book.getId()), complete: () => book.rename("Practicus_Restore_" + now().replace(/[:.]/g, "-")) };
    } });
    return ctx;
  }
  function api(request) {
    try {
      return createService(context()).api(request);
    } catch (error) {
      return { ok: false, error: { code: error.code || "INTERNAL", message: error.code ? error.message : "\u041E\u0448\u0438\u0431\u043A\u0430 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u0430" } };
    }
  }
  function uploadForm(form) {
    try {
      assert(form && typeof form.token === "string" && typeof form.reservation_id === "string", "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0444\u043E\u0440\u043C\u0430", "VALIDATION");
      const count = Number(form.count);
      assert(Number.isInteger(count) && count > 0 && count <= 25, "\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u0444\u0430\u0439\u043B\u043E\u0432", "VALIDATION");
      const blobs = Array.from({ length: count }, (_, i) => form["file_" + i]);
      assert(blobs.every((b) => b && typeof b.getBytes === "function"), "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B \u0444\u043E\u0440\u043C\u044B", "VALIDATION");
      return { ok: true, data: createService(context()).upload(form.token, form.reservation_id, blobs) };
    } catch (error) {
      return { ok: false, error: { code: error.code || "INTERNAL", message: error.code ? error.message : "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438" } };
    }
  }
  function setup() {
    const props = PropertiesService.getScriptProperties();
    assert(props.getProperty("AUTH_SECRET")?.length >= 43, "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 AUTH_SECRET", "CONFIG");
    assert(/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(props.getProperty("PAGES_ORIGIN") || ""), "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 PAGES_ORIGIN \u0431\u0435\u0437 \u043F\u0443\u0442\u0438 \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u044E\u0449\u0435\u0433\u043E \u0441\u043B\u044D\u0448\u0430", "CONFIG");
    let id = props.getProperty("DB_ID");
    if (!id) {
      id = SpreadsheetApp.create("Practicus_DB").getId();
      props.setProperty("DB_ID", id);
    }
    initializeSheets(id);
    ensureStorageRoot(props);
    ensureBackupRoot(props);
    const ctx = context();
    ctx.storage.check();
    if (!ctx.repo.all("Users").some((u) => u.role === "admin")) {
      const login2 = props.getProperty("INIT_ADMIN_LOGIN"), password = props.getProperty("INIT_ADMIN_PASSWORD");
      assert(login2 && password, "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 INIT_ADMIN_LOGIN \u0438 INIT_ADMIN_PASSWORD", "CONFIG");
      ctx.repo.lock(() => {
        const admin = ctx.auth.createUser({ login: login2, full_name: "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440", role: "admin" }, password);
        ctx.repo.put("Users", { ...admin, must_change_password: true });
      });
      props.deleteProperty("INIT_ADMIN_PASSWORD");
      props.deleteProperty("INIT_ADMIN_LOGIN");
    }
    const existing = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "housekeeping_");
    if (!existing) ScriptApp.newTrigger("housekeeping_").timeBased().everyHours(1).create();
    if (!ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "metadataBackup_")) {
      ScriptApp.newTrigger("metadataBackup_").timeBased().atHour(3).nearMinute(30).everyDays(1).inTimezone("Asia/Irkutsk").create();
    }
    if (!props.getProperty("BACKUP_LAST_SUCCESS_AT")) ctx.backups.create();
    return { configured: true };
  }
  function housekeeping() {
    return createService(context()).housekeeping();
  }
  function backupMetadata() {
    return context().backups.create();
  }
  function prepareRestore() {
    const ctx = context(), id = ctx.props.getProperty("RESTORE_BACKUP_ID");
    assert(id, "\u0417\u0430\u0434\u0430\u0439\u0442\u0435 RESTORE_BACKUP_ID", "CONFIG");
    return ctx.backups.prepareRestore(id);
  }
  return __toCommonJS(main_exports);
})();
/*! Bundled license information:

@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/

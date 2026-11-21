// Data entry points use Core authorization. The editor launcher checks Google identity.
function api(request) { return Core.api(request); }
function uploadForm(form) { return Core.uploadForm(form); }
// Names ending in '_' are hidden in the editor's Run dropdown as well as RPC.
function runInitialSetup() {
  assertEditorIdentity_();
  return setup_();
}
function assertEditorIdentity_() {
  var activeEmail = Session.getActiveUser().getEmail();
  var effectiveEmail = Session.getEffectiveUser().getEmail();
  if (!activeEmail || !effectiveEmail || activeEmail !== effectiveEmail) {
    throw new Error('Запустите первоначальную настройку из редактора Apps Script под выделенным аккаунтом приложения.');
  }
}
function runMetadataBackup() { assertEditorIdentity_(); return Core.backupMetadata(); }
function runPrepareRestore() { assertEditorIdentity_(); return Core.prepareRestore(); }
function setup_() { return Core.setup(); }
function housekeeping_() { return Core.housekeeping(); }
function metadataBackup_() { return Core.backupMetadata(); }
function doGet(e) {
  if (e && e.parameter && e.parameter.health === '1') {
    return ContentService.createTextOutput(JSON.stringify(Core.publicStatus())).setMimeType(ContentService.MimeType.JSON);
  }
  var props = PropertiesService.getScriptProperties();
  var origin = props.getProperty('PAGES_ORIGIN') || '';
  var channel = (e && e.parameter && e.parameter.channel) || '';
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(origin) || !/^[a-f0-9]{64}$/.test(channel)) {
    return HtmlService.createHtmlOutput('Practicus API. Откройте интерфейс на GitHub Pages.');
  }
  var template = HtmlService.createTemplateFromFile('Bridge');
  template.origin = origin;
  template.channel = channel;
  return template.evaluate().setTitle('Practicus API').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

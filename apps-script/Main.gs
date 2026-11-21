// Data entry points use Core authorization. The editor launcher checks Google identity.
function api(request) { return Core.api(request); }
function uploadForm(form) { return Core.uploadForm(form); }
// Names ending in '_' are hidden in the editor's Run dropdown as well as RPC.
function runInitialSetup() {
  var activeEmail = Session.getActiveUser().getEmail();
  var effectiveEmail = Session.getEffectiveUser().getEmail();
  if (!activeEmail || !effectiveEmail || activeEmail !== effectiveEmail) {
    throw new Error('Запустите первоначальную настройку из редактора Apps Script под выделенным аккаунтом приложения.');
  }
  return setup_();
}
function setup_() { return Core.setup(); }
function housekeeping_() { return Core.housekeeping(); }
function doGet(e) {
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

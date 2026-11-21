// Public entry points only. All owner/trigger helpers end in an underscore.
function api(request) { return Core.api(request); }
function uploadForm(form) { return Core.uploadForm(form); }
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

/**
 * Roatán Water Taxi · Zelle auto-confirm (Google Apps Script, runs inside your own Gmail).
 *
 * Every 5 minutes it looks for new emails that mention a booking code (RWT-XXXXXXXX), checks that
 * Gmail verified the email really came from your bank, and sends it to our server, which confirms
 * the booking only if the code and amount match. Emails it can't confirm get the Gmail label
 * "Zelle - check by hand". Nothing leaves your Gmail except those emails' text.
 *
 * Setup (once): see docs/PAYMENTS.md → "Zelle: automatic".
 */

var SERVER = 'https://crcxjbiqnlzmqrdwpozj.supabase.co/functions/v1/zelle-email';
var DONE_LABEL = 'Zelle - processed';
var CHECK_LABEL = 'Zelle - check by hand';

/** Step 1: run once. Creates the secret and shows it in the log, so you can paste it into Supabase. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('ZELLE_HOOK_SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('ZELLE_HOOK_SECRET', secret);
  }
  GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  GmailApp.getUserLabelByName(CHECK_LABEL) || GmailApp.createLabel(CHECK_LABEL);
  Logger.log('Copy this into Supabase → Edge Functions → Secrets as ZELLE_HOOK_SECRET:\n' + secret);
}

/** Step 2: shows, for your 5 latest Zelle emails, who Gmail verified them from and what the server would do. Confirms nothing. */
function testLatest() {
  var threads = GmailApp.search('zelle newer_than:90d', 0, 5);
  if (!threads.length) { Logger.log('No Zelle emails in the last 90 days.'); return; }
  threads.forEach(function (t) {
    var m = t.getMessages()[t.getMessageCount() - 1];
    var res = send_(m, true);
    Logger.log(m.getFrom() + ' | ' + m.getSubject() + '\n  → ' + JSON.stringify(res));
  });
}

/** Step 3: run once. Turns on the 5-minute check. */
function startEvery5Minutes() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'checkZelleEmails') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('checkZelleEmails').timeBased().everyMinutes(5).create();
  Logger.log('On. Gmail is checked every 5 minutes.');
}

/** Runs every 5 minutes. */
function checkZelleEmails() {
  var done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var check = GmailApp.getUserLabelByName(CHECK_LABEL) || GmailApp.createLabel(CHECK_LABEL);
  var threads = GmailApp.search('RWT newer_than:3d -label:"' + DONE_LABEL + '"', 0, 20);
  threads.forEach(function (t) {
    var m = t.getMessages()[t.getMessageCount() - 1];
    var res = send_(m, false);
    if (res === null) return; // network or server problem: try again in 5 minutes
    t.addLabel(done);
    if (!res.confirmed) t.addLabel(check);
  });
}

function send_(message, dryRun) {
  var secret = PropertiesService.getScriptProperties().getProperty('ZELLE_HOOK_SECRET');
  if (!secret) throw new Error('Run setup() first.');
  var payload = {
    text: (message.getSubject() + '\n' + message.getPlainBody()).slice(0, 20000),
    verifiedDomains: verifiedDomains_(message),
    messageId: message.getId(),
    dryRun: !!dryRun
  };
  try {
    var r = UrlFetchApp.fetch(SERVER, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-zelle-secret': secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() >= 500) return null;
    return JSON.parse(r.getContentText());
  } catch (e) {
    return null;
  }
}

/**
 * Domains Gmail itself verified for this email. Only the FIRST "Authentication-Results" header
 * (the one Google's own mail server adds on arrival) is trusted; a forged email can't fake it.
 * Uses DMARC (the From address is proven) and falls back to DKIM aligned with the From domain.
 */
function verifiedDomains_(message) {
  var raw = message.getRawContent();
  var headerEnd = raw.search(/\r?\n\r?\n/);
  var headers = raw.slice(0, headerEnd > 0 ? headerEnd : 20000).replace(/\r?\n[ \t]+/g, ' ');
  var first = (headers.match(/^Authentication-Results:\s*mx\.google\.com;[^\n]*/im) || [''])[0].toLowerCase();
  if (!first) return [];
  var out = [];
  var dmarc = first.match(/dmarc=pass[^;]*header\.from=([a-z0-9.-]+)/);
  if (dmarc) out.push(dmarc[1]);
  var from = (message.getFrom().match(/@([A-Za-z0-9.-]+)/) || [])[1];
  var dkimRe = /dkim=pass[^;]*header\.(?:i=@|d=)([a-z0-9.-]+)/g, k;
  while ((k = dkimRe.exec(first))) {
    if (from && (from.toLowerCase() === k[1] || from.toLowerCase().slice(-(k[1].length + 1)) === '.' + k[1])) out.push(k[1]);
  }
  return out;
}

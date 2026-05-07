const SHEET_NAME = '案件資料';
const HEADERS = [
  '案件ID','更新時間','活動日期','客戶名稱','聯絡電話','客戶Email','廠商Email','負責業務','會議廳／地點',
  '會議型式','遠端人數','使用平台','攝影配置','錄影需求','接入PPT','字卡需求',
  '連結時間','付費彩排','口譯需求','備註','LINE訊息','完整資料JSON'
];

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  if (payload.action === 'draft') return createDraft_(payload);
  const sheet = getSheet_();
  const row = toRow_(payload);
  const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  const index = ids.indexOf(payload.caseId);
  if (index >= 0) sheet.getRange(index + 2, 1, 1, HEADERS.length).setValues([row]);
  else sheet.appendRow(row);
  return output_({ ok: true, caseId: payload.caseId });
}

function doGet(e) {
  const action = e.parameter.action || 'list';
  if (action === 'load') return output_(loadCase_(e.parameter.caseId), e.parameter.callback);
  return output_(listCases_(), e.parameter.callback);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (first[0] !== HEADERS[0]) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function toRow_(p) {
  const f = p.form || {};
  const attendees = f.attendeesCustom ? f.attendeesCustom + ' 人' : (f.attendees || '');
  const camera = f.camera === '多機攝影' ? '多機攝影（' + f.cameraCount + ' 台）' : (f.camera || '');
  const caption = f.caption === '需要' ? '需要（' + f.captionCount + ' 張）' : (f.caption || '');
  return [
    p.caseId || Utilities.getUuid(), new Date(), f.date || '', f.client || '', f.phone || '',
    f.clientEmail || '', f.vendorEmail || '', f.sales || '', f.venue || '', f.meetingType || '', attendees, (f.platforms || []).join('、'),
    camera, f.recording || '', f.ppt || '', caption, f.linkTime || '', f.rehearsal || '',
    f.interpret || '', f.notes || '', p.message || '', JSON.stringify(p)
  ];
}

function createDraft_(p) {
  const to = p.to || '';
  if (!to) return output_({ ok: false, error: '缺少收件人 Email' });
  const subject = p.subject || '視訊會議需求確認';
  const body = p.body || p.message || '';
  const draft = GmailApp.createDraft(to, subject, body);
  return output_({ ok: true, draftId: draft.getId(), to: to });
}

function listCases_() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: true, cases: [] };
  const start = Math.max(2, last - 39);
  const values = sheet.getRange(start, 1, last - start + 1, HEADERS.length).getValues().reverse();
  const cases = values.map(function(row) {
    return { caseId: row[0], updatedAt: row[1], date: row[2], client: row[3], meetingType: row[9] };
  });
  return { ok: true, cases: cases };
}

function loadCase_(id) {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return { ok: false, error: '尚無案件' };
  const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] === id) return { ok: true, case: JSON.parse(values[i][21] || '{}') };
  }
  return { ok: false, error: '找不到案件' };
}

function output_(data, callback) {
  const text = callback ? callback + '(' + JSON.stringify(data) + ')' : JSON.stringify(data);
  const mime = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(text).setMimeType(mime);
}

// Google Apps Script for order webhook
/**
 * Receives order payload and responds with permissive CORS headers.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  // TODO: handle the order data, e.g., store in a sheet or send notifications
  const output = ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
  return output;
}

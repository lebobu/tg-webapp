// googleSheets.js
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const SA_KEY   = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!SHEET_ID || !SA_EMAIL || !SA_KEY) {
  console.warn('Google Sheets not fully configured: set GOOGLE_SHEET_ID, GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY');
}

function getClient() {
  const jwt = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: jwt });
}

// --- Customers ---
async function getCustomerByUserId(userId) {
  if (!SHEET_ID) return null;
  const sheets = getClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Customers!A2:C', // user_id, username, email
  });
  const rows = data.values || [];
  const idStr = String(userId);
  for (const row of rows) {
    const [uid, username, email] = row;
    if (String(uid) === idStr) return { user_id: uid, username, email };
  }
  return null;
}

async function upsertCustomer({ user_id, username, email }) {
  if (!SHEET_ID) return;
  const sheets = getClient();
  // читаем все, ищем строку
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Customers!A2:F',
  });
  const rows = data.values || [];
  const now = new Date().toISOString();
  const idStr = String(user_id);
  let foundIndex = -1;
  rows.forEach((r, i) => { if (String(r[0]) === idStr) foundIndex = i; });

  if (foundIndex >= 0) {
    // update: email/username/last_seen/order_count+1
    const r = rows[foundIndex];
    const orderCount = Number(r[5] || 0) + 1;
    const values = [
      idStr,
      username || r[1] || '',
      email    || r[2] || '',
      r[3] || now,     // first_seen
      now,             // last_seen
      orderCount
    ];
    const startRow = 2 + foundIndex; // A2 -> index 0
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Customers!A${startRow}:F${startRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] }
    });
  } else {
    // insert new
    const values = [
      idStr, username || '', email || '', now, now, 1
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Customers!A:F',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] }
    });
  }
}

// --- Orders ---
async function appendOrder(order) {
  if (!SHEET_ID) return;
  const sheets = getClient();
  const {
    user_id, username, email, plan, accounts, duration, total, subscribe, query_id, chat_id
  } = order;
  const values = [[
    new Date().toISOString(),
    String(user_id || ''),
    String(username || ''),
    String(email || ''),
    String(plan || ''),
    String(accounts ?? '-'),
    String(duration ?? ''),
    String(total ?? ''),
    subscribe ? 'yes' : 'no',
    String(query_id || ''),
    String(chat_id || '')
  ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Orders!A:K',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
}

module.exports = {
  getCustomerByUserId,
  upsertCustomer,
  appendOrder,
};
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

/**
 * Ищет клиента по email (колонка C, индекс 2).
 * Возвращает { rowIndex, row } или null.
 */
async function findCustomerByEmail(sheets, email) {
  if (!email) return null;
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Customers!A2:F',  // user_id, username, email, first_seen, last_seen, order_count
  });
  const rows = data.values || [];
  const emailLower = email.toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if ((row[2] || '').toLowerCase() === emailLower) {
      return { rowIndex: i, row };
    }
  }
  return null;
}

/**
 * Ищет клиента по user_id (колонка A).
 */
async function getCustomerByUserId(userId) {
  if (!SHEET_ID) return null;
  const sheets = getClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Customers!A2:C',
  });
  const rows = data.values || [];
  const idStr = String(userId);
  for (const row of rows) {
    const [uid, username, email] = row;
    if (String(uid) === idStr) return { user_id: uid, username, email };
  }
  return null;
}

/**
 * Ищет клиента по email — публичный метод для роутов.
 */
async function getCustomerByEmail(email) {
  if (!SHEET_ID || !email) return null;
  const sheets = getClient();
  const found = await findCustomerByEmail(sheets, email);
  if (!found) return null;
  const [uid, username, em, first_seen, last_seen, order_count] = found.row;
  return { user_id: uid, username, email: em, first_seen, last_seen, order_count };
}

/**
 * Upsert клиента:
 * - Если email найден → обновляем username/last_seen, увеличиваем order_count.
 * - Если не найден → добавляем новую строку.
 */
async function upsertCustomer({ user_id, username, email }) {
  if (!SHEET_ID) return;
  const sheets = getClient();
  const now = new Date().toISOString();

  const found = await findCustomerByEmail(sheets, email);

  if (found) {
    // Клиент существует — обновляем
    const r = found.row;
    const orderCount = Number(r[5] || 0) + 1;
    const values = [
      r[0] || String(user_id),   // user_id — оставляем оригинальный
      username || r[1] || '',
      email,
      r[3] || now,               // first_seen
      now,                       // last_seen
      orderCount
    ];
    const sheetRow = 2 + found.rowIndex;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Customers!A${sheetRow}:F${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] }
    });
  } else {
    // Новый клиент — вставляем
    const values = [String(user_id), username || '', email || '', now, now, 1];
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
    user_id, username, email, plan, accounts, duration, os, total, subscribe, query_id, chat_id
  } = order;
  const values = [[
    new Date().toISOString(),
    String(user_id || ''),
    String(username || ''),
    String(email || ''),
    String(plan || ''),
    String(accounts ?? '-'),
    String(duration ?? ''),
    String(os || '-'),
    String(total ?? ''),
    subscribe ? 'yes' : 'no',
    String(query_id || ''),
    String(chat_id || '')
  ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Orders!A:L',        // теперь 12 колонок (добавилась os)
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
}

module.exports = {
  getCustomerByUserId,
  getCustomerByEmail,
  upsertCustomer,
  appendOrder,
};

import ExcelJS from 'exceljs';
import { statusText } from './reports.js';
import { fmtDate } from './format.js';

function cellValue(v, type) {
  if (v === null || v === undefined) return '';
  if (type === 'status') return statusText(v);
  if (type === 'date') return v ? fmtDate(v) : '';
  if (type === 'datetime') return v ? new Date(v).toISOString().replace('T', ' ').slice(0, 16) : '';
  return v;
}

function esc(v) {
  const s = String(v ?? '');
  // Neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) && isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function reportToCSV(report) {
  const lines = [report.columns.map((c) => esc(c.label)).join(',')];
  for (const r of report.rows) lines.push(report.columns.map((c) => esc(cellValue(r[c.key], c.type))).join(','));
  if (report.totals && Object.keys(report.totals).length) {
    lines.push(report.columns.map((c, i) => esc(i === 0 ? 'TOTAL' : report.totals[c.key] ?? '')).join(','));
  }
  return '\uFEFF' + lines.join('\r\n'); // BOM so Excel opens UTF-8 correctly
}

export function tableToCSV(rows) {
  if (!rows.length) return '\uFEFF';
  const cols = Object.keys(rows[0]);
  const out = [cols.map(esc).join(',')];
  for (const r of rows) out.push(cols.map((c) => esc(typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c])).join(','));
  return '\uFEFF' + out.join('\r\n');
}

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1F3D' } };
  row.alignment = { vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function reportToXLSX(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ledger';
  const ws = wb.addWorksheet('Report');
  ws.columns = report.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4), style: c.type === 'money' ? { numFmt: '#,##0' } : {} }));
  for (const r of report.rows) {
    const o = {};
    for (const c of report.columns) o[c.key] = c.type === 'money' ? Number(r[c.key] || 0) : cellValue(r[c.key], c.type);
    ws.addRow(o);
  }
  if (report.totals && Object.keys(report.totals).length) {
    const t = { [report.columns[0].key]: 'TOTAL' };
    for (const [k, v] of Object.entries(report.totals)) t[k] = v;
    const row = ws.addRow(t);
    row.font = { bold: true };
  }
  styleHeader(ws);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function tablesToXLSX(tables) {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(tables)) {
    const ws = wb.addWorksheet(name.slice(0, 31));
    const cols = rows.length ? Object.keys(rows[0]) : ['(empty)'];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 4) }));
    for (const r of rows) {
      const o = {};
      for (const c of cols) o[c] = typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c];
      ws.addRow(o);
    }
    styleHeader(ws);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function backupTables(client) {
  const q = async (sql) => (await client.query(sql)).rows;
  return {
    people: await q('SELECT * FROM people ORDER BY sr_no'),
    monthly_ledger: await q('SELECT * FROM monthly_ledger ORDER BY year, month, person_id'),
    payments: await q('SELECT * FROM payments ORDER BY year, month, id'),
    advances: await q('SELECT * FROM advances ORDER BY id'),
    advance_allocations: await q('SELECT * FROM advance_allocations ORDER BY advance_id, year, month'),
    monthly_closings: await q('SELECT id, year, month, is_closed, closed_at, closed_by_name, close_count, reopened_at, reopened_by_name, reopen_reason, snapshot FROM monthly_closings ORDER BY year, month'),
    closing_events: await q('SELECT * FROM closing_events ORDER BY id'),
    viewers: await q("SELECT id, username, name, is_active, created_at FROM users WHERE role='viewer' ORDER BY id"),
    viewer_assignments: await q('SELECT * FROM viewer_assignments ORDER BY viewer_id, person_id'),
    ledger_years: await q('SELECT * FROM ledger_years ORDER BY year'),
  };
}

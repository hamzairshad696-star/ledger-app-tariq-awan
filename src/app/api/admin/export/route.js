import { NextResponse } from 'next/server';
import { route, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { buildReport, reportFilters } from '@/lib/reports';
import { reportToCSV, reportToXLSX, backupTables, tablesToXLSX, tableToCSV } from '@/lib/export';
import { badRequest } from '@/lib/errors';
import { todayISO } from '@/lib/dates';
export const dynamic = 'force-dynamic';

function file(content, name, type) {
  return new NextResponse(content, {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
}
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// /api/admin/export?type=monthly|annual|person|advance|pending|closing|backup|table&format=csv|xlsx|json
export const GET = route(async (req) => {
  const sp = searchParams(req);
  const type = sp.get('type') || 'monthly';
  const format = sp.get('format') || 'csv';
  const stamp = todayISO();

  if (type === 'backup') {
    const tables = await backupTables(db());
    if (format === 'json') return file(JSON.stringify({ exportedAt: new Date().toISOString(), tables }, null, 2), `ledger-backup-${stamp}.json`, 'application/json');
    if (format === 'xlsx') return file(await tablesToXLSX(tables), `ledger-backup-${stamp}.xlsx`, XLSX);
    const table = sp.get('table');
    if (!tables[table]) throw badRequest('Choose a table to export.');
    return file(tableToCSV(tables[table]), `${table}-${stamp}.csv`, 'text/csv; charset=utf-8');
  }

  const report = await buildReport(db(), type, reportFilters(sp));
  const base = `${type}-report-${reportFilters(sp).year}${sp.get('month') ? `-${String(sp.get('month')).padStart(2, '0')}` : ''}`;
  if (format === 'xlsx') return file(await reportToXLSX(report), `${base}.xlsx`, XLSX);
  if (format === 'csv') return file(reportToCSV(report), `${base}.csv`, 'text/csv; charset=utf-8');
  throw badRequest('Unsupported export format.');
});

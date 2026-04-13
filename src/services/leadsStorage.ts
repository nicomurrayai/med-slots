import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { LeadEntry, LeadExportResult } from '../types/leads';
import { buildLeadExportFileName, formatLeadTimestamp } from '../utils/leads';

const DATABASE_NAME = 'med-slots-leads.db';
const DATABASE_VERSION = 1;
const LEADS_TABLE = 'lead_entries';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

type LeadRow = {
  id: number;
  email: string;
  capturedAtMs: number;
};

function mapLeadRow(row: LeadRow): LeadEntry {
  return {
    id: row.id,
    email: row.email,
    capturedAtMs: row.capturedAtMs,
  };
}

function escapeCsvCell(value: string) {
  if (!/[;"\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

async function migrateDatabase(db: SQLite.SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentDbVersion = result?.user_version ?? 0;

    if (currentDbVersion >= DATABASE_VERSION) {
      return;
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${LEADS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        captured_at_ms INTEGER NOT NULL
      );
    `);

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrateDatabase(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function initDatabase() {
  await getDatabase();
}

export async function saveLead(email: string) {
  const db = await getDatabase();
  const capturedAtMs = Date.now();
  const result = await db.runAsync(
    `INSERT INTO ${LEADS_TABLE} (email, captured_at_ms) VALUES (?, ?)`,
    email,
    capturedAtMs,
  );

  return {
    id: Number(result.lastInsertRowId),
    email,
    capturedAtMs,
  } satisfies LeadEntry;
}

export async function getLeadCount() {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM ${LEADS_TABLE}`,
  );

  return result?.total ?? 0;
}

export async function clearLeads() {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM ${LEADS_TABLE}`);
}

export async function getRecentLeads(limit: number) {
  const db = await getDatabase();
  const resolvedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.getAllAsync<LeadRow>(
    `SELECT id, email, captured_at_ms AS capturedAtMs
     FROM ${LEADS_TABLE}
     ORDER BY captured_at_ms DESC, id DESC
     LIMIT ?`,
    resolvedLimit,
  );

  return rows.map(mapLeadRow);
}

export async function exportLeadsCsv() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LeadRow>(
    `SELECT id, email, captured_at_ms AS capturedAtMs
     FROM ${LEADS_TABLE}
     ORDER BY captured_at_ms ASC, id ASC`,
  );
  const exportDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  if (!exportDirectory) {
    throw new Error('No export directory available for this device.');
  }

  const fileName = buildLeadExportFileName();
  const fileUri = `${exportDirectory}${fileName}`;
  const csvRows = [
    '\uFEFFemail;captured_at',
    ...rows.map((row) => `${escapeCsvCell(row.email)};${escapeCsvCell(formatLeadTimestamp(row.capturedAtMs))}`),
  ];

  await FileSystem.writeAsStringAsync(fileUri, csvRows.join('\n'));

  return {
    fileName,
    fileUri,
    totalLeads: rows.length,
  } satisfies LeadExportResult;
}

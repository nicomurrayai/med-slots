import { LeadEntry, LeadExportResult } from '../types/leads';
import { buildLeadExportFileName, formatLeadTimestamp } from '../utils/leads';

const STORAGE_KEY = 'med-slots-leads-web';

function isLeadEntry(value: unknown): value is LeadEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.email === 'string' &&
    typeof candidate.capturedAtMs === 'number'
  );
}

function readStoredLeads() {
  if (typeof window === 'undefined') {
    return [] as LeadEntry[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [] as LeadEntry[];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [] as LeadEntry[];
    }

    return parsedValue.filter(isLeadEntry);
  } catch {
    return [] as LeadEntry[];
  }
}

function writeStoredLeads(leads: LeadEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function escapeCsvCell(value: string) {
  if (!/[;"\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export async function initDatabase() {
  readStoredLeads();
}

export async function saveLead(email: string) {
  const leads = readStoredLeads();
  const nextId = leads.length > 0 ? Math.max(...leads.map((lead) => lead.id)) + 1 : 1;
  const lead = {
    id: nextId,
    email,
    capturedAtMs: Date.now(),
  } satisfies LeadEntry;

  writeStoredLeads([...leads, lead]);
  return lead;
}

export async function getLeadCount() {
  return readStoredLeads().length;
}

export async function clearLeads() {
  writeStoredLeads([]);
}

export async function getRecentLeads(limit: number) {
  const resolvedLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  return readStoredLeads()
    .slice()
    .sort((left, right) => right.capturedAtMs - left.capturedAtMs || right.id - left.id)
    .slice(0, resolvedLimit);
}

export async function exportLeadsCsv() {
  const leads = readStoredLeads()
    .slice()
    .sort((left, right) => left.capturedAtMs - right.capturedAtMs || left.id - right.id);
  const fileName = buildLeadExportFileName();
  const csvContent = [
    '\uFEFFemail;captured_at',
    ...leads.map((lead) => `${escapeCsvCell(lead.email)};${escapeCsvCell(formatLeadTimestamp(lead.capturedAtMs))}`),
  ].join('\n');
  let fileUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    fileUri = objectUrl;
  }

  return {
    fileName,
    fileUri,
    totalLeads: leads.length,
  } satisfies LeadExportResult;
}

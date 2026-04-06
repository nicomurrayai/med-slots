function padTimePart(value: number) {
  return String(value).padStart(2, '0');
}

export function formatLeadTimestamp(capturedAtMs: number) {
  const date = new Date(capturedAtMs);

  return [
    date.getFullYear(),
    padTimePart(date.getMonth() + 1),
    padTimePart(date.getDate()),
  ].join('-') + ` ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
}

export function buildLeadExportFileName(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    padTimePart(date.getMonth() + 1),
    padTimePart(date.getDate()),
  ].join('-') + `-${padTimePart(date.getHours())}-${padTimePart(date.getMinutes())}`;

  return `med-slots-leads-${stamp}.csv`;
}

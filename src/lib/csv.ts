export const toCsv = (rows: object[]) => {
  if (rows.length === 0) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row as Record<string, unknown>).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));
  return [headers, ...rows.map(row => {
    const record = row as Record<string, unknown>;
    return headers.map(header => record[header] ?? '');
  })]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

export const downloadCsv = (fileName: string, rows: object[]) => {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

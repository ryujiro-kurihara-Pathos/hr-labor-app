export function convertRowsToCsv<T extends Record<string, string | number | null | undefined>>(
    rows: T[]
  ): string {
    if (rows.length === 0) {
      return '';
    }
  
    const headers = Object.keys(rows[0]);
  
    const csvRows = [
      headers.join(','),
      ...rows.map(row =>
        headers
          .map(header => escapeCsvValue(row[header]))
          .join(',')
      ),
    ];
  
    return csvRows.join('\n');
  }
  
  function escapeCsvValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
  
    const text = String(value);
  
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
  
    return text;
  }
  
  export function downloadCsv(csvText: string, fileName: string): void {
    const bom = '\uFEFF'; // Excelで日本語文字化けしにくくする
    const blob = new Blob([bom + csvText], {
      type: 'text/csv;charset=utf-8;',
    });
  
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  
    URL.revokeObjectURL(url);
  }
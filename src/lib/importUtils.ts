import * as XLSX from 'xlsx';

/**
 * Canonicalize a header string for matching against aliases.
 * - Lowercase
 * - Remove parenthetical content
 * - Replace # with "number", & with "and"
 * - Replace non-alphanumeric with underscores
 * - Trim leading/trailing underscores
 */
export function canonicalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/\(.*?\)/g, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/#/g, 'number')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parse a boolean value from various formats (YES/NO, Y/N, true/false, 1/0).
 */
export function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  const v = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  if (['no', 'n', 'false', '0', ''].includes(v)) return false;
  return null;
}

/**
 * Parse a number from various formats.
 */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const cleaned = String(value).trim().replace(/[$,]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse a date from various formats including Excel serial numbers.
 * Only treats numbers as Excel dates if they're in a reasonable range (1900-2100).
 */
export function parseDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  
  // Handle Excel date serial numbers - but only if in reasonable range
  // Excel date 1 = Jan 1, 1900, and ~73050 = Dec 31, 2099
  // We'll accept dates from 1950 (18264) to 2100 (73415)
  if (typeof value === 'number') {
    // If number is outside reasonable Excel date range, skip it
    if (value < 1 || value > 100000) {
      return null;
    }
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    // Validate the resulting date is reasonable (1950-2100)
    const year = date.getFullYear();
    if (year < 1950 || year > 2100) {
      return null;
    }
    return date.toISOString();
  }
  
  // Handle string dates
  const str = String(value).trim();
  if (!str) return null;
  
  // Skip values that look like IDs or codes (all numeric with no separators)
  if (/^\d{5,}$/.test(str)) {
    return null;
  }
  
  // Try parsing common formats: M/D/YYYY, M/D/YY, YYYY-MM-DD
  const parts = str.split('/');
  if (parts.length === 3) {
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000; // Handle 2-digit years
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1950 && year <= 2100) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  
  // Try standard Date parsing but validate result is reasonable
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    if (year >= 1950 && year <= 2100) {
      return date.toISOString();
    }
  }
  
  return null;
}

/**
 * Parse a CSV line handling quoted values.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * Parse a file (CSV or Excel) into headers and rows.
 */
export async function parseFileToRows(file: File): Promise<{ headers: string[]; rows: unknown[][] }> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workbook = XLSX.read(buffer, { type: 'array' } as any);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    const cleaned = data.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
    if (cleaned.length < 1) {
      return { headers: [], rows: [] };
    }
    
    const headers = (cleaned[0] || []).map((h) => String(h ?? '').trim());
    const rows = cleaned.slice(1);
    return { headers, rows };
  } else {
    // CSV
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((line) => line.trim());

    if (lines.length < 1) {
      return { headers: [], rows: [] };
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map((line) => parseCsvLine(line).map((v) => v.replace(/^"|"$/g, '')));
    return { headers, rows };
  }
}

/**
 * Map headers to field names using aliases.
 * @param headers Raw headers from the file
 * @param aliases Mapping of canonicalized header to field name
 * @returns Array of mapped field names (or null for unmapped columns)
 */
export function mapHeaders(headers: string[], aliases: Record<string, string>): (string | null)[] {
  return headers.map((header) => {
    const canonical = canonicalizeHeader(header);
    return aliases[canonical] || null;
  });
}

/**
 * Extract a URL from text (handles markdown links and plain URLs).
 */
export function extractUrl(value: string): string | null {
  if (!value) return null;
  
  // Extract URL from markdown link format [text](url)
  const markdownMatch = value.match(/\]\((https?:\/\/[^)]+)\)/);
  if (markdownMatch) return markdownMatch[1];
  
  // Match plain URLs
  const urlMatch = value.match(/(https?:\/\/[^\s<>)"]+)/);
  if (urlMatch) return urlMatch[1];
  
  return null;
}

import { AppData } from './models';
import { parseAppData } from './validate';

export function downloadJson(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ootss-cheatsheet-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<AppData> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('File is not valid JSON.');
  }
  return parseAppData(raw);
}

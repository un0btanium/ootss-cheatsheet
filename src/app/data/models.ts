export interface Category {
  id: string;
  name: string;
  textColor: string;
  bgColor: string;
}

export type Segment = { t: 'text'; text: string } | { t: 'cat'; id: string };

export interface Interaction {
  id: string;
  segments: Segment[];
  createdAt: number;
  updatedAt: number;
}

export const APP_ID = 'ootss-cheatsheet';
export const DATA_VERSION = 1;

export interface AppData {
  app: typeof APP_ID;
  version: typeof DATA_VERSION;
  categories: Category[];
  interactions: Interaction[];
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Merges adjacent text segments and drops empty ones. */
export function normalizeSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    if (s.t === 'text') {
      if (!s.text) continue;
      const last = out[out.length - 1];
      if (last?.t === 'text') {
        out[out.length - 1] = { t: 'text', text: last.text + s.text };
        continue;
      }
    }
    out.push(s);
  }
  return out;
}

/** Plain-text rendering of an interaction, using category names. */
export function segmentsToPlainText(
  segments: Segment[],
  categoryById: ReadonlyMap<string, Category>,
): string {
  return segments
    .map((s) => (s.t === 'text' ? s.text : (categoryById.get(s.id)?.name ?? '')))
    .join('');
}

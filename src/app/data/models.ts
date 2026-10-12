export interface Category {
  id: string;
  name: string;
  textColor: string;
  bgColor: string;
  /** Sub-categories; a category may be a child of several parents. */
  childIds: string[];
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

/**
 * All sub-categories of `id`, recursively (breadth-first, excluding `id`).
 * Cycle-safe, so malformed data can't loop forever.
 */
export function descendantIds(id: string, categoryById: ReadonlyMap<string, Category>): string[] {
  const seen = new Set([id]);
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    for (const child of categoryById.get(queue.shift()!)?.childIds ?? []) {
      if (seen.has(child) || !categoryById.has(child)) continue;
      seen.add(child);
      out.push(child);
      queue.push(child);
    }
  }
  return out;
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

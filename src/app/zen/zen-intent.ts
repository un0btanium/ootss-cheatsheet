import { Category, Segment } from '../data/models';

/** What pressing Enter in the Zen input should do. */
export type ZenIntent =
  | { kind: 'none' }
  /** a) Add an existing category to the selection. */
  | { kind: 'select'; categoryId: string }
  /** b) Create a new category with this name. */
  | { kind: 'create-category'; name: string }
  /** c) Create a new interaction. */
  | { kind: 'create-interaction'; segments: Segment[] };

/**
 * Decides the intent from the input's segments:
 * a single category → select it; plain text → new category (or select it if the
 * name already exists); anything else mixing categories and text → new interaction.
 */
export function classifyZenInput(
  segments: Segment[],
  findByName: (name: string) => Category | undefined,
): ZenIntent {
  const cats = segments.filter((s) => s.t === 'cat');
  const text = segments
    .flatMap((s) => (s.t === 'text' ? [s.text] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cats.length && !text) return { kind: 'none' };
  if (cats.length === 1 && !text) return { kind: 'select', categoryId: cats[0].id };
  if (!cats.length) {
    const existing = findByName(text);
    return existing
      ? { kind: 'select', categoryId: existing.id }
      : { kind: 'create-category', name: text };
  }
  return { kind: 'create-interaction', segments };
}

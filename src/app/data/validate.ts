import {
  APP_ID,
  AppData,
  Category,
  DATA_VERSION,
  Interaction,
  normalizeSegments,
  Segment,
} from './models';

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates untrusted JSON (from storage or a user import) and returns clean AppData.
 * Throws an Error with a user-readable message if the shape is wrong.
 * Dangling category references in interactions are dropped.
 */
export function parseAppData(raw: unknown): AppData {
  if (!isObject(raw)) throw new Error('File does not contain a JSON object.');
  if (raw['app'] !== APP_ID) throw new Error('This is not an OotSS Cheatsheet export.');
  if (raw['version'] !== DATA_VERSION) {
    throw new Error(`Unsupported data version: ${String(raw['version'])}.`);
  }
  if (!Array.isArray(raw['categories']) || !Array.isArray(raw['interactions'])) {
    throw new Error('Missing "categories" or "interactions" list.');
  }

  const categories: Category[] = [];
  const ids = new Set<string>();
  for (const c of raw['categories']) {
    if (
      !isObject(c) ||
      typeof c['id'] !== 'string' ||
      typeof c['name'] !== 'string' ||
      typeof c['textColor'] !== 'string' ||
      typeof c['bgColor'] !== 'string' ||
      !COLOR_RE.test(c['textColor']) ||
      !COLOR_RE.test(c['bgColor'])
    ) {
      throw new Error('Invalid category entry.');
    }
    if (ids.has(c['id'])) throw new Error(`Duplicate category id "${c['id']}".`);
    const childIds = c['childIds'] ?? [];
    if (!Array.isArray(childIds) || childIds.some((id) => typeof id !== 'string')) {
      throw new Error('Invalid sub-categories of a category.');
    }
    ids.add(c['id']);
    categories.push({
      id: c['id'],
      name: c['name'],
      textColor: c['textColor'],
      bgColor: c['bgColor'],
      childIds: childIds as string[],
    });
  }
  // Drop unknown, self and duplicate sub-category references.
  for (const c of categories) {
    c.childIds = [...new Set(c.childIds)].filter((id) => id !== c.id && ids.has(id));
  }

  const interactions: Interaction[] = [];
  for (const i of raw['interactions']) {
    if (!isObject(i) || typeof i['id'] !== 'string' || !Array.isArray(i['segments'])) {
      throw new Error('Invalid interaction entry.');
    }
    const segments: Segment[] = [];
    for (const s of i['segments']) {
      if (isObject(s) && s['t'] === 'text' && typeof s['text'] === 'string') {
        segments.push({ t: 'text', text: s['text'] });
      } else if (isObject(s) && s['t'] === 'cat' && typeof s['id'] === 'string') {
        if (ids.has(s['id'])) segments.push({ t: 'cat', id: s['id'] });
      } else {
        throw new Error('Invalid interaction segment.');
      }
    }
    const now = Date.now();
    interactions.push({
      id: i['id'],
      segments: normalizeSegments(segments),
      createdAt: typeof i['createdAt'] === 'number' ? i['createdAt'] : now,
      updatedAt: typeof i['updatedAt'] === 'number' ? i['updatedAt'] : now,
    });
  }

  return { app: APP_ID, version: DATA_VERSION, categories, interactions };
}

import { Category, normalizeSegments, Segment } from '../data/models';

/** DOM helpers for the contenteditable interaction editor. */

export const CHIP_CLASS = 'cat-chip';

export function applyChipStyle(chip: HTMLElement, category: Category): void {
  chip.textContent = category.name;
  chip.style.color = category.textColor;
  chip.style.backgroundColor = category.bgColor;
}

export function createChip(doc: Document, category: Category): HTMLSpanElement {
  const chip = doc.createElement('span');
  chip.className = CHIP_CLASS;
  chip.contentEditable = 'false';
  chip.dataset['catId'] = category.id;
  applyChipStyle(chip, category);
  return chip;
}

export function isChip(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.dataset['catId'] !== undefined;
}

/** Replaces the content of `root` with the given segments. Unknown categories are skipped. */
export function segmentsToDom(
  root: HTMLElement,
  segments: Segment[],
  categoryById: ReadonlyMap<string, Category>,
): void {
  const doc = root.ownerDocument;
  root.replaceChildren();
  for (const s of segments) {
    if (s.t === 'cat') {
      const category = categoryById.get(s.id);
      if (category) root.append(createChip(doc, category));
      continue;
    }
    s.text.split('\n').forEach((line, idx) => {
      if (idx > 0) root.append(doc.createElement('br'));
      if (line) root.append(doc.createTextNode(line));
    });
  }
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

/** Reads segments back from the editor DOM; trims surrounding whitespace. */
export function domToSegments(root: HTMLElement): Segment[] {
  const out: Segment[] = [];
  const walk = (node: Node): void => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out.push({ t: 'text', text: (child.textContent ?? '').replace(/ /g, ' ') });
      } else if (isChip(child)) {
        out.push({ t: 'cat', id: child.dataset['catId']! });
      } else if (child.nodeName === 'BR') {
        out.push({ t: 'text', text: '\n' });
      } else if (child instanceof HTMLElement) {
        // Browsers may wrap lines in block elements despite our key handling.
        if (BLOCK_TAGS.has(child.nodeName) && out.length) out.push({ t: 'text', text: '\n' });
        walk(child);
      }
    });
  };
  walk(root);

  const segments = normalizeSegments(out);
  const first = segments[0];
  if (first?.t === 'text') segments[0] = { t: 'text', text: first.text.trimStart() };
  const last = segments[segments.length - 1];
  if (last?.t === 'text') segments[segments.length - 1] = { t: 'text', text: last.text.trimEnd() };
  return normalizeSegments(segments);
}

export interface CategoryMatch {
  category: Category;
  /** Number of characters before the caret to replace with the chip. */
  length: number;
}

/**
 * Finds categories whose name starts with the word(s) directly before the caret
 * (case-insensitive). Multi-word names are matched by considering up to as many
 * trailing words as the longest category name has. Longer matches come first.
 */
export function findMatches(textBeforeCaret: string, categories: Category[]): CategoryMatch[] {
  if (!textBeforeCaret || /\s$/.test(textBeforeCaret)) return [];
  const maxWords = Math.max(0, ...categories.map((c) => c.name.trim().split(/\s+/).length));

  // Start indices of the last `maxWords` words.
  const starts: number[] = [];
  for (let i = 0; i < textBeforeCaret.length; i++) {
    if (/\S/.test(textBeforeCaret[i]) && (i === 0 || /\s/.test(textBeforeCaret[i - 1]))) {
      starts.push(i);
    }
  }
  const candidates = starts.slice(-maxWords).reverse(); // shortest suffix first

  const seen = new Map<string, CategoryMatch>();
  for (const start of candidates) {
    const typed = textBeforeCaret.slice(start).replace(/\s+/g, ' ').toLocaleLowerCase();
    for (const category of categories) {
      const name = category.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      if (name.startsWith(typed)) {
        seen.set(category.id, { category, length: textBeforeCaret.length - start });
      }
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.length - a.length || a.category.name.localeCompare(b.category.name),
  );
}

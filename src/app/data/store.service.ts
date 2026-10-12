import { computed, effect, Injectable, signal } from '@angular/core';
import {
  APP_ID,
  AppData,
  Category,
  DATA_VERSION,
  Interaction,
  newId,
  normalizeSegments,
  Segment,
} from './models';
import { parseAppData } from './validate';

export const STORAGE_KEY = 'ootss-cheatsheet:v1';

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly _categories = signal<Category[]>([]);
  private readonly _interactions = signal<Interaction[]>([]);

  readonly categories = computed(() =>
    [...this._categories()].sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly interactions = this._interactions.asReadonly();

  readonly categoryById = computed(
    () => new Map(this._categories().map((c) => [c.id, c] as const)),
  );

  /** Number of interactions referencing each category id. */
  readonly usageCount = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this._interactions()) {
      for (const id of new Set(categoryIds(i))) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  });

  /** Last persistence error, if any (e.g. quota exceeded). */
  readonly saveError = signal<string | null>(null);

  constructor() {
    this.load();
    effect(() => this.persist(this.snapshot()));
  }

  snapshot(): AppData {
    return {
      app: APP_ID,
      version: DATA_VERSION,
      categories: this._categories(),
      interactions: this._interactions(),
    };
  }

  replaceAll(data: AppData): void {
    this._categories.set(data.categories);
    this._interactions.set(data.interactions);
  }

  // --- Categories ---

  findCategoryByName(name: string): Category | undefined {
    const key = name.trim().toLocaleLowerCase();
    return this._categories().find((c) => c.name.trim().toLocaleLowerCase() === key);
  }

  addCategory(data: Omit<Category, 'id' | 'childIds'> & { childIds?: string[] }): Category {
    const category: Category = {
      childIds: [],
      ...data,
      name: data.name.trim(),
      id: newId(),
    };
    this._categories.update((list) => [...list, category]);
    return category;
  }

  updateCategory(id: string, data: Partial<Omit<Category, 'id'>>): void {
    const patch = data.name !== undefined ? { ...data, name: data.name.trim() } : data;
    this._categories.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  /** Deletes a category; references in interactions become plain text of its name. */
  deleteCategory(id: string): void {
    const category = this.categoryById().get(id);
    if (!category) return;
    this._interactions.update((list) =>
      list.map((i) =>
        categoryIds(i).includes(id)
          ? {
              ...i,
              segments: normalizeSegments(
                i.segments.map((s) =>
                  s.t === 'cat' && s.id === id ? { t: 'text', text: category.name } : s,
                ),
              ),
            }
          : i,
      ),
    );
    this._categories.update((list) =>
      list
        .filter((c) => c.id !== id)
        .map((c) =>
          c.childIds.includes(id) ? { ...c, childIds: c.childIds.filter((x) => x !== id) } : c,
        ),
    );
  }

  // --- Interactions ---

  addInteraction(segments: Segment[]): Interaction {
    const now = Date.now();
    const interaction: Interaction = {
      id: newId(),
      segments: normalizeSegments(segments),
      createdAt: now,
      updatedAt: now,
    };
    this._interactions.update((list) => [interaction, ...list]);
    return interaction;
  }

  updateInteraction(id: string, segments: Segment[]): void {
    this._interactions.update((list) =>
      list.map((i) =>
        i.id === id ? { ...i, segments: normalizeSegments(segments), updatedAt: Date.now() } : i,
      ),
    );
  }

  deleteInteraction(id: string): void {
    this._interactions.update((list) => list.filter((i) => i.id !== id));
  }

  // --- Persistence ---

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.replaceAll(parseAppData(JSON.parse(raw)));
    } catch (e) {
      console.error('Could not load saved data', e);
    }
  }

  private persist(data: AppData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.saveError.set(null);
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : String(e));
    }
  }
}

export function categoryIds(interaction: Interaction): string[] {
  return interaction.segments.flatMap((s) => (s.t === 'cat' ? [s.id] : []));
}

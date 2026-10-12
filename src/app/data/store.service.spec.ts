import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY, StoreService } from './store.service';

describe('StoreService', () => {
  beforeEach(() => localStorage.clear());

  function create(): StoreService {
    TestBed.resetTestingModule();
    return TestBed.inject(StoreService);
  }

  it('updates categories by reference and counts usage', () => {
    const store = create();
    const key = store.addCategory({ name: ' Key ', textColor: '#000000', bgColor: '#ffffff' });
    store.addInteraction([
      { t: 'text', text: 'use ' },
      { t: 'cat', id: key.id },
    ]);
    store.updateCategory(key.id, { name: 'Golden Key' });

    expect(store.categoryById().get(key.id)?.name).toBe('Golden Key');
    expect(store.usageCount().get(key.id)).toBe(1);
    expect(store.findCategoryByName('golden key')?.id).toBe(key.id);
  });

  it('turns references into text when deleting a category', () => {
    const store = create();
    const key = store.addCategory({ name: 'Key', textColor: '#000000', bgColor: '#ffffff' });
    store.addInteraction([
      { t: 'text', text: 'use ' },
      { t: 'cat', id: key.id },
    ]);
    store.deleteCategory(key.id);

    expect(store.categories()).toEqual([]);
    expect(store.interactions()[0].segments).toEqual([{ t: 'text', text: 'use Key' }]);
  });

  it('persists to localStorage and loads it again', () => {
    const store = create();
    store.addCategory({ name: 'Lever', textColor: '#000000', bgColor: '#ffffff' });
    TestBed.tick();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Lever');

    expect(
      create()
        .categories()
        .map((c) => c.name),
    ).toEqual(['Lever']);
  });
});

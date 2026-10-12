import { parseAppData } from './validate';

const valid = {
  app: 'ootss-cheatsheet',
  version: 1,
  categories: [{ id: 'a', name: 'Key', textColor: '#ffffff', bgColor: '#123456' }],
  interactions: [
    {
      id: 'i',
      segments: [
        { t: 'text', text: 'use ' },
        { t: 'cat', id: 'a' },
        { t: 'cat', id: 'gone' },
      ],
    },
  ],
};

describe('parseAppData', () => {
  it('accepts valid data and drops dangling category references', () => {
    const data = parseAppData(valid);
    expect(data.categories.length).toBe(1);
    expect(data.interactions[0].segments).toEqual([
      { t: 'text', text: 'use ' },
      { t: 'cat', id: 'a' },
    ]);
  });

  it('defaults missing sub-categories and drops invalid references', () => {
    expect(parseAppData(valid).categories[0].childIds).toEqual([]);
    const data = parseAppData({
      ...valid,
      categories: [
        { ...valid.categories[0], childIds: ['b', 'a', 'gone', 'b'] },
        { id: 'b', name: 'Door', textColor: '#000000', bgColor: '#ffffff' },
      ],
    });
    expect(data.categories[0].childIds).toEqual(['b']);
    expect(() =>
      parseAppData({ ...valid, categories: [{ ...valid.categories[0], childIds: [1] }] }),
    ).toThrow();
  });

  it('rejects foreign or malformed data', () => {
    expect(() => parseAppData(null)).toThrow();
    expect(() => parseAppData({ ...valid, app: 'other' })).toThrow();
    expect(() => parseAppData({ ...valid, version: 2 })).toThrow();
    expect(() =>
      parseAppData({ ...valid, categories: [{ ...valid.categories[0], bgColor: 'red' }] }),
    ).toThrow();
  });
});

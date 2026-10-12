import { Category, descendantIds } from './models';

const cat = (id: string, childIds: string[] = []): Category => ({
  id,
  name: id,
  textColor: '#000000',
  bgColor: '#ffffff',
  childIds,
});
const map = (...cats: Category[]) => new Map(cats.map((c) => [c.id, c]));

describe('descendantIds', () => {
  it('collects nested sub-categories breadth-first', () => {
    const byId = map(cat('a', ['b', 'c']), cat('b', ['d']), cat('c'), cat('d'));
    expect(descendantIds('a', byId)).toEqual(['b', 'c', 'd']);
    expect(descendantIds('d', byId)).toEqual([]);
  });

  it('lists shared children once and ignores unknown ids', () => {
    const byId = map(cat('a', ['b', 'c', 'x']), cat('b', ['d']), cat('c', ['d']), cat('d'));
    expect(descendantIds('a', byId)).toEqual(['b', 'c', 'd']);
  });

  it('terminates on cycles', () => {
    const byId = map(cat('a', ['b']), cat('b', ['a']));
    expect(descendantIds('a', byId)).toEqual(['b']);
  });
});

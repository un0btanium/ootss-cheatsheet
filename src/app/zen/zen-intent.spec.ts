import { Category, Segment } from '../data/models';
import { classifyZenInput } from './zen-intent';

const fire: Category = {
  id: 'fire',
  name: 'Fire',
  textColor: '#ffffff',
  bgColor: '#c62828',
  childIds: [],
};
const findByName = (name: string) =>
  name.trim().toLocaleLowerCase() === 'fire' ? fire : undefined;
const classify = (...segments: Segment[]) => classifyZenInput(segments, findByName);
const cat = (id: string): Segment => ({ t: 'cat', id });
const text = (t: string): Segment => ({ t: 'text', text: t });

describe('classifyZenInput', () => {
  it('does nothing for empty input', () => {
    expect(classify()).toEqual({ kind: 'none' });
    expect(classify(text('  \n '))).toEqual({ kind: 'none' });
  });

  it('selects a single category, ignoring whitespace', () => {
    expect(classify(cat('ice'))).toEqual({ kind: 'select', categoryId: 'ice' });
    expect(classify(cat('ice'), text(' \n'))).toEqual({ kind: 'select', categoryId: 'ice' });
  });

  it('selects an existing category typed as plain text', () => {
    expect(classify(text('fire'))).toEqual({ kind: 'select', categoryId: 'fire' });
  });

  it('creates a category from plain text, collapsing whitespace', () => {
    expect(classify(text('Lava'))).toEqual({ kind: 'create-category', name: 'Lava' });
    expect(classify(text('Hot \n  Lava'))).toEqual({ kind: 'create-category', name: 'Hot Lava' });
  });

  it('creates an interaction from categories mixed with text', () => {
    const segments = [cat('fire'), text(' melts '), cat('ice')];
    expect(classify(...segments)).toEqual({ kind: 'create-interaction', segments });
    expect(classify(cat('fire'), text(' burns'))).toEqual({
      kind: 'create-interaction',
      segments: [cat('fire'), text(' burns')],
    });
  });

  it('creates an interaction from several categories without text', () => {
    const segments = [cat('fire'), text(' '), cat('ice')];
    expect(classify(...segments)).toEqual({ kind: 'create-interaction', segments });
  });
});

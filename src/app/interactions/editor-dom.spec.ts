import { Category, Segment } from '../data/models';
import { domToSegments, findMatches, segmentsToDom } from './editor-dom';

const cat = (id: string, name: string): Category => ({
  id,
  name,
  textColor: '#ffffff',
  bgColor: '#000000',
  childIds: [],
});

describe('findMatches', () => {
  const cats = [
    cat('1', 'Red Key'),
    cat('2', 'Red Door'),
    cat('3', 'Lever'),
    cat('4', 'The Red Gate'),
  ];

  it('matches a prefix of the current word, case-insensitively', () => {
    const m = findMatches('use the le', cats);
    expect(m.map((x) => x.category.name)).toEqual(['Lever']);
    expect(m[0].length).toBe(2);
  });

  it('returns nothing when the caret follows whitespace', () => {
    expect(findMatches('use the ', cats)).toEqual([]);
    expect(findMatches('', cats)).toEqual([]);
  });

  it('matches multi-word names across typed words', () => {
    const m = findMatches('open red k', cats);
    expect(m.map((x) => x.category.name)).toEqual(['Red Key']);
    expect(m[0].length).toBe('red k'.length);
  });

  it('includes matches of different lengths, longest first', () => {
    const m = findMatches('go to the red', cats);
    expect(m.map((x) => x.category.name)).toEqual(['The Red Gate', 'Red Door', 'Red Key']);
    expect(m[0].length).toBe('the red'.length);
    expect(m[1].length).toBe('red'.length);
  });

  it('only matches at word starts', () => {
    expect(findMatches('clever', cats)).toEqual([]);
  });
});

describe('segmentsToDom / domToSegments', () => {
  const byId = new Map([['1', cat('1', 'Red Key')]]);

  it('round-trips text, chips and newlines', () => {
    const segments: Segment[] = [
      { t: 'text', text: 'Use ' },
      { t: 'cat', id: '1' },
      { t: 'text', text: ' on door\nthen wait' },
    ];
    const root = document.createElement('div');
    segmentsToDom(root, segments, byId);
    expect(root.querySelector('[data-cat-id="1"]')?.textContent).toBe('Red Key');
    expect(domToSegments(root)).toEqual(segments);
  });

  it('skips unknown categories and trims surrounding whitespace', () => {
    const root = document.createElement('div');
    segmentsToDom(
      root,
      [
        { t: 'text', text: '  a ' },
        { t: 'cat', id: 'missing' },
        { t: 'text', text: ' b  ' },
      ],
      byId,
    );
    expect(domToSegments(root)).toEqual([{ t: 'text', text: 'a  b' }]);
  });

  it('treats block elements as line breaks', () => {
    const root = document.createElement('div');
    root.innerHTML = 'one<div>two</div>';
    expect(domToSegments(root)).toEqual([{ t: 'text', text: 'one\ntwo' }]);
  });
});

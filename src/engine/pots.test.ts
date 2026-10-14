import { describe, expect, it } from 'vitest';
import { awardPots, computePots } from './pots';

describe('side poty', () => {
  it('tři all in s různými stacky', () => {
    const pots = computePots([
      { id: 'a', committed: 100, folded: false },
      { id: 'b', committed: 300, folded: false },
      { id: 'c', committed: 500, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 300, eligible: ['a', 'b', 'c'] },
      { amount: 400, eligible: ['b', 'c'] },
      { amount: 200, eligible: ['c'] },
    ]);
  });

  it('složený hráč přispívá, ale nevyhrává', () => {
    const pots = computePots([
      { id: 'a', committed: 200, folded: true },
      { id: 'b', committed: 600, folded: false },
      { id: 'c', committed: 600, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 1400, eligible: ['b', 'c'] }]);
  });

  it('nejkratší stack vyhraje jen hlavní bank', () => {
    const pots = computePots([
      { id: 'a', committed: 100, folded: false },
      { id: 'b', committed: 300, folded: false },
      { id: 'c', committed: 300, folded: false },
    ]);
    const scores = new Map([
      ['a', 10],
      ['b', 5],
      ['c', 1],
    ]);
    const { won } = awardPots(pots, scores, ['a', 'b', 'c']);
    expect(won.get('a')).toBe(300);
    expect(won.get('b')).toBe(400);
    expect(won.get('c')).toBeUndefined();
  });

  it('dělení s lichým žetonem dostane první po dealerovi', () => {
    const { won } = awardPots([{ amount: 101, eligible: ['a', 'b'] }], new Map([['a', 5], ['b', 5]]), ['b', 'a']);
    expect(won.get('b')).toBe(51);
    expect(won.get('a')).toBe(50);
  });
});

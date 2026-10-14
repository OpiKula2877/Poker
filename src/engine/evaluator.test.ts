import { describe, expect, it } from 'vitest';
import { parseCards } from './cards';
import { bestHand, CAT, describeHand } from './evaluator';

const best = (s: string) => bestHand(parseCards(s));

describe('kategorie', () => {
  const cases: [string, number][] = [
    ['As Jd 8c 6h 2s 3d 9c', CAT.HIGH],
    ['Qh Qc 9s 5d 3c 2h 7d', CAT.PAIR],
    ['Js Jd 7c 7h Ad 2c 3s', CAT.TWO_PAIR],
    ['8s 8h 8d Kc 4s 2d 3h', CAT.TRIPS],
    ['9c 8d 7s 6h 5c 2d 2h', CAT.STRAIGHT],
    ['Ad 2c 3h 4s 5d Kc Kd', CAT.STRAIGHT],
    ['Ad Jd 9d 6d 3d 2c 2h', CAT.FLUSH],
    ['Ts Th Tc 4d 4s 2c 3h', CAT.FULL_HOUSE],
    ['7s 7h 7d 7c Qh 2c 3h', CAT.QUADS],
    ['9h 8h 7h 6h 5h 2c 3d', CAT.STRAIGHT_FLUSH],
    ['As Ks Qs Js Ts 2c 3d', CAT.ROYAL_FLUSH],
  ];
  for (const [cards, cat] of cases) {
    it(`${cards} → ${cat}`, () => expect(best(cards).cat).toBe(cat));
  }
});

describe('porovnání', () => {
  it('kicker rozhoduje u páru', () => {
    expect(best('Ah Ad Kc 7s 4d 3c 2h').score).toBeGreaterThan(best('As Ac Qc 7d 4h 3s 2c').score);
  });
  it('wheel je nejnižší postupka', () => {
    expect(best('6c 5d 4h 3s 2c Kd 9h').score).toBeGreaterThan(best('Ad 2c 3h 4s 5d Kc 9d').score);
  });
  it('full house s vyšší trojicí vyhrává', () => {
    expect(best('Ks Kh Kd 2c 2s 7h 8d').score).toBeGreaterThan(best('Qs Qh Qd Ac As 7h 8d').score);
  });
  it('dvě trojice tvoří full house', () => {
    const h = best('9s 9h 9d 4c 4s 4h Kd');
    expect(h.cat).toBe(CAT.FULL_HOUSE);
    expect(h.ranks).toEqual([9, 4]);
  });
  it('stejné ruce jsou remíza', () => {
    expect(best('As Kd Qh Js 9c 3d 2h').score).toBe(best('Ac Kh Qd Jc 9s 3c 2s').score);
  });
});

describe('počítané karty a popis', () => {
  it('trojice: 3 počítané, 2 kickery', () => {
    const h = best('Kc Ah Kd 9c 4h Ks 2d');
    expect(h.cat).toBe(CAT.TRIPS);
    expect(h.counted).toBe(3);
    expect(h.cards.slice(0, 3).every((c) => c.r === 13)).toBe(true);
    expect(describeHand(h)).toBe('Trojice králů');
  });
  it('nejvyšší karta: 1 počítaná', () => {
    expect(best('As Jd 8c 6h 2s').counted).toBe(1);
  });
  it('méně než 5 karet (před flopem)', () => {
    const h = bestHand(parseCards('Qs Qd'));
    expect(h.cat).toBe(CAT.PAIR);
    expect(h.counted).toBe(2);
  });
});

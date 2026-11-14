import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, getLangMeta } from '@/lib/lang-meta';
import { dict, DictKey } from '@/lib/i18n';

describe('Module 4 — Multilingual Support (10 Indian Languages + English & Urdu RTL)', () => {
  it('supports all 11 required languages', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'ur', 'kn', 'or', 'ml']);
  });

  it('sets RTL direction strictly for Urdu and LTR for others', () => {
    expect(getLangMeta('ur').dir).toBe('rtl');
    for (const code of ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'or', 'ml'] as const) {
      expect(getLangMeta(code).dir).toBe('ltr');
    }
  });

  it('has complete non-empty dictionary coverage across all 11 languages', () => {
    const enKeys = Object.keys(dict.en) as DictKey[];
    expect(enKeys.length).toBeGreaterThan(150);

    for (const langMeta of SUPPORTED_LANGUAGES) {
      const table = dict[langMeta.code];
      expect(table).toBeDefined();
      for (const k of enKeys) {
        expect(typeof table[k]).toBe('string');
        expect(table[k].length).toBeGreaterThan(0);
      }
      // Verify core localized keys are translated into native script for non-English languages
      if (langMeta.code !== 'en') {
        expect(table.navFind).not.toBe(dict.en.navFind);
        expect(table.heroTitleLine1).not.toBe(dict.en.heroTitleLine1);
        expect(table.discoveryTitle).not.toBe(dict.en.discoveryTitle);
      }
    }
  });
});

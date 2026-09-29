import type { Dict } from './dictionaries/no';

export type FaqCategory = keyof Dict['faq']['categories'];

/** Rekkefølgen på spørsmålene, med kategorien de hører til. */
export const FAQ_ITEMS: { key: keyof Dict['faq']['items']; category: FaqCategory }[] = [
  { key: 'approved', category: 'certification' },
  { key: 'lengths', category: 'product' },
  { key: 'lifetime', category: 'product' },
  { key: 'mounting', category: 'installation' },
  { key: 'delivery', category: 'delivery' },
  { key: 'material', category: 'product' },
  { key: 'weight', category: 'product' },
  { key: 'selfMount', category: 'installation' },
  { key: 'parts', category: 'delivery' },
];

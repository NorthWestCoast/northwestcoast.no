import { no } from '@/lib/dictionaries/no';
import { GALLERY_TABS, isImageTag } from '@/lib/gallery-images';

/** Kategoriene er fanene på gallerisiden, med de norske navnene fra ordboken. */
export const GALLERY_CATEGORIES = GALLERY_TABS.map((value) => ({ value, label: no.gallery.tabs[value] }));

export const categoryName = (tag: string) => (isImageTag(tag) ? no.gallery.tabs[tag] : tag);

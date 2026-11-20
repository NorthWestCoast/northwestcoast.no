import type { MetadataRoute } from 'next';
import { getDict } from '@/lib/i18n';
import { THEME_COLOR } from '@/lib/site';

/**
 * Web App Manifest: navn, farger og ikoner når nettstedet legges på
 * hjem-skjermen eller festes i nettleseren. Ikonene lages av
 * scripts/generate-icons.mjs.
 *
 * `display: 'browser'` med vilje: dette er et nettsted, ikke en app som
 * skal åpnes uten adresselinje.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NorthWest Coast – Argostep',
    short_name: 'NWC',
    description: getDict('no').meta.home.description,
    lang: 'nb',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

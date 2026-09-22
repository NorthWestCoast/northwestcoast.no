import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Galleri',
  description:
    'Bilder av Argostep livbåtleider og oppbevaringsskap i bruk ombord på norske fiskefartøy, servicefartøy og brønnbåter.',
  path: '/galleri',
});

export default function GalleriLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

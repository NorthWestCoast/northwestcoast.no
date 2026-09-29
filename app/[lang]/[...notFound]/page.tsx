import { notFound } from 'next/navigation';

// Uten denne faller ukjente stier tilbake på Next sin standard-404, som ligger
// utenfor [lang] og derfor mangler både språk og design. Her havner de i stedet
// på app/[lang]/not-found.tsx, med riktig språk.
export default function CatchAllNotFound() {
  notFound();
}

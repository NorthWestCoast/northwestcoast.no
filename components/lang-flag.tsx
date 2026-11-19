'use client';

import { useId } from 'react';
import type { Lang } from '@/lib/i18n';

/**
 * Flaggene tegnes som SVG, ikke emoji: emoji-flagg rendres ikke i det hele
 * tatt på Windows, og kan uansett ikke ligge som bakgrunn bak teksten.
 * preserveAspectRatio="slice" gjør at flagget dekker hele knappen.
 */
export default function LangFlag({ lang }: { lang: Lang }) {
  const clipId = useId();

  if (lang === 'no') {
    return (
      <svg viewBox="0 0 22 16" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="22" height="16" fill="#BA0C2F" />
        <path d="M6 0h4v16H6z M0 6h22v4H0z" fill="#fff" />
        <path d="M7 0h2v16H7z M0 7h22v2H0z" fill="#00205B" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id={clipId}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0,0 L60,30 M60,0 L0,30"
        clipPath={`url(#${clipId})`}
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

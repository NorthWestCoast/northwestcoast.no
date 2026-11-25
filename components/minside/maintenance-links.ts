/**
 * Lenker for registrering av vedlikehold uten innlogging.
 *
 * Hvor lenge en lenke kan gjelde. Databasen tillater høyst et år
 * (maintenance_links_expiry).
 */
export const LINK_DAYS = [7, 30, 90, 365] as const;

export const linkDaysLabel = (days: number) =>
  days === 7 ? '1 uke' : days === 30 ? '1 måned' : days === 90 ? '3 måneder' : '1 år';

/** Tokenet i lenken: 24 tilfeldige byte, base64url. */
export const LINK_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

/** Adressen til skjemaet for en lenke. */
export const linkPath = (token: string) => `/registrer/${token}`;

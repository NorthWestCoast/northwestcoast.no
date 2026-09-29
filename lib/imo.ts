/**
 * IMO-nummer er sju sifre der det siste er en sjekksiffer:
 * sum(siffer 1–6 × vekt 7..2) mod 10 = siffer 7. Fanger de fleste tastefeil.
 */
export function normalizeImo(value: string): string {
  return value.replace(/^IMO\s*/i, '').replace(/\D/g, '');
}

export function isValidImo(value: string): boolean {
  const digits = normalizeImo(value);
  if (!/^\d{7}$/.test(digits)) return false;
  const sum = digits
    .slice(0, 6)
    .split('')
    .reduce((acc, d, i) => acc + Number(d) * (7 - i), 0);
  return sum % 10 === Number(digits[6]);
}

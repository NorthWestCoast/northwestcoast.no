/** Merge class names (lightweight alternative to clsx for this project) */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

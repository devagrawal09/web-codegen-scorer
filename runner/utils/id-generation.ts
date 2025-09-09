/**
 * Generates an ID from a display string.
 * Can return null if the string contains only invalid characters.
 */
export function generateId(value: string): string | null {
  const id = value
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .trim();
  return id.length > 0 ? id : null;
}

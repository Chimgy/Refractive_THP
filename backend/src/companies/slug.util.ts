import { randomBytes } from 'crypto';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base || 'company';
}

export function randomSlugSuffix(): string {
  return randomBytes(3).toString('hex');
}

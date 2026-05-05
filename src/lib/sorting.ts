export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: T;
  direction: SortDirection;
}

const normalizeValue = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value ?? '').toLowerCase();
};

export const compareValues = (a: unknown, b: unknown) => {
  const left = normalizeValue(a);
  const right = normalizeValue(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export const nextSortConfig = <T extends string>(current: SortConfig<T> | null, key: T): SortConfig<T> | null => {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
};

export const sortByConfig = <TItem, TKey extends string>(
  items: TItem[],
  config: SortConfig<TKey> | null,
  selectors: Record<TKey, (item: TItem) => unknown>
) => {
  if (!config) return items;
  const selector = selectors[config.key];
  if (!selector) return items;
  const direction = config.direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => compareValues(selector(a), selector(b)) * direction);
};

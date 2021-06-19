import { reactive } from "vue";

export const v = reactive<Record<string, any>>({});

export const vvv = v;

export const data = v;

export const ref = v;

/**
 * Gets a value from the global store
 */
export function get(
  key: string,
  def?: string | number | boolean
): string | number | boolean | undefined {
  return v?.[key] ?? def ?? undefined;
}

/**
 * Sets a value in the global store
 */
export function set(key: string, value: string | number | boolean | null) {
  v[key] = value;
}

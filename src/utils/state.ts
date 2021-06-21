import { reactive } from "vue";

export const ref = reactive<Record<string, any>>({});

export const $ = $ref;
/**
 * Gets a value from the global store
 */
export function get(
  key: string,
  def?: string | number | boolean
): string | number | boolean | undefined {
  return ref?.[key] ?? def ?? undefined;
}

/**
 * Sets a value in the global store
 */
export function set(key: string, value: string | number | boolean | null) {
  ref[key] = value;
}

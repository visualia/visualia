import { reactive } from "vue";

export const refs = reactive<Record<string, any>>({});

/**
 * Gets a value from the global store
 */
export function get(
  key: string,
  def?: string | number | boolean
): string | number | boolean | undefined {
  return refs?.[key] ?? def ?? undefined;
}

/**
 * Sets a value in the global store
 */
export function set(key: string, value: string | number | boolean | null) {
  refs[key] = value;
}

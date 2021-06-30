import { reactive } from "vue";

export const vis = reactive<Record<string, any>>({});

/**
 * Gets a value from the global store
 */
export function get(
  key: string,
  def?: string | number | boolean
): string | number | boolean | undefined {
  return vis?.[key] ?? def ?? undefined;
}

/**
 * Sets a value in the global store
 */
export function set(key: string, value: string | number | boolean | null) {
  vis[key] = value;
}

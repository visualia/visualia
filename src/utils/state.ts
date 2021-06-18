import { reactive } from "vue";
import { get as getObject, set as setObject } from "lodash-es";

export const v = reactive<Record<string, any>>({});

export const vvv = v;

export const data = v;

/**
 * Gets a value from the global store
 */
export function get(key?: string, def?: any): any {
  return key ? getObject(v, key, def) : v;
}

/**
 * Sets a value in the global store
 */
export function set(key: string, value: string | number | boolean | null) {
  setObject(v, key, value);
}

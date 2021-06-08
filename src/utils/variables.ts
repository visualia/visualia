import { reactive } from "vue";

export const state = reactive<Record<string, any>>({});

/**
 * Gets a value from the global store
 */
export function get(
  key: string,
  def?: string | number | boolean
): string | number | boolean | undefined {
  return state?.[key] ?? def ?? undefined;
}

/**
 * Sets a value in the global store
 */
export function set(key: string, value: string | number | boolean | null) {
  state[key] = value;
}

// export const state = ref<Record<string, any>>({});

// /**
//  * Sets a value in the global store
//  */
// export function set(key: string, value: string | number | boolean) {
//   state.value[key] = value;
// }

// /**
//  * Gets a value from the global store
//  */
// export function get(
//   key: string,
//   def?: string | number | boolean
// ): string | number | boolean | null {
//   return key ? state.value[key] : def ?? null;
// }

// /**
//  * Outputs a value to the console
//  */
// export function print(val: any) {
//   console.log(val);
// }

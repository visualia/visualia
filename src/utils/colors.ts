export function rgba(r: number, g: number, b: number, a: number = 1): string {
  return `rgba(${r},${g},${b},${a})`;
}

export const rgb = rgba;

export function hsla(h: number, s: number, l: number, a: number = 1): string {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

export const hsl = hsla;

export function hue(h: number): string {
  return hsla(h, 100, 50, 1);
}

export function gray(value: number): string {
  return rgba(value, value, value);
}

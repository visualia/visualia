export function translate(x: number = 0, y: number = 0): string {
  return `translate(${x} ${y})`;
}

// @TODO add transform origin `x` and `y`.

export function rotate(angle: number = 0, x?: number, y?: number): string {
  return `rotate(${angle},${x || 0},${y || 0})`;
}

export function scale(scaleX: number = 1, scaleY?: number): string {
  return `scale(${scaleX} ${scaleY || scaleX})`;
}

export function skewX(angle: number = 0): string {
  return `skewX(${angle})`;
}

export function skewY(angle: number = 0): string {
  return `skewY(${angle})`;
}

export function matrix(
  a: number = 1, // scaleX
  b: number = 0, // skewY
  c: number = 0, // skewX
  d: number = 1, // scaleY
  e: number = 0, // translateX
  f: number = 0 // translateY
): string {
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

export function translate(x: number | null, y: number | null): string {
  return `translate(${x || 0} ${y || 0})`;
}

// @TODO add transform origin `x` and `y`.

export function rotate(angle: number): string {
  return `rotate(${angle})`;
}

export function scale(scaleX: number, scaleY: string): string {
  return `scale(${scaleX} ${scaleY})`;
}

export function skewX(angle: number): string {
  return `skewX(${angle})`;
}

export function skewY(angle: number): string {
  return `skewY(${angle})`;
}

export function matrix(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
): string {
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

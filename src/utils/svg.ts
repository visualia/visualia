import { pol2car } from ".";

export function arc(
  startAngle: number,
  endAngle: number,
  radius: number
): string {
  const start = pol2car(endAngle, radius);
  const end = pol2car(startAngle, radius);

  const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";

  const d = [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    arcSweep,
    0,
    end.x,
    end.y,
  ].join(" ");

  return d;
}

export function translate(x: number, y: number): string {
  return `translate(${x} ${y})`;
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

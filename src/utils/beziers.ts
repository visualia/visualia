export function bezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4?: number,
  y4?: number
): string {
  const movePath = `M${x1},${y1}`;
  const bezierPath =
    x4 && y4
      ? `C${x2},${y2} ${x3},${y3} ${x4},${y4}`
      : `Q${x2},${y2} ${x3},${y3}`;
  return `${movePath} ${bezierPath}`;
}

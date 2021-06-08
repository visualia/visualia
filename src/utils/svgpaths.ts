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

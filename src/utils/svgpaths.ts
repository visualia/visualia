import { polar } from ".";

export function arc(
  startAngle: number,
  endAngle: number,
  radius: number
): string {
  const start = polar(endAngle, radius);
  const end = polar(startAngle, radius);

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

import { polar } from ".";

export function arcpath(
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

type LinepathCoord = {
  x: number;
  y: number;
};

export function linepath(
  coords: LinepathCoord[],
  closed: boolean = false
): string {
  const start = coords.shift();

  const d = [
    "M",
    start?.x || 0,
    start?.y || 0,
    ...coords.map((p) => `L ${p.x} ${p.y}`),
    closed ? "Z" : "",
  ].join(" ");

  return d;
}

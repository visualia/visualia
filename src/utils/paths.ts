import { arc } from "d3-shape";
import { polargrid } from ".";
import { deg2rad } from "./trig";

export function arcpath(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius?: number,
  cornerRadius?: number
): string | null {
  //@ts-ignore
  return arc()
    .startAngle(deg2rad(startAngle))
    .endAngle(deg2rad(endAngle))
    .innerRadius(innerRadius)
    .outerRadius(outerRadius || innerRadius)
    .cornerRadius(cornerRadius || 0)();
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

export function hexagonpath(radius: number, inner: boolean = false): string {
  return linepath(polargrid(6, radius, inner, true));
}

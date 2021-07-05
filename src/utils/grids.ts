import { range } from ".";
import { polar } from "./trig";

type RectgridItem = {
  x: number;
  y: number;
  col: number;
  row: number;
  index: number;
};

export function rectgrid(countX: number, countY: number, step: number = 1) {
  const items: RectgridItem[] = [];
  range(0, countY - 1)
    .map((y) => y * step)
    .forEach((y, row) => {
      range(0, countX - 1)
        .map((x) => x * step)
        .forEach((x, col) => {
          items.push({ x, y, row, col, index: row * countY + col });
        });
    });
  return items;
}

export function hexgrid(
  countX: number,
  countY: number,
  step: number = 1,
  outer: boolean = false
) {
  const items: RectgridItem[] = [];

  const ratio = Math.sqrt(3) / 2;
  const xstep = outer ? step : step * ratio;
  const ystep = outer ? step * ratio : step * ratio * ratio;

  range(0, countY - 1)
    .map((y) => y * ystep)
    .forEach((y, row) => {
      range(0, countX - 1)
        .map((x) => [x * xstep, x * xstep - xstep / 2][row % 2])
        .forEach((x, col) => {
          items.push({ x, y, row, col, index: row * countY + col });
        });
    });

  return items;
}
type PolargridItem = {
  x: number;
  y: number;
  angle: number;
  radius: number;
  index: number;
};

export function polargrid(
  count: number,
  radius: number,
  outer: boolean = false,
  closed: boolean = false
) {
  const outerRatio = 2 / Math.sqrt(3);
  const items: PolargridItem[] = range(0, count - 1)
    .map((_, index) => (360 / count) * index)
    .map((angle, index) => ({
      ...polar(angle, outer ? radius * outerRatio : radius),
      angle,
      radius,
      outerradius: outer ? radius * outerRatio : radius,
      index,
    }));
  if (closed) {
    items.push(items[0]);
  }
  return items;
}

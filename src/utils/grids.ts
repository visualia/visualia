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
    .map((x) => x * step)
    .forEach((x, row) => {
      range(0, countX - 1)
        .map((y) => y * step)
        .forEach((y, col) => {
          items.push({ x, y, row, col, index: col * countX + row });
        });
    });
  return items;
}

type PolargridItem = {
  x: number;
  y: number;
  index: number;
};

export function polargrid(
  count: number,
  radius: number,
  closed: boolean = false
) {
  const items: PolargridItem[] = range(0, count - 1).map((index) => ({
    ...polar((360 / count) * index, radius),
    index,
  }));
  if (closed) {
    items.push(items[0]);
  }
  return items;
}

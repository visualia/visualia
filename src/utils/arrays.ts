export function range(from: number, to: number): number[] {
  const length = Math.floor((to - from) / 1) + 1;
  return Array.from({ length }).map((_, i) => from + i);
}

export function chunk(arr: any[], length: number): any[][] {
  return Array.from({ length: Math.ceil(arr.length / length) }).map((_, n) =>
    arr.slice(n * length, n * length + length)
  );
}

export function rectGrid(from: number, to: number, step: number = 10) {
  const length = Math.floor((to - from) / step) + 1;
  return chunk(range(0, length * length - 1), length)
    .map((row, y) =>
      row.map((index, x) => ({ x: x * step, y: y * step, index }))
    )
    .flat();
}

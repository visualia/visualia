export function range(from: number, to: number, step: number = 1): number[] {
  const length = Math.floor((to - from) / step) + 1;
  return Array.from({ length }).map((_, i) => from + i * step);
}

export function chunk(arr: any[], length: number): any[][] {
  return Array.from({ length: Math.ceil(arr.length / length) }).map((_, n) =>
    arr.slice(n * length, n * length + length)
  );
}

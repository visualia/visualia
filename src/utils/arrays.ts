export function range(from: number, to: number): number[] {
  const length = Math.floor((to - from) / 1) + 1;
  return Array.from({ length }).map((_, i) => from + i);
}

export function chunk(arr: any[], length: number): any[][] {
  return Array.from({ length: Math.ceil(arr.length / length) }).map((_, n) =>
    arr.slice(n * length, n * length + length)
  );
}

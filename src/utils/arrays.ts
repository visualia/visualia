export function range(from: number, to: number): number[] {
  const length = Math.floor((to - from) / 1) + 1;
  return Array.from({ length }).map((_, i) => from + i);
}

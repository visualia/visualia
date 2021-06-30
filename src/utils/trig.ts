/**
 * Converts degrees to radians
 */
export function deg2rad(deg: number = 0): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function rad2deg(rad: number = 0): number {
  return (rad * 180) / Math.PI;
}

/**
 * Converts polar coordinates to Cartesian coordinates
 */
export function pol2car(
  angle: number = 0,
  radius: number = 0
): { x: number; y: number } {
  return {
    x: Math.cos((angle - 90) * (Math.PI / 180)) * radius,
    y: Math.sin((angle - 90) * (Math.PI / 180)) * radius,
  };
}

/**
 * Converts Cartesian coordinates to polar coordinates
 */
export function car2pol(
  x: number = 0,
  y: number = 0
): { angle: number; radius: number } {
  return {
    angle: Math.atan2(y, x) * (180 / Math.PI),
    radius: Math.sqrt(x * x + y * y),
  };
}

export const PI = Math.PI;

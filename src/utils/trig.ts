/**
 * Converts degrees to radians
 */
export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Converts polar coordinates to Cartesian coordinates
 */
export function pol2car(
  angle: number,
  radius: number
): { x: number; y: number } {
  return {
    x: Math.cos((angle - 90) * (Math.PI / 180)) * radius,
    y: Math.sin((angle - 90) * (Math.PI / 180)) * radius,
  };
}

export function polarx(angle: number, radius: number): number {
  return pol2car(angle, radius).x;
}

export function polary(angle: number, radius: number): number {
  return pol2car(angle, radius).y;
}

/**
 * Converts Cartesian coordinates to polar coordinates
 */
export function car2pol(
  x: number,
  y: number
): { angle: number; radius: number } {
  return {
    angle: Math.atan2(y, x) * (180 / Math.PI),
    radius: Math.sqrt(x * x + y * y),
  };
}

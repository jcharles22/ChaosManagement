export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function between(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function beltLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
  return len;
}

export function beltPointAt(
  points: { x: number; y: number }[],
  t: number,
): { x: number; y: number } {
  t = clamp(t, 0, 1);
  const total = beltLength(points);
  let target = t * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = dist(a.x, a.y, b.x, b.y);
    if (target <= seg || i === points.length - 1) {
      const u = seg === 0 ? 0 : target / seg;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    target -= seg;
  }
  return { ...points[points.length - 1] };
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

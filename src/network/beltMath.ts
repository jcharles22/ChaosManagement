export function beltLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function beltPointAt(
  points: { x: number; y: number }[],
  t: number,
): { x: number; y: number } {
  t = Math.max(0, Math.min(1, t));
  const total = beltLength(points);
  let target = t * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= seg || i === points.length - 1) {
      const u = seg === 0 ? 0 : target / seg;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    target -= seg;
  }
  return { ...points[points.length - 1] };
}

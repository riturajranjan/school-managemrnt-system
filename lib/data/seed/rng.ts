// Deterministic PRNG so seed data is identical on server and client render —
// Math.random() here would produce a hydration mismatch on every page that
// reads the mock store during SSR.
export function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededHelpers(seed: number) {
  const rand = mulberry32(seed);

  function int(min: number, max: number): number {
    return Math.floor(rand() * (max - min + 1)) + min;
  }

  function bool(probabilityTrue = 0.5): boolean {
    return rand() < probabilityTrue;
  }

  function pick<T>(items: readonly T[]): T {
    return items[int(0, items.length - 1)];
  }

  function pickMany<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const index = int(0, pool.length - 1);
      result.push(pool[index]);
      pool.splice(index, 1);
    }
    return result;
  }

  function daysAgoIso(days: number): string {
    const date = new Date("2026-08-05T09:00:00Z");
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString();
  }

  function daysFromNowIso(days: number): string {
    return daysAgoIso(-days);
  }

  return { rand, int, bool, pick, pickMany, daysAgoIso, daysFromNowIso };
}

import { describe, expect, it } from "vitest";
import { checkLoginRate, registerFailure, registerSuccess } from "./rate-limit";

// Each test uses a unique key so the in-process buckets don't collide.
let n = 0;
const key = () => `test-${n++}-${Math.random()}`;

describe("login rate limiter", () => {
  it("allows attempts under the threshold", () => {
    const k = key();
    for (let i = 0; i < 9; i++) registerFailure(k);
    expect(checkLoginRate(k).allowed).toBe(true);
  });

  it("blocks once the threshold is exceeded", () => {
    const k = key();
    for (let i = 0; i < 10; i++) registerFailure(k);
    const res = checkLoginRate(k);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBeGreaterThan(0);
  });

  it("clears the bucket on a successful login", () => {
    const k = key();
    for (let i = 0; i < 10; i++) registerFailure(k);
    registerSuccess(k);
    expect(checkLoginRate(k).allowed).toBe(true);
  });

  it("starts allowed for an unseen key", () => {
    expect(checkLoginRate(key()).allowed).toBe(true);
  });
});

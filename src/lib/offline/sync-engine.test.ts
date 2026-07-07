import { describe, it, expect } from "vitest";
import { classifyResponse, backoffDelay } from "./sync-engine";

describe("classifyResponse (offline sync outcome)", () => {
  it("2xx → ack (drop the acked keys)", () => {
    expect(classifyResponse(200)).toBe("ack");
    expect(classifyResponse(201)).toBe("ack");
  });

  it("5xx, 401, and 429 → retry (leave queued — valid marks must not be lost)", () => {
    expect(classifyResponse(500)).toBe("retry");
    expect(classifyResponse(503)).toBe("retry");
    expect(classifyResponse(401)).toBe("retry"); // re-auth then replay
    expect(classifyResponse(429)).toBe("retry"); // rate-limited — transient, retry
  });

  it("terminal 4xx → drop (preserved in the failed store, not looped)", () => {
    expect(classifyResponse(400)).toBe("drop"); // malformed
    expect(classifyResponse(403)).toBe("drop"); // no permission on the event
    expect(classifyResponse(404)).toBe("drop"); // event deleted
  });
});

describe("backoffDelay", () => {
  it("doubles from 2s and caps at 30s", () => {
    expect(backoffDelay(0)).toBe(2_000);
    expect(backoffDelay(1)).toBe(4_000);
    expect(backoffDelay(2)).toBe(8_000);
    expect(backoffDelay(3)).toBe(16_000);
    expect(backoffDelay(4)).toBe(30_000); // 32s capped
    expect(backoffDelay(10)).toBe(30_000);
  });
  it("treats negative attempts as 0", () => {
    expect(backoffDelay(-5)).toBe(2_000);
  });
});

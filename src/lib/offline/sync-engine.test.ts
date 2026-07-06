import { describe, it, expect } from "vitest";
import { classifyResponse } from "./sync-engine";

describe("classifyResponse (offline sync outcome)", () => {
  it("2xx → ack (drop the acked keys)", () => {
    expect(classifyResponse(200)).toBe("ack");
    expect(classifyResponse(201)).toBe("ack");
  });

  it("5xx and 401 → retry (leave queued)", () => {
    expect(classifyResponse(500)).toBe("retry");
    expect(classifyResponse(503)).toBe("retry");
    expect(classifyResponse(401)).toBe("retry"); // re-auth then replay
  });

  it("terminal 4xx → drop (don't loop forever)", () => {
    expect(classifyResponse(400)).toBe("drop"); // malformed / event closed
    expect(classifyResponse(403)).toBe("drop"); // no permission on the event
    expect(classifyResponse(404)).toBe("drop"); // event deleted
  });
});

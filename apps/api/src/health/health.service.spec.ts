import { describe, expect, it } from "vitest";

import { HealthService } from "./health.service.js";

describe("HealthService", () => {
  it("reports the API as available without claiming database readiness", () => {
    const service = new HealthService();

    expect(service.getLiveStatus()).toEqual({
      service: "hansa-field-api",
      status: "ok",
    });
  });
});

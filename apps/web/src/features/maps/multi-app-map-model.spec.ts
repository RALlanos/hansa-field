import { describe, expect, it } from "vitest";

import { buildMapRecordsUrl } from "./multi-app-map-model";

describe("buildMapRecordsUrl", () => {
  it("builds a bounded request for all selected Apps", () => {
    const url = buildMapRecordsUrl(
      "http://localhost:3100",
      {
        mode: "project",
        bbox: [-69.123_456_7, -23, -57, -9.123_456_7],
        zoom: 8.4,
        appIds: ["app-one", "app-two"],
        projectIds: ["project-one"],
      },
    );

    expect(url).toBe(
      "http://localhost:3100/api/workspace/map?mode=project&bbox=-69.12346%2C-23%2C-57%2C-9.12346&zoom=8&budget=2000&appIds=app-one%2Capp-two&projectIds=project-one",
    );
  });
});

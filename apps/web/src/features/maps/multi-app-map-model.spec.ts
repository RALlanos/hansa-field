import { describe, expect, it } from "vitest";

import {
  buildMapRecordsUrl,
  buildProjectRecordsUrl,
} from "./multi-app-map-model";

describe("buildMapRecordsUrl", () => {
  it("builds a bounded request for all selected Apps", () => {
    const url = buildMapRecordsUrl(
      "http://localhost:3100",
      [-69.123_456_7, -23, -57, -9.123_456_7],
      8.4,
      ["app-one", "app-two"],
      "project-one",
    );

    expect(url).toBe(
      "http://localhost:3100/api/map/records?bbox=-69.12346%2C-23%2C-57%2C-9.12346&zoom=8&projectAppIds=app-one%2Capp-two&projectId=project-one",
    );
  });
});

describe("buildProjectRecordsUrl", () => {
  it("keeps the project scope separate from standalone App records", () => {
    expect(
      buildProjectRecordsUrl(
        "http://localhost:3100",
        "project-one",
        ["app-one", "app-two"],
        [-69.123_456_7, -23, -57, -9.123_456_7],
        2,
      ),
    ).toBe(
      "http://localhost:3100/api/projects/project-one/records?projectAppIds=app-one%2Capp-two&bbox=-69.12346%2C-23%2C-57%2C-9.12346&page=2&pageSize=50",
    );
  });
});

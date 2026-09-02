import { describe, expect, it } from "vitest";

import { duplicateField, removeField, type AppSchema } from "./model.js";

const source: AppSchema = {
  sections: [
    {
      id: "section",
      title: "General",
      fields: [
        {
          id: "field",
          key: "poste",
          label: "Poste",
          type: "shortText",
          required: false,
        },
      ],
    },
  ],
};

describe("app builder draft", () => {
  it("removes only the selected draft attribute", () => {
    expect(removeField(source, "field").sections[0]?.fields).toEqual([]);
    expect(source.sections[0]?.fields).toHaveLength(1);
  });

  it("duplicates an attribute with a distinct id and key", () => {
    const copy = duplicateField(source, "field").sections[0]?.fields ?? [];
    expect(copy).toHaveLength(2);
    expect(copy[0]?.key).not.toBe(copy[1]?.key);
    expect(copy[0]?.id).not.toBe(copy[1]?.id);
  });
});

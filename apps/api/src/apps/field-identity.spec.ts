import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { assertFieldIdentity } from "./field-identity.js";

const id = randomUUID();
const definition = (
  fieldId: string,
  label: string,
  type = "number",
  key = "height",
) => ({ sections: [{ fields: [{ id: fieldId, key, label, type }] }] });
it("allows label change while retaining stable field identity", () => {
  expect(() =>
    assertFieldIdentity(
      [definition(id, "Altura")],
      definition(id, "Altura del poste"),
    ),
  ).not.toThrow();
});
it("does not permit type or key replacement on an existing identity", () => {
  expect(() =>
    assertFieldIdentity(
      [definition(id, "Altura")],
      definition(id, "Altura", "shortText"),
    ),
  ).toThrow();
  expect(() =>
    assertFieldIdentity(
      [definition(id, "Altura")],
      definition(id, "Altura", "number", "other"),
    ),
  ).toThrow();
});
it("does not reuse an old key with a different identity even after a field was hidden", () => {
  expect(() =>
    assertFieldIdentity(
      [definition(id, "Tipo"), { sections: [] }],
      definition(randomUUID(), "Tipo"),
    ),
  ).toThrow();
});
it("same label permits two distinct fields with distinct keys", () => {
  expect(() =>
    assertFieldIdentity([], {
      sections: [
        {
          fields: [
            { id, key: "material", label: "Tipo", type: "shortText" },
            {
              id: randomUUID(),
              key: "structure",
              label: "Tipo",
              type: "shortText",
            },
          ],
        },
      ],
    }),
  ).not.toThrow();
});

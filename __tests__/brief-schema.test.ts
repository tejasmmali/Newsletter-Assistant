import { describe, expect, it } from "vitest";
import { briefResponseSchema } from "@/lib/brief";

describe("briefResponseSchema", () => {
  it("omits the constraints Gemini rejects as too many states", () => {
    const schema = briefResponseSchema();
    const encoded = JSON.stringify(schema);

    expect(encoded).not.toContain("minItems");
    expect(encoded).not.toContain("maxItems");
    expect(encoded).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    expect(schema.properties.claims.items.properties.type.enum).toEqual([
      "fact",
      "analysis",
      "speculation",
    ]);
    expect(schema.properties.claims.items.properties.source_id).toEqual({ type: "string" });
    expect(schema.properties.per_source.items.properties.source_id).toEqual({ type: "string" });
    expect(schema.required).toContain("cross_source");
  });
});

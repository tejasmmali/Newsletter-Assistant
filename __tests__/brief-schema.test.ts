import { describe, expect, it } from "vitest";
import { briefResponseSchema } from "@/lib/brief";

describe("briefResponseSchema", () => {
  it("limits claims and angles and only allows the given source ids", () => {
    const schema = briefResponseSchema([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    const claims = schema.properties.claims;
    const angles = schema.properties.story_angles;
    expect(claims.maxItems).toBe(12);
    expect(angles.minItems).toBe(2);
    expect(angles.maxItems).toBe(3);
    expect(claims.items.properties.source_id.enum).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});

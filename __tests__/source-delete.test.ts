import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn(async () => ({ error: null }));
const del = vi.fn(() => ({ eq }));

vi.mock("@/lib/supabase", () => ({
  getServiceSupabase: () => ({
    from: () => ({
      delete: del,
    }),
  }),
}));

import { DELETE } from "@/app/api/sources/[id]/route";

describe("DELETE /api/sources/[id]", () => {
  beforeEach(() => {
    eq.mockClear();
    del.mockClear();
  });

  it("rejects an id that is not a uuid", async () => {
    const response = await DELETE(new Request("http://localhost/api/sources/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(response.status).toBe(400);
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes a source row", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const response = await DELETE(new Request(`http://localhost/api/sources/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("id", id);
  });
});

import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/modules/reports/pdf", () => ({ generateShiftPdf: mocks.pdf }));
import { GET } from "@/app/api/reports/shifts/[id]/route";
const id = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
beforeEach(() => vi.resetAllMocks());
it("PDF failure can be retried without invoking any database mutation; selects the final pointer", async () => {
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn().mockReturnThis();
  const maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({
      data: { id, closed_at: "2026-09-11T09:00:00Z", final_closeout_id: versionId },
    })
    .mockResolvedValueOnce({ data: { version: 2, content_hash: "a".repeat(64), content: {} } });
  const from = vi.fn(() => ({ select, eq, maybeSingle }));
  mocks.client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    from,
  });
  mocks.pdf.mockRejectedValue(new Error("font unavailable"));
  const response = await GET(new Request("https://example.test"), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(503);
  expect(await response.text()).toContain("Tura rămâne închisă");
  expect(eq).toHaveBeenCalledWith("id", versionId);
  expect(eq).toHaveBeenCalledWith("state", "closed");
  expect(from.mock.calls).toEqual([["shifts"], ["closeout_versions"]]);
});
it("anonymous requests cannot query report records", async () => {
  const from = vi.fn();
  mocks.client.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from,
  });
  expect(
    (await GET(new Request("https://example.test"), { params: Promise.resolve({ id }) })).status,
  ).toBe(404);
  expect(from).not.toHaveBeenCalled();
  expect(mocks.pdf).not.toHaveBeenCalled();
});

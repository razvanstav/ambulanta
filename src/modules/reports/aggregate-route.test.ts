import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), read: vi.fn(), pdf: vi.fn() }));
vi.mock("@/modules/identity/server", () => ({ getIdentity: mocks.identity }));
vi.mock("@/modules/reports/server", () => ({ readReports: mocks.read }));
vi.mock("@/modules/reports/aggregate-pdf", () => ({ generateAggregatePdf: mocks.pdf }));
import { GET } from "@/app/api/reports/aggregate/route";
const station = "00000000-0000-4000-8000-000000000001";
const url = `https://example.test/api/reports/aggregate?station=${station}&from=2026-09-01&until=2026-09-12`;
beforeEach(() => {
  vi.resetAllMocks();
});
it("anonymous and unauthorized exports never read report data", async () => {
  mocks.identity.mockResolvedValue(null);
  expect((await GET(new Request(url))).status).toBe(404);
  mocks.identity.mockResolvedValue({ substations: [], roles: [] });
  expect((await GET(new Request(url))).status).toBe(404);
  mocks.identity.mockResolvedValue({
    substations: [{ id: station, active: true }],
    roles: [{ role: "shift_leader", substation_id: station }],
  });
  expect((await GET(new Request(url))).status).toBe(404);
  expect((await GET(new Request(url + "&own=1&kind=stock"))).status).toBe(404);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("PDF export keeps filters, requires own view and can retry a renderer failure", async () => {
  mocks.identity.mockResolvedValue({
    substations: [{ id: station, active: true }],
    roles: [{ role: "shift_leader", substation_id: station }],
  });
  mocks.read.mockResolvedValue({ own: true });
  mocks.pdf
    .mockRejectedValueOnce(new Error("renderer"))
    .mockResolvedValueOnce(new Uint8Array([37, 80, 68, 70]));
  expect((await GET(new Request(url + "&own=1&format=pdf"))).status).toBe(503);
  const response = await GET(new Request(url + "&own=1&format=pdf"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.read).toHaveBeenCalledWith(
    station,
    expect.objectContaining({ own: true, from: "2026-09-01", until: "2026-09-12" }),
  );
  expect((await GET(new Request(url + "&own=1&group=bad"))).status).toBe(400);
});

import { describe, expect, it } from "vitest";
import { parseMinimum, bucharestDate, lotStatus, validExpiry, canManageCatalog } from "./rules";

describe("cantități exacte și calendarul loturilor", () => {
  it("păstrează virgula zecimală fără rotunjire și respinge fracțiile incompatibile", () => {
    expect(parseMinimum("12,125", 3)).toBe("12.125");
    expect(parseMinimum("2.000", 0)).toBe("2.000");
    for (const value of [
      "-1",
      "",
      "NaN",
      "Infinity",
      "1e3",
      "1.2345",
      "1000000000",
      "1,2.3",
      "1 000",
    ])
      expect(parseMinimum(value, 3)).toBeNull();
    expect(parseMinimum("0.001", 0)).toBeNull();
    expect(parseMinimum("12.125", 2)).toBeNull();
    expect(parseMinimum("999999999.999", 3)).toBe("999999999.999");
  });
  it("expiră după sfârșitul zilei locale, inclusiv la schimbarea datei UTC", () => {
    const today = bucharestDate(new Date("2026-09-10T21:00:00Z"));
    expect(today).toBe("2026-09-11");
    expect(lotStatus(false, "2026-09-10", today)).toBe("Expirat");
    expect(lotStatus(false, today, today)).toBe("Valid");
    expect(lotStatus(true, null, today)).toBe("Blocat");
    expect(lotStatus(false, null, today)).toBe("Valid");
    expect(bucharestDate(new Date("2026-01-10T22:00:00Z"))).toBe("2026-01-11");
  });
  it("respinge date calendaristice inexistente", () => {
    expect(validExpiry("2028-02-29")).toBe(true);
    for (const date of ["2026-02-29", "2026-04-31", "0000-01-01", "2026-13-01", "10.09.2026"])
      expect(validExpiry(date)).toBe(false);
  });
  it("catalogul comun poate fi modificat numai de roluri instituționale", () => {
    for (const role of ["warehouse", "station_manager", "shift_leader"] as const)
      expect(canManageCatalog({ roles: [{ role, substation_id: "local" }] })).toBe(false);
    expect(canManageCatalog({ roles: [{ role: "logistics", substation_id: null }] })).toBe(true);
    expect(canManageCatalog({ roles: [{ role: "administrator", substation_id: null }] })).toBe(
      true,
    );
  });
});

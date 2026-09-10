import { describe, expect, it } from "vitest";
import {
  canAccessOwnedRecord,
  canViewLogistics,
  canManageStation,
  isAdmin,
  safeNextPath,
  type Identity,
} from "./policy";
const station = { id: "station-a", institution_id: "org", name: "Test", active: true };
const leader: Identity = {
  id: "leader-1",
  displayName: "Test",
  email: "test@example.invalid",
  institutionId: "org",
  roles: [{ role: "shift_leader", substation_id: station.id }],
  substations: [station],
};
describe("contractul de acces M02", () => {
  it("personalul și flota sunt administrate de șeful local sau administrator, nu de logistică", () => {
    expect(canManageStation(leader, station.id)).toBe(false);
    expect(
      canManageStation({ roles: [{ role: "logistics", substation_id: null }] }, station.id),
    ).toBe(false);
    expect(
      canManageStation(
        { roles: [{ role: "station_manager", substation_id: station.id }] },
        station.id,
      ),
    ).toBe(true);
    expect(
      canManageStation(
        { roles: [{ role: "station_manager", substation_id: station.id }] },
        "other",
      ),
    ).toBe(false);
    expect(
      canManageStation({ roles: [{ role: "administrator", substation_id: null }] }, station.id),
    ).toBe(true);
  });
  it("șeful de tură vede numai proprietarul propriu în substația atribuită", () => {
    expect(canAccessOwnedRecord(leader, station.id, leader.id)).toBe(true);
    expect(canAccessOwnedRecord(leader, station.id, "leader-2")).toBe(false);
    expect(canAccessOwnedRecord(leader, "station-b", leader.id)).toBe(false);
    expect(canViewLogistics(leader, station.id)).toBe(false);
  });
  it("logistica centrală are vedere de ansamblu fără administrarea conturilor", () => {
    const logistics: Identity = { ...leader, roles: [{ role: "logistics", substation_id: null }] };
    expect(canAccessOwnedRecord(logistics, station.id, "leader-2")).toBe(true);
    expect(isAdmin(logistics)).toBe(false);
  });
  it("gestionarul și șeful de substație nu primesc drepturi globale", () => {
    for (const role of ["warehouse", "station_manager"] as const) {
      const local: Identity = { ...leader, roles: [{ role, substation_id: station.id }] };
      expect(canViewLogistics(local, station.id)).toBe(true);
      expect(canViewLogistics(local, "station-b")).toBe(false);
      expect(isAdmin(local)).toBe(false);
    }
  });
  it("substația inactivă nu poate fi accesată", () => {
    expect(
      canAccessOwnedRecord(
        { ...leader, substations: [{ ...station, active: false }] },
        station.id,
        leader.id,
      ),
    ).toBe(false);
  });
  it("refuză redirecturi externe sau malformate", () => {
    for (const path of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/substatia/\nattack",
    ])
      expect(safeNextPath(path)).toBe("/");
    expect(safeNextPath("/administrare")).toBe("/administrare");
    expect(safeNextPath("/substatia/abc/tura-mea")).toBe("/substatia/abc/tura-mea");
  });
});

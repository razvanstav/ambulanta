export const roleLabels = {
  administrator: "Administrator instituție",
  logistics: "Logistică centrală",
  station_manager: "Șef de substație",
  warehouse: "Gestionar local",
  shift_leader: "Șef de tură",
} as const;
export type AppRole = keyof typeof roleLabels;
export type RoleAssignment = { role: AppRole; substation_id: string | null };
export type Substation = { id: string; institution_id: string; name: string; active: boolean };
export type Identity = {
  id: string;
  institutionId: string;
  displayName: string;
  email: string;
  roles: RoleAssignment[];
  substations: Substation[];
};
export const isAdmin = (identity: Pick<Identity, "roles">) =>
  identity.roles.some((item) => item.role === "administrator" && item.substation_id === null);
export function stationRoles(identity: Pick<Identity, "roles">, stationId: string) {
  return identity.roles
    .filter(
      (item) =>
        item.substation_id === stationId ||
        (item.substation_id === null && ["administrator", "logistics"].includes(item.role)),
    )
    .map((item) => item.role);
}
export function canViewLogistics(identity: Pick<Identity, "roles">, stationId: string) {
  return stationRoles(identity, stationId).some((role) => role !== "shift_leader");
}
export function canUseMyShift(identity: Pick<Identity, "roles">, stationId: string) {
  return stationRoles(identity, stationId).includes("shift_leader");
}
export function canManageStation(identity: Pick<Identity, "roles">, stationId: string) {
  return stationRoles(identity, stationId).some(
    (role) => role === "administrator" || role === "station_manager",
  );
}
export function canAccessOwnedRecord(identity: Identity, stationId: string, ownerUserId: string) {
  if (!identity.substations.some((station) => station.id === stationId && station.active))
    return false;
  return (
    canViewLogistics(identity, stationId) ||
    (canUseMyShift(identity, stationId) && identity.id === ownerUserId)
  );
}
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function safeNextPath(value: unknown) {
  return typeof value === "string" &&
    /^\/(?:substatia\/|administrare(?:$|\?))/.test(value) &&
    !/[\\\r\n]/.test(value)
    ? value
    : "/";
}

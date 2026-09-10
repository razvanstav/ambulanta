import { stationRoles, type Identity } from "@/modules/identity/policy";
export const canOperateStock = (identity: Pick<Identity, "roles">, station: string) =>
  stationRoles(identity, station).some((role) =>
    ["administrator", "logistics", "warehouse"].includes(role),
  );
export const formatQuantity = (quantity: number) =>
  new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 }).format(quantity);

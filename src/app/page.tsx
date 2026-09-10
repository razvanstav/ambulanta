import { redirect } from "next/navigation";
import { requireIdentity } from "@/modules/identity/server";
import { isAdmin } from "@/modules/identity/policy";

export default async function Home() {
  const identity = await requireIdentity();
  if (isAdmin(identity)) redirect("/administrare");
  const station = identity.substations.find((item) => item.active);
  redirect(station ? `/substatia/${station.id}` : "/cont");
}

import Link from "next/link";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { PageHeading, Panel, StateMessage } from "@/components/ui/primitives";
import { requireIdentity } from "@/modules/identity/server";
import { roleLabels } from "@/modules/identity/policy";

export default async function AccountPage() {
  const identity = await requireIdentity();
  const stations = identity.substations.filter((station) => station.active);
  return (
    <AuthenticatedShell identity={identity}>
      <PageHeading
        eyebrow="CONT INDIVIDUAL"
        title={identity.displayName}
        description={identity.email}
      />
      <Panel
        title="Accesul tău"
        description="Drepturile sunt atribuite de administratorul instituției."
      >
        <ul className="access-list">
          {identity.roles.map((item, index) => (
            <li key={index}>
              {roleLabels[item.role]} ·{" "}
              {item.substation_id
                ? (identity.substations.find((station) => station.id === item.substation_id)
                    ?.name ?? "Substație inactivă")
                : "Toată instituția"}
            </li>
          ))}
        </ul>
        {stations.length ? (
          <div className="station-links">
            {stations.map((station) => (
              <Link
                className="button button-secondary"
                href={`/substatia/${station.id}`}
                key={station.id}
              >
                {station.name}
              </Link>
            ))}
          </div>
        ) : (
          <StateMessage
            kind="empty"
            title="Nicio substație disponibilă"
            description="Contul este autentificat. Administratorul trebuie să atribuie un rol într-o substație activă pentru a continua."
          />
        )}
      </Panel>
    </AuthenticatedShell>
  );
}

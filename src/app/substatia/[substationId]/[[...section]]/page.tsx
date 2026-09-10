import { notFound } from "next/navigation";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { PageHeading, Panel, LinkButton, StateMessage } from "@/components/ui/primitives";
import { requireSubstation } from "@/modules/identity/server";
import {
  canUseMyShift,
  canViewLogistics,
  stationRoles,
  roleLabels,
} from "@/modules/identity/policy";

export default async function SubstationPage({
  params,
}: {
  params: Promise<{ substationId: string; section?: string[] }>;
}) {
  const { substationId, section } = await params;
  const { identity, substation } = await requireSubstation(substationId);
  const page = section?.join("/") ?? "";
  if (!["", "logistica", "tura-mea"].includes(page)) notFound();
  const logistics = canViewLogistics(identity, substationId);
  const myShift = canUseMyShift(identity, substationId);
  if ((page === "logistica" && !logistics) || (page === "tura-mea" && !myShift)) notFound();
  return (
    <AuthenticatedShell identity={identity} stationId={substationId}>
      <PageHeading
        eyebrow={`SUBSTAȚIA ${substation.name.toLocaleUpperCase("ro-RO")}`}
        title={
          page === "tura-mea"
            ? "Tura mea"
            : page === "logistica"
              ? "Logistică / Magazie"
              : "Spațiul substației"
        }
        description={`Bine ai venit, ${identity.displayName}. ${stationRoles(identity, substationId)
          .map((role) => roleLabels[role])
          .join(" · ")}.`}
      />
      {!page ? (
        <Panel
          title="Alege spațiul de lucru"
          description="Sunt disponibile numai perspectivele pentru rolurile tale."
        >
          <div className="station-links">
            {logistics && (
              <LinkButton href={`/substatia/${substationId}/logistica`}>
                Logistică / Magazie
              </LinkButton>
            )}
            {myShift && (
              <LinkButton variant="secondary" href={`/substatia/${substationId}/tura-mea`}>
                Tura mea
              </LinkButton>
            )}
          </div>
        </Panel>
      ) : (
        <Panel title={page === "tura-mea" ? "Turele tale" : "Evidența substației"}>
          <StateMessage
            kind="waiting"
            title="Acest spațiu este în pregătire"
            description={
              page === "tura-mea"
                ? "Accesul este verificat. Inițierea turelor și fișele proprii vor fi disponibile după configurarea echipajelor, mașinilor și stocului."
                : "Accesul la această substație este verificat. Echipajele, mașinile și gestiunea produselor se introduc în etapele următoare."
            }
          />
        </Panel>
      )}
    </AuthenticatedShell>
  );
}

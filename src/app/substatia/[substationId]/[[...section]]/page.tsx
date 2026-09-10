import { notFound } from "next/navigation";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { PageHeading, Panel, LinkButton } from "@/components/ui/primitives";
import { EmployeesPage } from "@/modules/employees/page";
import { VehiclesPage } from "@/modules/vehicles/page";
import { LogisticsWorkspace, MyHolderWorkspace } from "@/modules/employees/workspace";
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
  if (!["", "logistica", "tura-mea", "personal", "masini"].includes(page)) notFound();
  const logistics = canViewLogistics(identity, substationId);
  const myShift = canUseMyShift(identity, substationId);
  if (
    (["logistica", "personal", "masini"].includes(page) && !logistics) ||
    (page === "tura-mea" && !myShift)
  )
    notFound();
  return (
    <AuthenticatedShell identity={identity} stationId={substationId}>
      <PageHeading
        eyebrow={`SUBSTAȚIA ${substation.name.toLocaleUpperCase("ro-RO")}`}
        title={
          page === "tura-mea"
            ? "Tura mea"
            : page === "personal"
              ? "Personal"
              : page === "masini"
                ? "Mașini"
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
      ) : page === "personal" ? (
        <EmployeesPage stationId={substationId} identity={identity} />
      ) : page === "masini" ? (
        <VehiclesPage stationId={substationId} identity={identity} />
      ) : page === "logistica" ? (
        <LogisticsWorkspace stationId={substationId} />
      ) : (
        <MyHolderWorkspace stationId={substationId} />
      )}
    </AuthenticatedShell>
  );
}

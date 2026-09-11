import { notFound } from "next/navigation";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { PageHeading, Panel, LinkButton } from "@/components/ui/primitives";
import { EmployeesPage } from "@/modules/employees/page";
import { VehiclesPage } from "@/modules/vehicles/page";
import { CatalogPage } from "@/modules/catalog/page";
import { InventoryPage } from "@/modules/inventory/page";
import { ReportsPage } from "@/modules/reports/page";
import { ShiftsWorkspace } from "@/modules/shifts/page";
import { requireSubstation } from "@/modules/identity/server";
import {
  canUseMyShift,
  canViewLogistics,
  stationRoles,
  roleLabels,
} from "@/modules/identity/policy";

export default async function SubstationPage({
  params,
  searchParams,
}: {
  params: Promise<{ substationId: string; section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { substationId, section } = await params;
  const { identity, substation } = await requireSubstation(substationId);
  const page = section?.join("/") ?? "";
  if (
    ![
      "",
      "logistica",
      "tura-mea",
      "personal",
      "masini",
      "catalog",
      "stocuri",
      "ture",
      "rapoarte",
      "rapoarte-proprii",
    ].includes(page)
  )
    notFound();
  const logistics = canViewLogistics(identity, substationId);
  const myShift = canUseMyShift(identity, substationId);
  if (
    (["logistica", "personal", "masini", "catalog", "stocuri", "ture", "rapoarte"].includes(page) &&
      !logistics) ||
    (["tura-mea", "rapoarte-proprii"].includes(page) && !myShift)
  )
    notFound();
  return (
    <AuthenticatedShell identity={identity} stationId={substationId}>
      <PageHeading
        eyebrow={`SUBSTAȚIA ${substation.name.toLocaleUpperCase("ro-RO")}`}
        title={
          page === "rapoarte"
            ? "Rapoarte"
            : page === "rapoarte-proprii"
              ? "Rapoartele mele"
              : page === "ture"
                ? "Cereri și ture"
                : page === "stocuri"
                  ? "Stocuri și recepții"
                  : page === "catalog"
                    ? "Produse"
                    : page === "tura-mea"
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
      ) : page === "ture" ? (
        <ShiftsWorkspace stationId={substationId} />
      ) : page === "stocuri" ? (
        <InventoryPage stationId={substationId} identity={identity} />
      ) : page === "catalog" ? (
        <CatalogPage stationId={substationId} identity={identity} />
      ) : page === "personal" ? (
        <EmployeesPage stationId={substationId} identity={identity} />
      ) : page === "masini" ? (
        <VehiclesPage stationId={substationId} identity={identity} />
      ) : ["logistica", "rapoarte", "rapoarte-proprii"].includes(page) ? (
        <ReportsPage
          stationId={substationId}
          identity={identity}
          params={await searchParams}
          own={page === "rapoarte-proprii"}
          dashboard={page === "logistica"}
        />
      ) : (
        <ShiftsWorkspace stationId={substationId} own />
      )}
    </AuthenticatedShell>
  );
}

import Link from "next/link";
import { Badge, Panel, StateMessage, LinkButton } from "@/components/ui/primitives";
import { getEmployees, getEligibleHolders } from "./index";
import { getAvailableVehicles } from "@/modules/vehicles";

export async function LogisticsWorkspace({ stationId }: { stationId: string }) {
  const [employees, holders, vehicles] = await Promise.all([
    getEmployees(stationId),
    getEligibleHolders(stationId),
    getAvailableVehicles(stationId),
  ]);
  return (
    <>
      <div className="people-stats">
        <Link href={`/substatia/${stationId}/personal`}>
          <span>Angajați înregistrați</span>
          <strong>{employees.length}</strong>
          <small>Vezi personalul →</small>
        </Link>
        <Link href={`/substatia/${stationId}/personal`}>
          <span>Titulari eligibili</span>
          <strong>{holders.length}</strong>
          <small>Activi, cu cont și rol →</small>
        </Link>
        <Link href={`/substatia/${stationId}/masini`}>
          <span>Mașini libere și apte</span>
          <strong>{vehicles.length}</strong>
          <small>Vezi flota →</small>
        </Link>
      </div>
      <Panel
        title="Titulari pentru ture noi"
        description="Numai titularii activi, cu un cont individual activ și rol de șef de tură în substație, sunt eligibili."
      >
        {holders.length ? (
          <ul className="holder-list">
            {holders.map((holder) => (
              <li key={holder.employee_id}>
                <span>{holder.display_name}</span>
                <Badge tone="green">Eligibil</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <StateMessage
            kind="empty"
            title="Niciun titular eligibil"
            description="Verifică personalul activ, bifa Titular și asocierea conturilor."
          />
        )}
      </Panel>
      <div className="station-links">
        <LinkButton href={`/substatia/${stationId}/ture`}>Cereri și ture</LinkButton>
        <LinkButton variant="secondary" href={`/substatia/${stationId}/stocuri`}>
          Stocuri și recepții
        </LinkButton>
      </div>
    </>
  );
}

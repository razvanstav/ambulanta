import Link from "next/link";
import { Badge, Panel, StateMessage } from "@/components/ui/primitives";
import { getEmployees, getEligibleHolders, resolveMyHolder } from "./index";
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
          <span>Mașini disponibile tehnic</span>
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
      <p className="identity-note">
        Gestiunea produselor și fișele de predare vor fi disponibile în etapele următoare.
      </p>
    </>
  );
}
export async function MyHolderWorkspace({ stationId }: { stationId: string }) {
  const holder = await resolveMyHolder(stationId);
  if (!holder)
    return (
      <Panel title="Pregătirea turei">
        <StateMessage
          kind="waiting"
          title="Contul nu este asociat unui titular eligibil"
          description="Șeful substației și administratorul trebuie să verifice angajatul activ, bifa Titular, contul asociat și rolul de șef de tură. Nu poți selecta alt angajat în locul tău."
        />
      </Panel>
    );
  const vehicles = await getAvailableVehicles(stationId);
  return (
    <>
      <Panel
        title={`Titular: ${holder.display_name}`}
        description="Identitatea este stabilită din contul tău autentificat."
      >
        <div className="workspace-notice">
          <Badge tone="green">Eligibil pentru o tură nouă</Badge>
          <p className="identity-note">
            Pornirea și rezervarea mașinii vor fi disponibile după configurarea stocurilor. Momentan
            poți consulta mașinile apte de utilizare.
          </p>
        </div>
      </Panel>
      <Panel title="Mașini disponibile tehnic">
        {vehicles.length ? (
          <ul className="holder-list">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id}>
                <span>
                  <strong>{vehicle.identifier}</strong>
                  <small>{vehicle.description}</small>
                </span>
                <Badge tone="blue">Aptă</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <StateMessage
            kind="empty"
            title="Nicio mașină disponibilă"
            description="Mașinile inactive sau indisponibile tehnic nu pot fi selectate pentru o tură nouă."
          />
        )}
      </Panel>
    </>
  );
}

import { ActionForm } from "@/components/ui/action-form";
import { Badge, Panel, StateMessage } from "@/components/ui/primitives";
import { canManageStation, type Identity } from "@/modules/identity/policy";
import { getVehicles, type Vehicle } from "./index";
import { saveVehicle } from "./actions";

function VehicleForm({ stationId, vehicle }: { stationId: string; vehicle?: Vehicle }) {
  return (
    <ActionForm action={saveVehicle} submitLabel={vehicle ? "Salvează mașina" : "Adaugă mașina"}>
      <input type="hidden" name="station" value={stationId} />
      <input type="hidden" name="vehicle" value={vehicle?.id ?? ""} />
      <div className="form-columns">
        <label>
          Indicativ / număr de înmatriculare
          <input
            name="identifier"
            defaultValue={vehicle?.identifier}
            minLength={2}
            maxLength={30}
            required
          />
        </label>
        <label>
          Descriere
          <input
            name="description"
            defaultValue={vehicle?.description}
            minLength={2}
            maxLength={120}
            required
            placeholder="De exemplu: ambulanță tip B"
          />
        </label>
      </div>
      <div className="form-columns">
        <label className="check-label">
          <input type="checkbox" name="active" defaultChecked={vehicle?.active ?? true} />
          Mașină activă
        </label>
        <label className="check-label">
          <input type="checkbox" name="operational" defaultChecked={vehicle?.operational ?? true} />
          Aptă de utilizare
        </label>
      </div>
      <label>
        Motivul modificării
        <input
          name="reason"
          minLength={5}
          maxLength={500}
          required
          placeholder="Motiv păstrat în audit"
        />
      </label>
    </ActionForm>
  );
}
export async function VehiclesPage({
  stationId,
  identity,
}: {
  stationId: string;
  identity: Identity;
}) {
  const vehicles = await getVehicles(stationId);
  const manage = canManageStation(identity, stationId);
  const available = vehicles.filter((vehicle) => vehicle.active && vehicle.operational);
  return (
    <>
      <div className="people-stats" aria-label="Situația flotei">
        <div>
          <span>Mașini înregistrate</span>
          <strong>{vehicles.length}</strong>
        </div>
        <div>
          <span>Disponibile tehnic</span>
          <strong>{available.length}</strong>
        </div>
        <div>
          <span>Inactive sau indisponibile</span>
          <strong>{vehicles.length - available.length}</strong>
        </div>
      </div>
      <Panel
        title="Flota substației"
        description="Selecția pentru ture exclude mașinile inactive sau indisponibile tehnic."
      >
        {vehicles.length ? (
          <div className="admin-records">
            {vehicles.map((vehicle) => (
              <details key={vehicle.id}>
                <summary>
                  <span>
                    {vehicle.identifier}
                    <small>{vehicle.description}</small>
                  </span>
                  <Badge tone={vehicle.active && vehicle.operational ? "green" : "amber"}>
                    {!vehicle.active
                      ? "Inactivă"
                      : vehicle.operational
                        ? "Disponibilă tehnic"
                        : "Indisponibilă tehnic"}
                  </Badge>
                </summary>
                {manage ? (
                  <VehicleForm stationId={stationId} vehicle={vehicle} />
                ) : (
                  <p className="identity-note">
                    Starea flotei este administrată de șeful substației sau de administrator.
                  </p>
                )}
              </details>
            ))}
          </div>
        ) : (
          <StateMessage
            kind="empty"
            title="Nicio mașină înregistrată"
            description="Adaugă flota acestei substații pentru pregătirea turelor."
          />
        )}
      </Panel>
      {manage && (
        <Panel title="Adaugă mașină" description="Indicativul este unic în instituție.">
          <VehicleForm stationId={stationId} />
        </Panel>
      )}
      <p className="identity-note">
        Disponibilitatea tehnică este verificată. Rezervarea și ocuparea efectivă printr-o tură vor
        fi disponibile odată cu pornirea turelor.
      </p>
    </>
  );
}

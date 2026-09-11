import { getVehicleStock, VehicleStockTable } from "@/modules/vehicles/stock";
import { getVehicles } from "@/modules/vehicles";
import { randomUUID } from "node:crypto";
import { Panel, Badge, LinkButton, StateMessage } from "@/components/ui/primitives";
import type { Identity } from "@/modules/identity/policy";
import { getInventory } from "./index";
import { canOperateStock, formatQuantity } from "./rules";
import { units, bucharestDate } from "@/modules/catalog/rules";
import { ReceiptForm } from "./receipt-form";

export async function InventoryPage({
  stationId,
  identity,
}: {
  stationId: string;
  identity: Identity;
}) {
  const [inventory, vehicleStock, vehicles] = await Promise.all([
    getInventory(stationId),
    getVehicleStock(stationId),
    getVehicles(stationId),
  ]);
  return (
    <>
      <Panel
        title="Stoc în depozit"
        description="Cantitatea curentă pentru fiecare produs din magazie."
      >
        {inventory.options.length ? (
          <div className="table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Produs</th>
                  <th>În depozit</th>

                  <th>Stare</th>
                </tr>
              </thead>
              <tbody>
                {inventory.options.map((lot) => (
                  <tr key={lot.id}>
                    <td>{lot.product.name}</td>
                    <td>
                      {formatQuantity(lot.balance)} {units[lot.product.base_unit]}
                    </td>

                    <td>
                      <Badge tone={lot.available > 0 ? "green" : "amber"}>
                        {!lot.active ? "Produs inactiv" : "Activ"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StateMessage
            kind="empty"
            title="Niciun produs configurat"
            description="Adaugă produse înainte de prima recepție."
          />
        )}
        <div className="panel-action">
          <LinkButton variant="secondary" href={`/substatia/${stationId}/catalog`}>
            Produse
          </LinkButton>
        </div>
      </Panel>
      <Panel
        title="Stoc pe mașini"
        description="Materialele neconsumate rămân în mașină între ture. Consumul declarat se scade numai la închiderea confirmată."
      >
        {vehicles.map((vehicle) => (
          <details className="vehicle-stock-section" key={vehicle.id}>
            <summary>{vehicle.identifier}</summary>
            <VehicleStockTable rows={vehicleStock.filter((l) => l.vehicle_id === vehicle.id)} />
          </details>
        ))}
      </Panel>

      {canOperateStock(identity, stationId) && (
        <Panel
          title="Înregistrează recepție"
          description="Confirmarea încarcă toate liniile într-o singură operație. Repetarea aceleiași cereri nu dublează stocul."
        >
          <ReceiptForm
            stationId={stationId}
            requestKey={randomUUID()}
            today={bucharestDate()}
            options={inventory.options
              .filter((l) => l.active)
              .map((l) => ({
                id: l.id,
                label: `${l.product.name} · ${units[l.product.base_unit]}`,
              }))}
          />
        </Panel>
      )}
      <Panel
        title="Recepții înregistrate"
        description="Documentele validate se păstrează; cantitățile nu se editează ulterior."
      >
        {inventory.receipts.length ? (
          <ul className="holder-list">
            {inventory.receipts.map((receipt) => (
              <li key={receipt.id}>
                <span>
                  {receipt.document_number}
                  <small>
                    {receipt.document_date} · {receipt.supplier}
                  </small>
                </span>
                <Badge tone="green">Înregistrată</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <StateMessage
            kind="empty"
            title="Nicio recepție"
            description="Prima confirmare va încărca stocul din depozit."
          />
        )}
      </Panel>
    </>
  );
}

import { randomUUID } from "node:crypto";
import { Panel, Badge, LinkButton, StateMessage } from "@/components/ui/primitives";
import type { Identity } from "@/modules/identity/policy";
import { getInventory } from "./index";
import { canOperateStock, formatQuantity } from "./rules";
import { units, bucharestDate, lotStatus } from "@/modules/catalog/rules";
import { ReceiptForm } from "./receipt-form";

export async function InventoryPage({
  stationId,
  identity,
}: {
  stationId: string;
  identity: Identity;
}) {
  const inventory = await getInventory(stationId);
  return (
    <>
      <Panel
        title="Stoc în depozit"
        description="Cantități pe produs și lot. Disponibilul exclude loturile expirate, blocate și produsele inactive."
      >
        {inventory.options.length ? (
          <div className="table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Produs / lot</th>
                  <th>În depozit</th>
                  <th>Disponibil</th>
                  <th>Stare</th>
                </tr>
              </thead>
              <tbody>
                {inventory.options.map((lot) => (
                  <tr key={lot.id}>
                    <td>
                      {lot.product.name}
                      <small className="cell-secondary">
                        {lot.lot_code} · {lot.expires_on ?? "fără expirare"}
                      </small>
                    </td>
                    <td>
                      {formatQuantity(lot.balance)} {units[lot.product.base_unit]}
                    </td>
                    <td>
                      {formatQuantity(lot.available)} {units[lot.product.base_unit]}
                    </td>
                    <td>
                      <Badge tone={lot.available > 0 ? "green" : "amber"}>
                        {!lot.active ? "Produs inactiv" : lotStatus(lot.blocked, lot.expires_on)}
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
            title="Niciun lot configurat"
            description="Configurează produsele și loturile înainte de prima recepție."
          />
        )}
        <div className="panel-action">
          <LinkButton variant="secondary" href={`/substatia/${stationId}/catalog`}>
            Catalog și loturi
          </LinkButton>
        </div>
      </Panel>
      <Panel
        title="Praguri locale"
        description="Pragul se compară cu disponibilul produsului, numai în unitatea sa de bază."
      >
        <ul className="holder-list">
          {inventory.products
            .filter(
              (p) => p.active && inventory.settings.some((s) => s.product_id === p.id && s.active),
            )
            .map((product) => {
              const setting = inventory.settings.find((s) => s.product_id === product.id)!;
              // Sum fixed decimal integers, then format; products never mix units.
              const available =
                inventory.options
                  .filter((l) => l.product_id === product.id)
                  .reduce((sum, l) => sum + Math.round(l.available * 1000), 0) / 1000;
              return (
                <li key={product.id}>
                  <span>
                    {product.name}
                    <small>
                      Disponibil {formatQuantity(available)} / prag{" "}
                      {formatQuantity(setting.minimum_quantity)} {units[product.base_unit]}
                    </small>
                  </span>
                  <Badge tone={available < setting.minimum_quantity ? "amber" : "green"}>
                    {available < setting.minimum_quantity ? "Sub prag" : "În limită"}
                  </Badge>
                </li>
              );
            })}
        </ul>
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
                label: `${l.product.name} · ${l.lot_code} · ${units[l.product.base_unit]}`,
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

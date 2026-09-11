import { ActionForm } from "@/components/ui/action-form";
import { Badge, Panel, StateMessage } from "@/components/ui/primitives";
import type { Identity } from "@/modules/identity/policy";
import { getCatalog, type Product } from "./index";
import { saveProduct, saveStationProduct } from "./actions";
import { units, canManageCatalog } from "./rules";

function ProductForm({ stationId, product }: { stationId: string; product?: Product }) {
  return (
    <ActionForm
      action={saveProduct}
      submitLabel={product ? "Salvează produsul" : "Adaugă produsul"}
    >
      <input type="hidden" name="station" value={stationId} />
      <input type="hidden" name="product" value={product?.id ?? ""} />
      <input type="hidden" name="category" value={product?.category ?? "consumable"} />
      <input
        type="hidden"
        name="reason"
        value={product ? "Actualizare produs din catalog" : "Adăugare produs în catalog"}
      />
      <div className="form-columns">
        <label>
          Cod produs
          <input name="code" defaultValue={product?.code} minLength={2} maxLength={30} required />
        </label>
        <label>
          Denumire
          <input name="name" defaultValue={product?.name} minLength={2} maxLength={150} required />
        </label>
        <label>
          Unitate de bază
          <select name="unit" defaultValue={product?.base_unit ?? "buc"}>
            {Object.entries(units).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tip cantitate
          <select name="precision" defaultValue={product?.quantity_precision ?? 0}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Numere întregi" : `${n} zecimale`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check-label">
        <input name="active" type="checkbox" defaultChecked={product?.active ?? true} />
        Produs activ
      </label>
      <p className="identity-note">
        Unitatea și tipul cantității rămân fixe după înregistrarea produsului în stoc.
      </p>
    </ActionForm>
  );
}
export async function CatalogPage({
  stationId,
  identity,
}: {
  stationId: string;
  identity: Identity;
}) {
  const { products, settings } = await getCatalog(stationId);
  const manage = canManageCatalog(identity);
  return (
    <>
      <Panel title="Produse" description="Produsele folosite în magazie și în mașini.">
        {products.length ? (
          products.map((product) => {
            const setting = settings.find((s) => s.product_id === product.id);
            return (
              <details className="catalog-record" key={product.id}>
                <summary>
                  <strong>{product.name}</strong> · {units[product.base_unit]}{" "}
                  <Badge tone={product.active && setting?.active ? "green" : "neutral"}>
                    {product.active && setting?.active ? "Activ" : "Inactiv"}
                  </Badge>
                </summary>
                {manage && <ProductForm stationId={stationId} product={product} />}
                <ActionForm action={saveStationProduct} submitLabel="Salvează disponibilitatea">
                  <input type="hidden" name="station" value={stationId} />
                  <input type="hidden" name="product" value={product.id} />
                  <input type="hidden" name="minimum" value="0" />
                  <input
                    type="hidden"
                    name="reason"
                    value="Actualizare disponibilitate produs în substație"
                  />
                  <label className="check-label">
                    <input
                      name="local_active"
                      type="checkbox"
                      defaultChecked={setting?.active ?? false}
                    />
                    Disponibil în această substație
                  </label>
                </ActionForm>
              </details>
            );
          })
        ) : (
          <StateMessage
            kind="empty"
            title="Niciun produs"
            description="Adaugă primul produs pentru a înregistra cantități în magazie."
          />
        )}
      </Panel>
      {manage && (
        <Panel
          title="Adaugă produs"
          description="Produsul va fi disponibil imediat pentru recepție în această substație."
        >
          <ProductForm stationId={stationId} />
        </Panel>
      )}
    </>
  );
}

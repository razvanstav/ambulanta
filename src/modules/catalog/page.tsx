import { ActionForm } from "@/components/ui/action-form";
import { Badge, Panel, StateMessage } from "@/components/ui/primitives";
import type { Identity } from "@/modules/identity/policy";
import { getCatalog, type Product, type StationProduct } from "./index";
import { saveProduct, saveStationProduct, createStockLot, setStockLotBlocked } from "./actions";
import { categories, units, canManageCatalog, lotStatus, bucharestDate } from "./rules";

function Reason() {
  return (
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
  );
}
function ProductForm({ stationId, product }: { stationId: string; product?: Product }) {
  return (
    <ActionForm
      action={saveProduct}
      submitLabel={product ? "Salvează produsul" : "Adaugă produsul"}
    >
      <input type="hidden" name="station" value={stationId} />
      <input type="hidden" name="product" value={product?.id ?? ""} />
      <div className="form-columns">
        <label>
          Cod produs
          <input name="code" defaultValue={product?.code} minLength={2} maxLength={30} required />
        </label>
        <label>
          Denumire
          <input name="name" defaultValue={product?.name} minLength={2} maxLength={150} required />
        </label>
      </div>
      <div className="form-columns">
        <label>
          Categorie
          <select name="category" defaultValue={product?.category ?? "consumable"}>
            {Object.entries(categories).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
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
          Precizie
          <select name="precision" defaultValue={product?.quantity_precision ?? 0}>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "0 — cantități întregi" : `${n} zecimale`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-columns">
        <label className="check-label">
          <input name="track_lots" type="checkbox" defaultChecked={product?.track_lots ?? false} />
          Urmărire lot comercial
        </label>
        <label className="check-label">
          <input
            name="track_expiry"
            type="checkbox"
            defaultChecked={product?.track_expiry ?? false}
          />
          Urmărire expirare
        </label>
        <label className="check-label">
          <input name="active" type="checkbox" defaultChecked={product?.active ?? true} />
          Activ în instituție
        </label>
      </div>
      <p className="identity-note">
        Medicamentele cer lot și expirare. Bucata, fiola, comprimatul și perechea au precizie 0.
        Unitatea, precizia și urmărirea sunt fixe după primul lot din orice substație.
      </p>
      <Reason />
    </ActionForm>
  );
}
function LocalForm({
  stationId,
  product,
  setting,
}: {
  stationId: string;
  product: Product;
  setting?: StationProduct;
}) {
  return (
    <ActionForm action={saveStationProduct} submitLabel="Salvează pragul local">
      <input type="hidden" name="station" value={stationId} />
      <input type="hidden" name="product" value={product.id} />
      <div className="form-columns">
        <label>
          Prag minim ({units[product.base_unit]})
          <input
            name="minimum"
            inputMode="decimal"
            defaultValue={setting?.minimum_quantity ?? 0}
            required
            maxLength={13}
          />
        </label>
        <label className="check-label">
          <input type="checkbox" name="local_active" defaultChecked={setting?.active ?? false} />
          Activ în această substație
        </label>
      </div>
      <p className="identity-note">
        Precizie: {product.quantity_precision} zecimale. Pragul este un nivel de alertă, nu
        cantitatea din depozit.
      </p>
      <Reason />
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
  const { products, settings, lots } = await getCatalog(stationId);
  const manage = canManageCatalog(identity);
  const today = bucharestDate();
  const activeCount = products.filter(
    (p) => p.active && settings.some((s) => s.product_id === p.id && s.active),
  ).length;
  return (
    <>
      <div className="people-stats" aria-label="Situația catalogului">
        <div>
          <span>Produse în instituție</span>
          <strong>{products.length}</strong>
        </div>
        <div>
          <span>Active în substație</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Loturi înregistrate local</span>
          <strong>{lots.length}</strong>
        </div>
      </div>
      <Panel
        title="Catalog și praguri"
        description="Produsele sunt comune instituției. Pragurile și loturile se configurează separat pentru substația selectată."
      >
        {!manage && (
          <p className="identity-note">
            Catalogul comun este administrat de administrator și logistica centrală.
          </p>
        )}
        {products.length ? (
          <div className="admin-records">
            {products.map((product) => {
              const setting = settings.find((s) => s.product_id === product.id);
              const productLots = lots.filter((l) => l.product_id === product.id);
              return (
                <details key={product.id}>
                  <summary>
                    <span>
                      {product.name}
                      <small>
                        {product.code} · {categories[product.category]} · {units[product.base_unit]}{" "}
                        ·{" "}
                        {setting
                          ? `Prag local: ${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 }).format(setting.minimum_quantity)}`
                          : "Prag neconfigurat"}
                      </small>
                    </span>
                    <Badge tone={product.active && setting?.active ? "green" : "amber"}>
                      {!product.active
                        ? "Inactiv în instituție"
                        : setting?.active
                          ? "Activ local"
                          : "Inactiv local"}
                    </Badge>
                  </summary>
                  {manage && (
                    <>
                      <h3 className="catalog-subheading">Produs comun instituției</h3>
                      <ProductForm stationId={stationId} product={product} />
                    </>
                  )}
                  <h3 className="catalog-subheading">Prag și activare locală</h3>
                  <LocalForm stationId={stationId} product={product} setting={setting} />
                  <h3 className="catalog-subheading">Loturile substației</h3>
                  {productLots.length ? (
                    <div className="catalog-lots">
                      {productLots.map((lot) => {
                        const status = lotStatus(lot.blocked, lot.expires_on, today);
                        return (
                          <div key={lot.id} className="catalog-lot">
                            <div className="catalog-lot-heading">
                              <strong>{lot.is_internal ? "Lot intern" : lot.lot_code}</strong>
                              <Badge tone={status === "Valid" ? "green" : "amber"}>{status}</Badge>
                            </div>
                            <p className="identity-note">
                              {lot.expires_on
                                ? `Expiră: ${lot.expires_on.split("-").reverse().join(".")}`
                                : "Fără expirare"}
                            </p>
                            <ActionForm
                              action={setStockLotBlocked}
                              submitLabel="Salvează starea lotului"
                            >
                              <input type="hidden" name="station" value={stationId} />
                              <input type="hidden" name="lot" value={lot.id} />
                              <label className="check-label">
                                <input
                                  type="checkbox"
                                  name="blocked"
                                  defaultChecked={lot.blocked}
                                />
                                Lot blocat
                              </label>
                              <Reason />
                            </ActionForm>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="identity-note">Niciun lot înregistrat pentru acest produs.</p>
                  )}
                  {product.active &&
                    setting?.active &&
                    (product.track_lots || productLots.length === 0) && (
                      <>
                        <h3 className="catalog-subheading">Adaugă lot</h3>
                        <ActionForm
                          action={createStockLot}
                          submitLabel={product.track_lots ? "Adaugă lotul" : "Creează lotul intern"}
                        >
                          <input type="hidden" name="station" value={stationId} />
                          <input type="hidden" name="product" value={product.id} />
                          <div className="form-columns">
                            {product.track_lots && (
                              <label>
                                Cod lot
                                <input name="lot_code" maxLength={80} required />
                              </label>
                            )}
                            {product.track_expiry && (
                              <label>
                                Data expirării
                                <input
                                  type="date"
                                  name="expires_on"
                                  min="1900-01-01"
                                  max="9999-12-31"
                                  required
                                />
                              </label>
                            )}
                          </div>
                          <p className="identity-note">
                            {product.track_lots
                              ? "Codul și expirarea rămân fixe. Blochează un lot introdus greșit și înregistrează lotul corect."
                              : "Lotul intern identifică produsul fără lot comercial în această substație."}
                          </p>
                          <Reason />
                        </ActionForm>
                      </>
                    )}
                </details>
              );
            })}
          </div>
        ) : (
          <StateMessage
            kind="empty"
            title="Catalogul este gol"
            description="Administratorul sau logistica centrală poate adăuga primele produse."
          />
        )}
      </Panel>
      {manage && (
        <Panel
          title="Adaugă produs"
          description="Codul este unic în instituție. Configurează apoi activarea și pragul local."
        >
          <ProductForm stationId={stationId} />
        </Panel>
      )}
      <p className="identity-note">
        Înregistrarea loturilor nu încarcă stocul. Recepțiile și soldurile urmează în modulul
        următor. Loturile sunt afișate în ordinea expirării; expirarea se evaluează după calendarul
        Europe/Bucharest, la sfârșitul zilei înscrise.
      </p>
    </>
  );
}

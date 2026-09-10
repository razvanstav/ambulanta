"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Button, PageHeading, Panel, StateMessage } from "@/components/ui/primitives";
import { useDemo } from "./context";
import { demoDate, demoProducts, demoSnapshot } from "./data";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO");
const isExpiring = (expires: string | null) =>
  expires !== null &&
  new Date(expires).getTime() - new Date(demoSnapshot).getTime() <= 30 * 86_400_000;

export function StockPage({ initialStatus = "toate" }: { initialStatus?: string }) {
  const { substation, hasExamples } = useDemo();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("toate");
  const [status, setStatus] = useState(initialStatus);
  const products = hasExamples
    ? demoProducts.filter(
        (product) =>
          normalize(`${product.name} ${product.id} ${product.lot}`).includes(
            normalize(search.trim()),
          ) &&
          (category === "toate" || category === product.category) &&
          (status === "toate" ||
            (status === "sub-prag" && product.quantity < product.threshold) ||
            (status === "expira" && isExpiring(product.expires))),
      )
    : [];
  function resetFilters() {
    setSearch("");
    setCategory("toate");
    setStatus("toate");
  }
  return (
    <>
      <PageHeading
        eyebrow="LOGISTICĂ / MAGAZIE"
        title="Stocuri"
        description={`Produse și loturi din magazia ${substation.name}. Cantitățile sunt afișate în unitatea fiecărui produs.`}
      />
      <Panel
        title="Produse în magazie"
        description="Exemple pentru structura viitorului ecran de stoc."
        action={<Badge tone="blue">{hasExamples ? demoProducts.length : 0} repere</Badge>}
      >
        <div className="filters">
          <label className="search-field">
            <span className="sr-only">Caută produs sau lot</span>
            <Icon name="search" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Caută produs sau lot…"
            />
          </label>
          <label className="filter-field">
            <span>Categorie</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="toate">Toate categoriile</option>
              <option>Consumabile</option>
              <option>Medicamente</option>
              <option>Accesorii</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Stare stoc</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="toate">Toate stările</option>
              <option value="sub-prag">Sub prag</option>
              <option value="expira">Expiră în 30 zile</option>
            </select>
          </label>
        </div>
        {products.length ? (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Stoc demonstrativ">
            <table className="stock-table">
              <caption className="sr-only">
                Produse, cantități și loturi — date demonstrative
              </caption>
              <thead>
                <tr>
                  <th scope="col">Produs / categorie</th>
                  <th scope="col">Lot / expirare</th>
                  <th scope="col" className="numeric">
                    Disponibil
                  </th>
                  <th scope="col" className="numeric">
                    Prag
                  </th>
                  <th scope="col">Stare</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-icon">
                          <Icon name="box" />
                        </span>
                        <span>
                          <strong>{product.name}</strong>
                          <small>
                            {product.id} · {product.category}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="lot-code">{product.lot}</span>
                      <small className="cell-secondary">
                        {product.expires ? demoDate(product.expires) : "Fără expirare"}
                      </small>
                    </td>
                    <td className="numeric">
                      <strong>{product.quantity}</strong>{" "}
                      <span className="muted">{product.unit}</span>
                    </td>
                    <td className="numeric muted">
                      {product.threshold} {product.unit}
                    </td>
                    <td>
                      {product.quantity < product.threshold ? (
                        <Badge tone="red">Sub prag</Badge>
                      ) : isExpiring(product.expires) ? (
                        <Badge tone="amber">Expiră curând</Badge>
                      ) : (
                        <Badge tone="green">În limite</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StateMessage
            kind="empty"
            title={hasExamples ? "Niciun produs găsit" : "Magazia nu are produse demonstrative"}
            description={
              hasExamples
                ? "Încearcă alt termen sau elimină filtrele pentru a vedea toate produsele."
                : "Alege substația Roșiori pentru a explora exemplele de stoc."
            }
          >
            {hasExamples && (
              <Button variant="secondary" onClick={resetFilters}>
                Resetează filtrele
              </Button>
            )}
          </StateMessage>
        )}
        <div className="table-footer">
          <span role="status" aria-live="polite">
            {products.length} din {hasExamples ? demoProducts.length : 0} produse
          </span>
          <span>Cantități demonstrative · {demoDate(demoSnapshot)}</span>
        </div>
      </Panel>
      <p className="context-note">
        <Icon name="shield" />
        Stocul real se va actualiza exclusiv prin operații validate pe server. Acest ecran nu
        modifică solduri.
      </p>
    </>
  );
}

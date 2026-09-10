"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge, LinkButton, PageHeading, Panel, StateMessage } from "@/components/ui/primitives";
import { useDemo } from "./context";
import { demoDate, demoProducts, demoRequests, demoSnapshot } from "./data";

export function RequestsTable({ compact = false }: { compact?: boolean }) {
  const { hasExamples } = useDemo();
  if (!hasExamples)
    return (
      <StateMessage
        kind="empty"
        title="Nicio cerere în această substație"
        description="Alege Roșiori pentru a vedea exemplele de cereri și ture."
      />
    );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Cereri și ture demonstrative"
    >
      <table>
        <caption className="sr-only">
          Cereri în așteptare și ture active — date demonstrative
        </caption>
        <thead>
          <tr>
            <th scope="col">Șef de tură</th>
            <th scope="col">Mașină</th>
            {!compact && <th scope="col">Interval planificat</th>}
            <th scope="col">Stare</th>
          </tr>
        </thead>
        <tbody>
          {demoRequests.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="person-cell">
                  <span className="avatar avatar-small">{item.initials}</span>
                  <span>
                    <strong>{item.person}</strong>
                    <small>{item.id}</small>
                  </span>
                </div>
              </td>
              <td>
                <span className="vehicle-label">
                  <Icon name="ambulance" />
                  {item.vehicle}
                </span>
              </td>
              {!compact && <td className="muted">{item.time}</td>}
              <td>
                <Badge tone={item.tone}>
                  <span className="status-dot" />
                  {item.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const { substation, hasExamples } = useDemo();
  const lowStock = demoProducts.filter((product) => product.quantity < product.threshold);
  const metrics: {
    label: string;
    value: number;
    detail: string;
    icon: IconName;
    tone: string;
    href: string;
  }[] = [
    {
      label: "Produse în magazie",
      value: demoProducts.length,
      detail: "repere distincte în stoc",
      icon: "box",
      tone: "blue",
      href: "/demo/stocuri",
    },
    {
      label: "Ture active",
      value: demoRequests.filter((item) => item.status === "Tură activă").length,
      detail: "echipaje cu predarea acceptată",
      icon: "users",
      tone: "blue",
      href: "/demo/distribuire",
    },
    {
      label: "Cereri în așteptare",
      value: demoRequests.filter((item) => item.status !== "Tură activă").length,
      detail: "pentru pregătire sau acceptare",
      icon: "clipboard",
      tone: "amber",
      href: "/demo/distribuire",
    },
    {
      label: "Sub pragul de stoc",
      value: lowStock.length,
      detail: "produse care necesită atenție",
      icon: "warning",
      tone: "red",
      href: "/demo/stocuri?stare=sub-prag",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="LOGISTICĂ / MAGAZIE"
        title="Privire de ansamblu"
        description={`Stocuri, cereri și ture. Totul la îndemână, pentru substația ${substation.name}.`}
      >
        <div className="snapshot-date">
          <Icon name="calendar" />
          <span>
            {demoDate(demoSnapshot)}
            <small>Scenariu demonstrativ · 10:30</small>
          </span>
        </div>
      </PageHeading>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <Link
            href={metric.href}
            key={metric.label}
            className={`metric-card metric-${metric.tone}`}
          >
            <div className="metric-top">
              <span className="icon-tile">
                <Icon name={metric.icon} />
              </span>
              <Icon name="chevron" />
            </div>
            <span className="metric-label">{metric.label}</span>
            <strong className="metric-value">
              {hasExamples ? metric.value : 0}
              <span className="metric-rule" />
            </strong>
            <span className="metric-detail">{metric.detail}</span>
          </Link>
        ))}
      </div>
      <div className="action-grid">
        <section className="action-card action-distribute">
          <div className="action-copy">
            <span className="action-overline">
              <span className="status-dot" />
              PREGĂTIRE ȘI PREDARE
            </span>
            <h2>
              O tură pregătită începe
              <br />
              cu o fișă clară.
            </h2>
            <p>Consultă cererile echipajelor și fișele pregătite pentru predare.</p>
            <LinkButton href="/demo/distribuire">Vezi distribuirea</LinkButton>
          </div>
          <div className="action-art" aria-hidden="true">
            <Icon name="clipboard" />
            <span className="art-check">
              <Icon name="check" />
            </span>
          </div>
        </section>
        <section className="action-card action-close">
          <div className="action-copy">
            <span className="action-overline">CONSUM ȘI RETUR</span>
            <h2>
              Fiecare tură,
              <br />
              închisă corect.
            </h2>
            <p>Verifică declarațiile de consum și retururile înainte de închidere.</p>
            <LinkButton href="/demo/inchidere" variant="secondary">
              Vezi închiderea
            </LinkButton>
          </div>
          <Icon className="close-art" name="circleCheck" />
        </section>
      </div>
      <div className="dashboard-lower">
        <Panel
          title="Cereri și ture"
          description="Cererile sunt separate de turele efectiv pornite."
          action={
            <Link className="text-link" href="/demo/distribuire">
              Vezi toate
              <Icon name="arrow" />
            </Link>
          }
        >
          <RequestsTable compact />
          <div className="panel-footnote">
            <Icon name="info" />
            Tura începe numai la acceptarea fișei de către titular.
          </div>
        </Panel>
        <Panel
          title="De urmărit"
          description="Priorități în magazie"
          action={<span className="small-counter">{hasExamples ? 3 : 0}</span>}
        >
          {hasExamples ? (
            <div className="alert-list">
              {lowStock.map((product) => (
                <Link href="/demo/stocuri?stare=sub-prag" key={product.id} className="alert-item">
                  <span className="alert-symbol red">
                    <Icon name="warning" />
                  </span>
                  <span>
                    <strong>Stoc sub prag</strong>
                    <p>{product.name}</p>
                    <small>
                      {product.quantity} {product.unit} disponibile · prag {product.threshold}
                    </small>
                  </span>
                  <Icon name="chevron" />
                </Link>
              ))}
              <Link href="/demo/stocuri?stare=expira" className="alert-item">
                <span className="alert-symbol amber">
                  <Icon name="clock" />
                </span>
                <span>
                  <strong>Expiră în 18 zile</strong>
                  <p>Bandaj elastic</p>
                  <small>Lot DEMO-BE-05 · 28 sept. 2026</small>
                </span>
                <Icon name="chevron" />
              </Link>
            </div>
          ) : (
            <StateMessage
              kind="empty"
              title="Nicio alertă demonstrativă"
              description="Acest exemplu de substație nu conține produse."
            />
          )}
          <div className="panel-footnote">Situație ilustrativă la {demoDate(demoSnapshot)}</div>
        </Panel>
      </div>
    </>
  );
}

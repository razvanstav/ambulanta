"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  Badge,
  Button,
  PageHeading,
  Panel,
  StateMessage,
  UnavailableAction,
} from "@/components/ui/primitives";
import { useDemo } from "./context";
import { demoIssue, demoVehicles } from "./data";

type ShiftPreview = "start" | "unavailable" | "waiting" | "issue";
const previews: { value: ShiftPreview; label: string }[] = [
  { value: "start", label: "Start tură" },
  { value: "unavailable", label: "Nicio mașină disponibilă" },
  { value: "waiting", label: "În așteptarea fișei" },
  { value: "issue", label: "Fișă de acceptat" },
];

export function ShiftPage() {
  const { substation, hasExamples } = useDemo();
  const [preview, setPreview] = useState<ShiftPreview>("start");
  const [vehicle, setVehicle] = useState("");
  const [showSelection, setShowSelection] = useState(false);
  const [selectionError, setSelectionError] = useState(false);

  function choosePreview(value: ShiftPreview) {
    setPreview(value);
    setVehicle("");
    setShowSelection(false);
    setSelectionError(false);
  }

  return (
    <>
      <PageHeading
        eyebrow="SPAȚIUL MEU"
        title="Tura mea"
        description="Mașina aleasă, fișa primită și situația propriei ture, într-un singur loc."
      />
      <div className="preview-toolbar">
        <div>
          <Icon name="settings" />
          <span>Previzualizează o stare</span>
        </div>
        <label>
          <span className="sr-only">Stare demonstrativă a turei</span>
          <select
            value={preview}
            onChange={(event) => choosePreview(event.target.value as ShiftPreview)}
          >
            {previews.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p>Schimbă doar exemplul afișat.</p>
      </div>
      <div className="shift-layout">
        <div className="shift-main">
          <div className="workflow-steps" aria-label="Etapele pornirii turei">
            {["Alegi mașina", "Primești fișa", "Accepți și pornești"].map((step, index) => (
              <div
                key={step}
                className={
                  index === (preview === "issue" ? 2 : preview === "waiting" ? 1 : 0)
                    ? "step-current"
                    : ""
                }
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
          {!hasExamples || preview === "unavailable" ? (
            <Panel title="Start tură">
              <StateMessage
                kind="empty"
                title="Nicio mașină disponibilă"
                description="Nu există mașini de selectat în acest exemplu. Pentru o tură nouă este necesară o mașină disponibilă în substație."
              >
                <Button
                  variant="secondary"
                  onClick={() => choosePreview("start")}
                  disabled={!hasExamples}
                >
                  Vezi exemplul cu mașini disponibile
                </Button>
              </StateMessage>
            </Panel>
          ) : preview === "start" ? (
            <Panel
              title="Alege mașina pentru tură"
              description="Selectează una dintre mașinile disponibile în acest scenariu."
              action={<Badge tone="green">2 disponibile</Badge>}
            >
              <form
                className="vehicle-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  setSelectionError(!vehicle);
                  setShowSelection(Boolean(vehicle));
                }}
              >
                <fieldset aria-describedby={selectionError ? "vehicle-error" : "vehicle-help"}>
                  <legend className="sr-only">Mașină disponibilă</legend>
                  {demoVehicles.map((item) => (
                    <label
                      key={item.id}
                      className={`vehicle-option ${vehicle === item.id ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="vehicle"
                        value={item.id}
                        checked={vehicle === item.id}
                        onChange={() => {
                          setVehicle(item.id);
                          setSelectionError(false);
                          setShowSelection(false);
                        }}
                        aria-describedby={selectionError ? "vehicle-error" : "vehicle-help"}
                        required
                      />
                      <span className="vehicle-option-icon">
                        <Icon name="ambulance" />
                      </span>
                      <span>
                        <strong>{item.id}</strong>
                        <span>{item.type}</span>
                        <small>{item.detail}</small>
                      </span>
                      <Badge tone="green">Disponibilă</Badge>
                    </label>
                  ))}
                </fieldset>
                <p id="vehicle-help" className="field-help">
                  Selecția este locală și nu rezervă mașina.
                </p>
                {selectionError && (
                  <p id="vehicle-error" className="field-error" role="alert">
                    Alege o mașină pentru a previzualiza selecția.
                  </p>
                )}
                <Button type="submit" variant="secondary">
                  Previzualizează selecția
                  <Icon name="arrow" />
                </Button>
                {showSelection && (
                  <div className="selection-preview" role="status">
                    <Icon name="info" />
                    <div>
                      <strong>Mașină selectată: {vehicle}</strong>
                      <p>
                        În fluxul complet, trimiterea cererii va rezerva mașina și va deschide
                        așteptarea fișei. Nu s-a creat nicio cerere.
                      </p>
                    </div>
                  </div>
                )}
                <UnavailableAction module="M06" description="Crearea cererii nu este încă activă.">
                  Trimite cererea de start tură
                </UnavailableAction>
              </form>
            </Panel>
          ) : preview === "waiting" ? (
            <Panel
              title="În așteptarea fișei"
              action={<Badge tone="amber">Cerere demonstrativă</Badge>}
            >
              <div className="shift-details">
                <span>
                  Mașină<strong>DEMO-02</strong>
                </span>
                <span>
                  Interval planificat<strong>07:00 – 19:00</strong>
                </span>
                <span>
                  Substație<strong>{substation.name}</strong>
                </span>
              </div>
              <StateMessage
                kind="waiting"
                title="Magazia pregătește fișa"
                description="Vei putea verifica produsele, loturile și cantitățile după primirea fișei. Tura nu a început și stocul magaziei nu a fost scăzut."
              />
              <div className="panel-action">
                <UnavailableAction module="M06" description="Anularea cererii nu este încă activă.">
                  Anulează cererea
                </UnavailableAction>
              </div>
            </Panel>
          ) : (
            <Panel
              title="Fișă de acceptat"
              description="FIȘĂ DEMO-0041 · Versiunea 2 · pregătită de Magazie"
              action={<Badge tone="blue">De verificat</Badge>}
            >
              <div className="shift-details">
                <span>
                  Titular<strong>Mihai Dobre</strong>
                </span>
                <span>
                  Mașină<strong>DEMO-02</strong>
                </span>
                <span>
                  Substație<strong>{substation.name}</strong>
                </span>
              </div>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Fișa primită, numai citire"
              >
                <table>
                  <caption className="sr-only">
                    Produsele fișei demonstrative versiunea 2, fără editare
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Produs / lot</th>
                      <th scope="col" className="numeric">
                        De predat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoIssue.map((item) => (
                      <tr key={item.lot}>
                        <td>
                          <strong>{item.product}</strong>
                          <small className="cell-secondary">{item.lot}</small>
                        </td>
                        <td className="numeric">
                          {item.quantity} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-action">
                <p className="issue-note">
                  <Icon name="shield" />
                  Fișa este numai pentru citire. Acceptarea confirmă predarea și pornește tura în
                  aceeași operație.
                </p>
                <UnavailableAction
                  module="M06"
                  description="Acceptarea nu este încă activă; nu se scade stocul."
                >
                  Accept fișa și pornesc tura
                </UnavailableAction>
                <Button variant="ghost" disabled>
                  Semnalează o neconcordanță
                </Button>
              </div>
            </Panel>
          )}
        </div>
        <div className="shift-aside">
          <Panel title="Datele mele">
            <div className="profile-card">
              <span className="avatar avatar-large">MD</span>
              <strong>Mihai Dobre</strong>
              <span>Șef de tură · titular</span>
              <Badge tone="blue">Profil demonstrativ</Badge>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Substație</dt>
                <dd>{substation.name}</dd>
              </div>
              <div>
                <dt>Perspectivă</dt>
                <dd>Tura mea</dd>
              </div>
            </dl>
          </Panel>
          <div className="guide-card">
            <Icon name="info" />
            <h2>Înainte de pornire</h2>
            <p>
              Magazia stabilește conținutul fișei. Tu verifici ce ai primit și accepți versiunea
              afișată.
            </p>
            <p>Tura începe efectiv la acceptare. O cerere în așteptare nu este o tură activă.</p>
          </div>
        </div>
      </div>
    </>
  );
}

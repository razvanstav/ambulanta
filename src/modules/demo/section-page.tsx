"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  Badge,
  Button,
  LinkButton,
  PageHeading,
  Panel,
  StateMessage,
  UnavailableAction,
} from "@/components/ui/primitives";
import { RequestsTable } from "./dashboard";
import { useDemo } from "./context";

const sectionDetails = {
  receptii: {
    title: "Recepții",
    module: "M05",
    icon: "file",
    description: "Intrările de produse și documentele de recepție ale magaziei.",
    action: "Înregistrează recepția",
    explanation: "Produsele vor intra în stoc numai după validarea întregii recepții.",
  },
  distribuire: {
    title: "Distribuire tură",
    module: "M06",
    icon: "clipboard",
    description: "Cererile echipajelor, fișele de predare și turele efectiv pornite.",
    action: "Pregătește fișa",
    explanation: "Magazia va stabili produsele, loturile și cantitățile pentru fiecare cerere.",
  },
  inchidere: {
    title: "Închidere tură",
    module: "M08",
    icon: "circleCheck",
    description: "Declarațiile de consum și retur care așteaptă verificarea magaziei.",
    action: "Confirmă returul și închide",
    explanation:
      "La închiderea normală, pentru fiecare lot: predat = consumat + returnat. Returul confirmat reîncarcă magazia.",
  },
  rapoarte: {
    title: "Rapoarte",
    module: "M09",
    icon: "chart",
    description: "Situația stocurilor și a consumului, pe ture și intervale.",
    action: "Exportă raportul",
    explanation:
      "Rapoartele vor folosi operațiile validate și vor respecta substația și drepturile contului.",
  },
  personal: {
    title: "Personal",
    module: "M03",
    icon: "users",
    description: "Evidența angajaților și a titularilor din substație.",
    action: "Adaugă angajat",
    explanation: "Numai angajații activi marcați ca titulari pot primi predări noi.",
  },
  masini: {
    title: "Mașini",
    module: "M03",
    icon: "ambulance",
    description: "Flota substației și starea de utilizare a mașinilor.",
    action: "Adaugă mașină",
    explanation:
      "Șeful de tură va putea alege doar mașinile active, apte de utilizare și disponibile.",
  },
  setari: {
    title: "Setări",
    module: "M02",
    icon: "settings",
    description: "Substații, conturi și accesul în aplicație.",
    action: "Salvează setările",
    explanation:
      "Rolurile vor fi atribuite explicit. Schimbarea perspectivei demonstrative nu acordă drepturi.",
  },
} satisfies Record<
  string,
  {
    title: string;
    module: string;
    icon: IconName;
    description: string;
    action: string;
    explanation: string;
  }
>;

export type DemoSection = keyof typeof sectionDetails;

export function SectionPage({ section }: { section: DemoSection }) {
  const detail = sectionDetails[section];
  const { substation } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow="LOGISTICĂ / MAGAZIE"
        title={detail.title}
        description={detail.description}
      />
      {section === "distribuire" && (
        <Panel
          title={`Cereri și ture · ${substation.name}`}
          description="Exemple de persoane, mașini și stări. Nu sunt înregistrări operaționale."
        >
          <RequestsTable />
        </Panel>
      )}
      <section className="module-preview">
        <span className="module-icon">
          <Icon name={detail.icon} />
        </span>
        <Badge>Previzualizare</Badge>
        <h2>
          {section === "distribuire"
            ? "De la cerere la fișa de predare"
            : `${detail.title}, în același spațiu de lucru`}
        </h2>
        <p>{detail.explanation}</p>
        <UnavailableAction module={detail.module} description="Operația nu este încă implementată.">
          {detail.action}
        </UnavailableAction>
        {section === "distribuire" && (
          <LinkButton href="/demo/tura-mea" variant="secondary">
            Explorează perspectiva Tura mea
          </LinkButton>
        )}
      </section>
      {section === "setari" && <InterfaceStates />}
    </>
  );
}

function InterfaceStates() {
  const [state, setState] = useState("empty");
  return (
    <Panel
      title="Stările interfeței"
      description="Exemple vizuale pentru lipsa datelor, încărcare și eroare."
    >
      <div className="state-controls" role="group" aria-label="Previzualizare stări interfață">
        {[
          { id: "empty", label: "Fără date" },
          { id: "loading", label: "Încărcare" },
          { id: "error", label: "Eroare" },
        ].map((item) => (
          <Button
            key={item.id}
            variant="secondary"
            aria-pressed={state === item.id}
            onClick={() => setState(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {state === "empty" ? (
        <StateMessage
          kind="empty"
          title="Nu există înregistrări"
          description="Datele vor apărea aici după prima operație validată."
        />
      ) : state === "loading" ? (
        <StateMessage
          kind="loading"
          title="Se încarcă datele…"
          description="Previzualizarea stării de încărcare. Nu se face nicio cerere către server."
        />
      ) : (
        <StateMessage
          kind="error"
          title="Datele nu au putut fi încărcate"
          description="Exemplu de eroare. Poți reveni la starea inițială pentru a continua previzualizarea."
        >
          <Button variant="secondary" onClick={() => setState("empty")}>
            <Icon name="refresh" />
            Reia previzualizarea
          </Button>
        </StateMessage>
      )}
    </Panel>
  );
}

export function ShiftHistoryPage() {
  return (
    <>
      <PageHeading
        eyebrow="SPAȚIUL MEU"
        title="Istoricul meu"
        description="Turele și rapoartele proprii vor fi disponibile aici, după autentificare."
      />
      <Panel title="Ture anterioare">
        <StateMessage
          kind="empty"
          title="Nicio tură în istoric"
          description="Acest ecran nu conține ture salvate. Rapoartele proprii vor fi conectate în modulele de închidere și raportare."
        >
          <LinkButton href="/demo/tura-mea" variant="secondary">
            Înapoi la Tura mea
          </LinkButton>
        </StateMessage>
      </Panel>
    </>
  );
}

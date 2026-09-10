import Link from "next/link";

export default function HomePage() {
  return (
    <div className="welcome-shell">
      <header className="welcome-header">
        <Link className="brand" href="/" aria-label="Gestiune substații — pagina inițială">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z" fill="currentColor" />
            </svg>
          </span>
          <span>Gestiune substații</span>
        </Link>
        <span className="environment-label">Versiune în dezvoltare</span>
      </header>

      <main id="continut" className="welcome-main">
        <div className="intro">
          <p className="eyebrow">EVIDENȚĂ ȘI ORGANIZARE</p>
          <h1>Gestiunea substației, într-un singur loc.</h1>
          <p className="intro-description">
            De la recepția produselor până la raportul de tură. Construim o evidență clară pentru
            depozit, echipaje și fiecare predare.
          </p>
        </div>

        <section className="status-panel" aria-labelledby="status-title">
          <div className="status-heading">
            <span className="status-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="m6 12 4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="eyebrow">PRIMUL PAS</p>
              <h2 id="status-title">Fundația aplicației este pregătită</h2>
            </div>
          </div>
          <p>
            Aceasta este pagina inițială a proiectului. Funcțiile de autentificare, stoc și ture vor
            fi adăugate în etapele următoare.
          </p>
          <div className="next-step">
            <span className="step-number" aria-hidden="true">
              01
            </span>
            <div>
              <h3>Urmează interfața comună</h3>
              <p>
                Navigație, selecția substației și componente adaptate pentru calculator și telefon.
              </p>
            </div>
          </div>
        </section>

        <p className="demo-note">
          Proiect pentru prezentare. Scenariile demonstrative vor folosi exclusiv date fictive.
        </p>
      </main>

      <footer className="welcome-footer">
        <span>Gestiune substații · Fundație M00</span>
        <a href="https://github.com/razvanstav/ambulanta">
          Proiect pe GitHub <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  );
}

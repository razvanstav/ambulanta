import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/primitives";
import { ActionForm } from "@/components/ui/action-form";
import { getIdentity } from "@/modules/identity/server";
import { signIn } from "@/modules/identity/actions";
import { supabaseConfig } from "@/lib/supabase/config";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getIdentity()) redirect("/");
  const { next } = await searchParams;
  const configured = Boolean(supabaseConfig());
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="pulse" />
          </span>
          <span>
            <strong>
              SAJ<span className="brand-dot">.</span>
            </strong>
            <small>Gestiune substații</small>
          </span>
        </div>
        <Badge tone="blue">Spațiul echipei</Badge>
        <h1>
          Fiecare tură începe
          <br />
          <span>cu încredere.</span>
        </h1>
        <p>
          Un singur loc pentru substații, echipaje și evidența produselor. Acces individual,
          potrivit responsabilității tale.
        </p>
        <div className="login-detail">
          <Icon name="ambulance" />
          <span>
            Grijă pentru echipaje.
            <br />
            <strong>Claritate în fiecare tură.</strong>
          </span>
        </div>
      </section>
      <section className="panel login-card" aria-labelledby="login-title">
        <p className="eyebrow">BINE AI REVENIT</p>
        <h2 id="login-title">Intră în cont</h2>
        <p className="page-description">Folosește contul individual primit de la administrator.</p>
        {!configured && (
          <p role="alert" className="form-error">
            Conexiunea Supabase nu este configurată pe acest mediu.
          </p>
        )}
        <ActionForm action={signIn} submitLabel="Autentificare" disabled={!configured}>
          <input type="hidden" name="next" value={next ?? "/"} />
          <label>
            Adresă de e-mail
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="nume@institutie.ro"
            />
          </label>
          <label>
            Parolă
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
        </ActionForm>
        <p className="identity-note">
          Pentru un cont nou sau recuperarea accesului, contactează administratorul.
        </p>
        <Link href="/demo" className="text-link">
          Explorează interfața demonstrativă <Icon name="arrow" />
        </Link>
      </section>
      <footer className="login-footer">SAJ · Gestiune substații · Mediu cu date fictive</footer>
    </main>
  );
}

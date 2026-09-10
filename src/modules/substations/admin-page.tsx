import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, PageHeading, Panel } from "@/components/ui/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdministrator } from "@/modules/identity/server";
import { roleLabels, type AppRole, type RoleAssignment } from "@/modules/identity/policy";
import { createAccount, saveSubstation, setAccountAccess } from "@/modules/identity/actions";

function Reason() {
  return (
    <label>
      Motivul modificării
      <input
        name="reason"
        required
        minLength={5}
        maxLength={500}
        placeholder="Descrie motivul pentru audit"
      />
    </label>
  );
}
export async function AdminPage() {
  const identity = await requireAdministrator();
  const client = await createSupabaseServerClient();
  const [profiles, assignments] = await Promise.all([
    client.from("profiles").select("id,display_name,active").order("display_name"),
    client.from("role_assignments").select("user_id,role,substation_id"),
  ]);
  if (profiles.error || assignments.error) throw new Error("Conturile nu au putut fi încărcate.");
  const roles = assignments.data as (RoleAssignment & { user_id: string })[];
  const globalRoles: AppRole[] = ["administrator", "logistics"];
  const localRoles: AppRole[] = ["station_manager", "warehouse", "shift_leader"];
  return (
    <AuthenticatedShell identity={identity}>
      <PageHeading
        eyebrow="CONFIGURAREA INSTITUȚIEI"
        title="Administrare"
        description="Substații, conturi individuale și drepturi explicite. Fiecare modificare păstrează autorul și motivul."
      />
      <div className="identity-grid">
        <Panel
          title="Adaugă substație"
          description="Substația va fi disponibilă conturilor cu roluri atribuite."
        >
          <ActionForm action={saveSubstation} submitLabel="Adaugă substația">
            <label>
              Denumire substație
              <input name="name" required minLength={2} maxLength={120} />
            </label>
            <label className="check-label">
              <input type="checkbox" name="active" defaultChecked />
              Substație activă
            </label>
            <Reason />
          </ActionForm>
        </Panel>
        <Panel
          title="Creează cont"
          description="Contul este creat fără roluri. Transmite parola individual, apoi atribuie accesul mai jos."
        >
          {process.env.SUPABASE_SECRET_KEY ? (
            <ActionForm action={createAccount} submitLabel="Creează contul">
              <label>
                Nume afișat
                <input name="name" required minLength={2} maxLength={120} autoComplete="off" />
              </label>
              <label>
                Adresă de e-mail
                <input type="email" name="email" required maxLength={254} autoComplete="off" />
              </label>
              <label>
                Parolă inițială
                <input
                  type="password"
                  name="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <Reason />
            </ActionForm>
          ) : (
            <p className="identity-note">
              Conturile noi se creează din mediul local de administrare. Conturile existente pot
              folosi aplicația și drepturile lor pot fi gestionate mai jos.
            </p>
          )}
        </Panel>
      </div>
      <Panel
        title="Substațiile instituției"
        description={`${identity.substations.length} substații înregistrate. Dezactivarea oprește accesul la substație.`}
      >
        <div className="admin-records">
          {identity.substations.map((station) => (
            <details key={station.id}>
              <summary>
                <span>{station.name}</span>
                <Badge tone={station.active ? "green" : "neutral"}>
                  {station.active ? "Activă" : "Inactivă"}
                </Badge>
              </summary>
              <ActionForm action={saveSubstation} submitLabel="Salvează substația">
                <input type="hidden" name="id" value={station.id} />
                <label>
                  Denumire substație
                  <input
                    name="name"
                    defaultValue={station.name}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
                <label className="check-label">
                  <input type="checkbox" name="active" defaultChecked={station.active} />
                  Substație activă
                </label>
                <Reason />
              </ActionForm>
            </details>
          ))}
          {!identity.substations.length && (
            <p className="identity-note">
              Adaugă prima substație pentru a pregăti spațiile de lucru.
            </p>
          )}
        </div>
      </Panel>
      <Panel
        title="Conturi și drepturi"
        description="Logistica centrală vede toate substațiile. Rolurile locale se acordă separat; șeful de tură are numai acces propriu."
      >
        <div className="admin-records">
          {profiles.data.map((profile) => {
            const own = profile.id === identity.id;
            const current = roles.filter((role) => role.user_id === profile.id);
            function roleCheckbox(role: AppRole, station: string | null) {
              return (
                <label className="check-label" key={`${role}:${station}`}>
                  <input
                    type="checkbox"
                    name="roles"
                    value={`${role}:${station ?? "global"}`}
                    defaultChecked={current.some(
                      (item) => item.role === role && item.substation_id === station,
                    )}
                  />
                  {roleLabels[role]}
                </label>
              );
            }
            return (
              <details key={profile.id}>
                <summary>
                  <span>
                    {profile.display_name}
                    {own ? " (contul tău)" : ""}
                    <small>
                      {current.length
                        ? current.map((item) => roleLabels[item.role]).join(" · ")
                        : "Fără roluri"}
                    </small>
                  </span>
                  <Badge tone={profile.active ? "green" : "neutral"}>
                    {profile.active ? "Activ" : "Inactiv"}
                  </Badge>
                </summary>
                {own && (
                  <p className="identity-note">
                    Propriul acces poate fi modificat numai de alt administrator. Această regulă
                    protejează accesul instituției.
                  </p>
                )}
                <ActionForm
                  action={setAccountAccess}
                  submitLabel="Salvează drepturile"
                  disabled={own}
                >
                  <input type="hidden" name="user" value={profile.id} />
                  <label className="check-label">
                    <input type="checkbox" name="active" defaultChecked={profile.active} />
                    Cont activ
                  </label>
                  <div className="role-group">
                    <h3>Roluri în întreaga instituție</h3>
                    {globalRoles.map((role) => roleCheckbox(role, null))}
                  </div>
                  {identity.substations
                    .filter(
                      (station) =>
                        station.active || current.some((item) => item.substation_id === station.id),
                    )
                    .map((station) => (
                      <div className="role-group" key={station.id}>
                        <h3>
                          {station.name}
                          {!station.active && " · inactivă"}
                        </h3>
                        {localRoles.map((role) => roleCheckbox(role, station.id))}
                        {!station.active && (
                          <p className="identity-note">
                            Elimină rolurile inactive înainte de salvare sau reactivează substația.
                          </p>
                        )}
                      </div>
                    ))}
                  <Reason />
                </ActionForm>
              </details>
            );
          })}
        </div>
      </Panel>
    </AuthenticatedShell>
  );
}

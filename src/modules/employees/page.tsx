import { ActionForm } from "@/components/ui/action-form";
import { Badge, Panel, StateMessage } from "@/components/ui/primitives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageStation, isAdmin, type Identity } from "@/modules/identity/policy";
import { getEmployees, getEligibleHolders, type Employee } from "./index";
import { saveEmployee } from "./actions";

type Account = { id: string; display_name: string; active: boolean };
function EmployeeForm({
  stationId,
  identity,
  accounts,
  employee,
}: {
  stationId: string;
  identity: Identity;
  accounts: Account[];
  employee?: Employee;
}) {
  return (
    <ActionForm
      action={saveEmployee}
      submitLabel={employee ? "Salvează angajatul" : "Adaugă angajatul"}
    >
      <input type="hidden" name="station" value={stationId} />
      <input type="hidden" name="employee" value={employee?.id ?? ""} />
      <div className="form-columns">
        <label>
          Cod intern
          <input name="code" defaultValue={employee?.code} required minLength={2} maxLength={30} />
        </label>
        <label>
          Nume și prenume
          <input
            name="name"
            defaultValue={employee?.display_name}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
      </div>
      <label>
        Funcție
        <input
          name="job"
          defaultValue={employee?.job_title}
          required
          minLength={2}
          maxLength={100}
          placeholder="De exemplu: asistent medical"
        />
      </label>
      {isAdmin(identity) ? (
        <label>
          Cont individual
          <select name="account" defaultValue={employee?.user_id ?? ""}>
            <option value="">Fără cont asociat</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.display_name}
                {!account.active && " · inactiv"}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Pentru „Tura mea”, contul trebuie să aibă și rolul Șef de tură în această substație,
            acordat din Administrare.
          </span>
        </label>
      ) : (
        <>
          <input type="hidden" name="account" value={employee?.user_id ?? ""} />
          <p className="identity-note">
            Asocierea contului individual este gestionată de administratorul instituției.
          </p>
        </>
      )}
      <div className="form-columns">
        <label className="check-label">
          <input type="checkbox" name="active" defaultChecked={employee?.active ?? true} />
          Activ în substație
        </label>
        <label className="check-label">
          <input type="checkbox" name="titular" defaultChecked={employee?.is_titular ?? false} />
          Titular
        </label>
      </div>
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
    </ActionForm>
  );
}
export async function EmployeesPage({
  stationId,
  identity,
}: {
  stationId: string;
  identity: Identity;
}) {
  const [employees, eligible] = await Promise.all([
    getEmployees(stationId),
    getEligibleHolders(stationId),
  ]);
  const manage = canManageStation(identity, stationId);
  let accounts: Account[] = [];
  if (isAdmin(identity)) {
    const client = await createSupabaseServerClient();
    const result = await client
      .from("profiles")
      .select("id,display_name,active")
      .order("display_name");
    if (result.error) throw new Error("Conturile pentru asociere nu au putut fi încărcate.");
    accounts = result.data as Account[];
  }
  return (
    <>
      <div className="people-stats" aria-label="Situația personalului">
        <div>
          <span>Angajați înregistrați</span>
          <strong>{employees.length}</strong>
        </div>
        <div>
          <span>Activi în substație</span>
          <strong>{employees.filter((employee) => employee.active).length}</strong>
        </div>
        <div>
          <span>Titulari eligibili</span>
          <strong>{eligible.length}</strong>
        </div>
      </div>
      <Panel
        title="Personalul substației"
        description="Titularul este responsabilul unei ture. Un angajat poate fi păstrat în evidență și fără cont."
      >
        {employees.length ? (
          <div className="admin-records personnel-records">
            {employees.map((employee) => {
              const eligibleNow = eligible.some((holder) => holder.employee_id === employee.id);
              return (
                <details key={employee.id}>
                  <summary>
                    <span>
                      {employee.display_name}
                      <small>
                        {employee.code} · {employee.job_title}
                      </small>
                    </span>
                    <span className="record-badges">
                      <Badge tone={employee.active ? "green" : "neutral"}>
                        {employee.active ? "Activ" : "Inactiv"}
                      </Badge>
                      {employee.is_titular && <Badge tone="blue">Titular</Badge>}
                    </span>
                  </summary>
                  <p className="identity-note">
                    {!employee.active
                      ? "Inactiv în această substație; exclus din predările noi."
                      : !employee.is_titular
                        ? "Angajat fără atribuție de titular; exclus din predările noi."
                        : eligibleNow
                          ? "Eligibil pentru o tură nouă. Cont individual asociat și acces activ."
                          : "Titular neeligibil momentan: verifică asocierea contului, starea și rolul Șef de tură."}
                  </p>
                  {manage && (
                    <EmployeeForm
                      stationId={stationId}
                      identity={identity}
                      accounts={accounts}
                      employee={employee}
                    />
                  )}
                </details>
              );
            })}
          </div>
        ) : (
          <StateMessage
            kind="empty"
            title="Niciun angajat înregistrat"
            description="Personalul adăugat va fi disponibil numai în această substație."
          />
        )}
      </Panel>
      {manage && (
        <Panel
          title="Adaugă angajat"
          description="Modificările sunt salvate în Supabase și păstrează autorul și motivul."
        >
          <EmployeeForm stationId={stationId} identity={identity} accounts={accounts} />
        </Panel>
      )}
      {!manage && (
        <p className="identity-note">
          Ai acces de consultare. Personalul și titularii sunt administrați de șeful substației sau
          de administrator.
        </p>
      )}
    </>
  );
}

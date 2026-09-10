/* eslint-disable @next/next/no-img-element -- Private images use the authenticated download route, without shared optimization cache. */
import { DeclarationFields } from "./declaration-fields";
import { EndGate } from "@/modules/shifts/end-gate";
import { submitCloseout, confirmReturn } from "./actions";
import { randomUUID } from "node:crypto";
import { ActionForm } from "@/components/ui/action-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageStation, type Identity } from "@/modules/identity/policy";
import { canOperateStock, formatQuantity } from "@/modules/inventory/rules";
import { units, type Unit } from "@/modules/catalog/rules";
import type { SheetLine, Shift } from "@/modules/shifts";
import { saveDraft, removeEvidence, setEvidencePolicy } from "./actions";
import { EvidenceUpload } from "./upload-form";
import { PdfPreview } from "./pdf-preview";
import type { CloseoutVersion, EvidenceFile, Readiness } from "./types";

export async function EvidencePolicy({
  stationId,
  identity,
}: {
  stationId: string;
  identity: Identity;
}) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("substations")
    .select("evidence_policy")
    .eq("id", stationId)
    .single();
  if (error) throw new Error("Politica dovezilor nu poate fi încărcată. Verifică migrarea M07.");
  return (
    <details className="evidence-policy">
      <summary>
        Politica dovezilor:{" "}
        {data.evidence_policy === "optional" ? "opționale" : "cel puțin o dovadă"}
      </summary>
      <p className="identity-note">
        Document/fotografie sau semnătură. Acceptarea fișei de predare nu înlocuiește dovada pentru
        închidere.
      </p>
      {canManageStation(identity, stationId) && (
        <ActionForm action={setEvidencePolicy} submitLabel="Salvează politica dovezilor">
          <input type="hidden" name="station" value={stationId} />
          <label>
            Politică
            <select name="policy" defaultValue={data.evidence_policy}>
              <option value="at_least_one">Cel puțin o dovadă</option>
              <option value="optional">Dovezi opționale</option>
            </select>
          </label>
          <label>
            Motivul schimbării politicii
            <input name="reason" minLength={5} maxLength={500} required />
          </label>
        </ActionForm>
      )}
    </details>
  );
}

export async function EvidenceWorkspace({
  stationId,
  shift,
  allocations,
  identity,
  own,
}: {
  stationId: string;
  shift: Shift;
  allocations: SheetLine[];
  identity: Identity;
  own: boolean;
}) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("closeout_versions")
    .select("id,shift_id,version,content_hash,created_at,content")
    .eq("shift_id", shift.id)
    .order("version", { ascending: false });
  if (error) throw new Error("Ciornele declarației nu pot fi încărcate.");
  const versions = data as CloseoutVersion[];
  const current = versions[0];
  const evidenceResult = current
    ? await client
        .from("evidence_files")
        .select("id,version_id,kind,filename,state,signer_name,collector_name,created_at,mime_type")
        .in(
          "version_id",
          versions.map((v) => v.id),
        )
        .order("created_at")
    : { data: [], error: null };
  if (evidenceResult.error) throw new Error("Dovezile nu pot fi încărcate.");
  const files = evidenceResult.data as EvidenceFile[];
  const readinessResult = current
    ? await client.rpc("closeout_readiness", { p_version: current.id })
    : null;
  if (readinessResult?.error) throw new Error("Starea declarației nu poate fi verificată.");
  const readiness = readinessResult?.data as Readiness | undefined;
  const canCollect =
    shift.state === "open" &&
    Boolean(readiness?.current) &&
    (own || canOperateStock(identity, stationId));
  const myDraft = own && shift.owner_id === identity.id && shift.state === "open";
  function evidenceList(version: CloseoutVersion, editable: boolean) {
    return files
      .filter((e) => e.version_id === version.id && e.state !== "removed")
      .map((file) => (
        <div key={file.id} className="evidence-record">
          <strong>
            {file.kind === "signature" ? `Semnătură: ${file.signer_name}` : file.filename}
          </strong>
          <p className="identity-note">
            Colectată de: {file.collector_name} ·{" "}
            {new Intl.DateTimeFormat("ro-RO", {
              timeZone: "Europe/Bucharest",
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(file.created_at))}{" "}
            · {file.state === "validated" ? "Validată" : "Încărcare incompletă"}
          </p>
          {file.state === "validated" && (
            <>
              <a href={`/api/evidence/${file.id}`} target="_blank" rel="noreferrer">
                Deschide dovada privată
              </a>
              {file.mime_type !== "application/pdf" && (
                <img
                  className="evidence-preview"
                  src={`/api/evidence/${file.id}`}
                  alt={
                    file.kind === "signature"
                      ? `Semnătura declarată de ${file.signer_name}`
                      : "Dovadă fotografică"
                  }
                />
              )}
              {file.mime_type === "application/pdf" && (
                <PdfPreview id={file.id} filename={file.filename} />
              )}
            </>
          )}
          {editable && file.kind === "document" && (
            <ActionForm action={removeEvidence} submitLabel="Elimină documentul din declarație">
              <input type="hidden" name="station" value={stationId} />
              <input type="hidden" name="evidence" value={file.id} />
            </ActionForm>
          )}
        </div>
      ));
  }
  return (
    <section className="closeout-workspace" aria-label="Declarație de închidere">
      <h3>
        {shift.state === "closed"
          ? "Declarație finală — tură închisă"
          : shift.state === "pending_close"
            ? "Retur trimis spre verificare"
            : "Încheierea turei"}
      </h3>
      <p className="identity-note">
        1. Declară consumul. 2. Verifică ce rămâne în mașină și atașează dovada sau semnează. 3.
        Închide după finalul programat. Returul fizic necesită confirmarea magaziei.
      </p>
      {myDraft && (
        <details open={!current || !readiness?.current} key={current?.id ?? shift.id}>
          <summary>
            {current
              ? "Modifică declarația — creează versiune nouă"
              : "1. Completează consumul și stocul rămas"}
          </summary>
          <ActionForm action={saveDraft} submitLabel="Salvează ciorna declarației">
            <input type="hidden" name="station" value={stationId} />
            <input type="hidden" name="shift" value={shift.id} />
            <input type="hidden" name="expected_version" value={current?.id ?? ""} />
            <input type="hidden" name="request_key" value={randomUUID()} />
            <p className="identity-note">
              O versiune nouă cere dovezi noi. Semnătura și documentele anterioare rămân numai în
              istoricul versiunii vechi. Preluat = consumat + rămas în mașină + retur fizic în
              magazie.
            </p>
            {allocations.map((line, index) => (
              <DeclarationFields
                key={`${current?.id ?? shift.id}-${line.id}`}
                line={line}
                index={index}
                previous={current?.content.lines.find((l) => l.allocation_id === line.id)}
              />
            ))}
          </ActionForm>
        </details>
      )}
      {!current && !myDraft && (
        <p className="identity-note">
          Titularul nu a salvat încă o declarație. După salvare, magazia poate colecta dovezi pentru
          versiunea sa exactă.
        </p>
      )}
      {current && (
        <>
          <h4>
            {shift.state === "closed" ? "Declarație finală" : "Declarație"} v{current.version} ·
            cantități salvate
          </h4>
          <ul className="holder-list">
            {current.content.lines.map((line) => (
              <li key={line.allocation_id}>
                <span>
                  {line.product_name}
                  <small>
                    {line.lot_code} · {units[line.base_unit as Unit]}
                  </small>
                </span>
                <span>
                  Preluat {formatQuantity(line.issued)}
                  <small>
                    Consumat {formatQuantity(line.consumed)} · Rămâne în mașină{" "}
                    {formatQuantity(
                      line.remaining ??
                        Number(line.issued) - Number(line.consumed) - Number(line.returned),
                    )}{" "}
                    · Retur fizic {formatQuantity(line.returned)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <p className="identity-note">
            {shift.state === "closed"
              ? "Închidere confirmată. Consumul și returul fizic au fost înregistrate; restul a rămas în mașină."
              : shift.state === "pending_close"
                ? "Declarația este trimisă și nu mai poate fi editată. Se așteaptă confirmarea returului fizic de către magazie."
                : !readiness?.current
                  ? "Versiune depășită: au apărut alocări noi sau tura nu mai este deschisă. Titularul trebuie să salveze din nou declarația."
                  : !readiness.balanced
                    ? "Salvează o declarație actualizată: preluat = consumat + rămas în mașină + retur fizic."
                    : readiness.ready
                      ? "Declarația și dovezile sunt pregătite. Poți închide după finalul programat."
                      : "Cantități reconciliate. Mai este necesară cel puțin o dovadă validată."}
          </p>
          {evidenceList(current, canCollect)}
          {canCollect && (
            <div className="evidence-columns">
              {files.filter(
                (e) =>
                  e.version_id === current.id && e.kind === "document" && e.state !== "removed",
              ).length < 5 && (
                <div>
                  <h4>2. Dovada consumului declarat</h4>
                  <p className="identity-note">
                    Atașează fișa de consum sau o fotografie lizibilă a documentului care justifică
                    materialele declarate consumate în această tură. Dovada se leagă de cantitățile
                    afișate mai sus, pentru mașina {shift.vehicle_identifier}, titular{" "}
                    {shift.holder_name}, versiunea {current.version}. Poți folosi semnătura în locul
                    documentului.
                  </p>
                  <EvidenceUpload
                    key={`${current.id}-document-${files.filter((e) => e.version_id === current.id && e.kind === "document").length}`}
                    versionId={current.id}
                    signerName={shift.holder_name}
                  />
                </div>
              )}
              {!files.some(
                (e) =>
                  e.version_id === current.id && e.kind === "signature" && e.state !== "removed",
              ) && (
                <div>
                  <h4>Confirmă prin semnătură · v{current.version}</h4>
                  <p className="identity-note">
                    Semnătura confirmă consumul, stocul rămas în mașină și eventualul retur din
                    declarația de mai sus. Odată salvată, se păstrează în istoric.
                  </p>
                  <EvidenceUpload
                    key={`${current.id}-signature-${files.length}`}
                    versionId={current.id}
                    signature
                    signerName={shift.holder_name}
                  />
                </div>
              )}
            </div>
          )}
          {myDraft && (
            <EndGate
              end={shift.planned_end}
              ready={Boolean(readiness?.ready)}
              action={submitCloseout}
              label={
                current.content.lines.some((l) => Number(l.returned) > 0)
                  ? "3. Trimite returul spre confirmare"
                  : "3. Închide tura"
              }
            >
              <input type="hidden" name="station" value={stationId} />
              <input type="hidden" name="version" value={current.id} />
              <input type="hidden" name="request_key" value={randomUUID()} />
              <p className="identity-note">
                Confirmarea înregistrează consumul. Materialele neconsumate rămân în stocul mașinii
                pentru următoarea tură.
              </p>
            </EndGate>
          )}
          {!own &&
            identity.id !== shift.owner_id &&
            canOperateStock(identity, stationId) &&
            shift.state === "pending_close" && (
              <ActionForm
                action={confirmReturn}
                submitLabel="Confirm primirea returului și închid tura"
              >
                <input type="hidden" name="station" value={stationId} />
                <input type="hidden" name="version" value={current.id} />
                <input type="hidden" name="request_key" value={randomUUID()} />
                <label className="check-label">
                  <input type="checkbox" name="confirm" required />
                  Am primit fizic cantitățile indicate ca retur în magazie.
                </label>
              </ActionForm>
            )}
        </>
      )}
      {versions.length > 1 && (
        <details>
          <summary>Istoricul ciornelor și al dovezilor</summary>
          {versions.slice(1).map((version) => (
            <details key={version.id}>
              <summary>
                Ciornă v{version.version} — dovezi valabile numai pentru această versiune
              </summary>
              <ul>
                {version.content.lines.map((line) => (
                  <li key={line.allocation_id}>
                    {line.product_name} · {line.lot_code}: consumat {formatQuantity(line.consumed)},
                    returnat {formatQuantity(line.returned)} {units[line.base_unit as Unit]}
                  </li>
                ))}
              </ul>
              {evidenceList(version, false)}
            </details>
          ))}
        </details>
      )}
    </section>
  );
}

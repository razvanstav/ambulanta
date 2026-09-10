// Exclusiv exemple vizuale M01. Nu reprezintă modele persistente sau contracte de stoc.
export const demoSnapshot = "2026-09-10T07:30:00Z";
export const demoSubstations = [
  { id: "rosiori", name: "Roșiori", description: "Substație demonstrativă" },
  { id: "alexandria", name: "Alexandria", description: "Exemplu fără înregistrări" },
] as const;
export type DemoSubstationId = (typeof demoSubstations)[number]["id"];

export const demoProducts = [
  {
    id: "P-001",
    name: "Comprese sterile",
    category: "Consumabile",
    unit: "buc.",
    quantity: 240,
    threshold: 50,
    lot: "DEMO-CS-01",
    expires: "2028-02-28",
  },
  {
    id: "P-002",
    name: "Mănuși nitril, M",
    category: "Consumabile",
    unit: "buc.",
    quantity: 40,
    threshold: 100,
    lot: "DEMO-MN-02",
    expires: "2028-06-30",
  },
  {
    id: "P-003",
    name: "Seringi 10 ml",
    category: "Consumabile",
    unit: "buc.",
    quantity: 160,
    threshold: 40,
    lot: "DEMO-SR-03",
    expires: "2028-04-30",
  },
  {
    id: "P-004",
    name: "Soluție salină 0,9%, 500 ml",
    category: "Medicamente",
    unit: "flacon",
    quantity: 18,
    threshold: 25,
    lot: "DEMO-SS-04",
    expires: "2027-03-31",
  },
  {
    id: "P-005",
    name: "Bandaj elastic",
    category: "Consumabile",
    unit: "buc.",
    quantity: 64,
    threshold: 20,
    lot: "DEMO-BE-05",
    expires: "2026-09-28",
  },
  {
    id: "P-006",
    name: "Foarfecă pentru pansamente",
    category: "Accesorii",
    unit: "buc.",
    quantity: 8,
    threshold: 2,
    lot: "—",
    expires: null,
  },
] as const;

export const demoRequests = [
  {
    id: "CER-0042",
    person: "Alexandra Marin",
    initials: "AM",
    vehicle: "DEMO-01",
    time: "07:00 – 19:00",
    status: "În așteptarea fișei",
    tone: "amber",
  },
  {
    id: "CER-0041",
    person: "Mihai Dobre",
    initials: "MD",
    vehicle: "DEMO-02",
    time: "07:00 – 19:00",
    status: "Fișă de acceptat",
    tone: "blue",
  },
  {
    id: "TUR-0039",
    person: "Elena Radu",
    initials: "ER",
    vehicle: "DEMO-03",
    time: "06:00 – 18:00",
    status: "Tură activă",
    tone: "green",
  },
  {
    id: "TUR-0038",
    person: "Andrei Stan",
    initials: "AS",
    vehicle: "DEMO-04",
    time: "06:00 – 18:00",
    status: "Tură activă",
    tone: "green",
  },
] as const;

export const demoVehicles = [
  { id: "DEMO-05", type: "Ambulanță tip B", detail: "Echipată pentru asistență de urgență" },
  { id: "DEMO-06", type: "Ambulanță tip B", detail: "Echipată pentru asistență de urgență" },
] as const;

export const demoIssue = [
  { product: "Comprese sterile", lot: "DEMO-CS-01", quantity: 20, unit: "buc." },
  { product: "Mănuși nitril, M", lot: "DEMO-MN-02", quantity: 10, unit: "buc." },
  { product: "Seringi 10 ml", lot: "DEMO-SR-03", quantity: 10, unit: "buc." },
  { product: "Soluție salină 0,9%, 500 ml", lot: "DEMO-SS-04", quantity: 4, unit: "flacon" },
] as const;

export function demoDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bucharest",
    ...options,
  }).format(new Date(value));
}

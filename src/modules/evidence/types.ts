export type DeclarationLine = {
  allocation_id: string;
  product_name: string;
  lot_code: string;
  base_unit: string;
  quantity_precision: number;
  issued: number;
  consumed: number;
  returned: number;
  remaining?: number;
};
export type CloseoutVersion = {
  id: string;
  shift_id: string;
  version: number;
  content_hash: string;
  created_at: string;
  content: { holder_name: string; vehicle: string; lines: DeclarationLine[] };
};
export type EvidenceFile = {
  id: string;
  version_id: string;
  kind: "document" | "signature";
  filename: string;
  state: "pending" | "validated" | "removed";
  signer_name: string | null;
  collector_name: string;
  created_at: string;
  mime_type: string;
};
export type Readiness = {
  current: boolean;
  balanced: boolean;
  policy: string;
  evidence_count: number;
  ready: boolean;
};

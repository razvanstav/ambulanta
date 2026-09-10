// Compiled identically into browser and server; Netlify's binary payload needs headroom.
export const MAX_FILE_MB = process.env.NEXT_PUBLIC_EVIDENCE_MAX_MB === "4" ? 4 : 10;
export const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;
export const FILE_SIZE_MESSAGE = `Fișierul trebuie să aibă între 1 octet și ${MAX_FILE_MB} MB.`;

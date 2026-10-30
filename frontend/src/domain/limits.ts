export const MAX_PAYMENTS = 10_000;
// Accounts share this budget with merchants, devices, and locations.
export const MAX_OBJECTS = 3000;
export const MAX_ASSOCIATIONS = 12_000;
export const MAX_EVIDENCE_EVENTS = 50;
export const MAX_CSV_BYTES = 5_000_000;
export const MAX_RETAINED_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_RETAINED_IMPORT_ROWS = 20_000;
// Open small groups directly; indistinguishable larger groups may also be leaves.
export const LEAF_PAYMENTS = 30;

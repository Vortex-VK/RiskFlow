import type { Association, Payment } from "../../domain/types";

export type Draft =
  | { kind: "payment"; record: Payment }
  | { kind: "association"; record: Association };

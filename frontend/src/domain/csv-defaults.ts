import type { ImportDefaults } from "./csv";

export function csvDefaults(name = "Imported scenario"): ImportDefaults {
  return {
    name,
    openedAt: "1900-01-01T00:00:00.000Z",
    typicalAmount: "50.00",
    countries: "US",
    categories: "groceries|retail|dining",
    merchantCategory: "retail",
    merchantCountry: "US",
    locationCountry: "US",
    dateOrder: "iso",
    timezone: "",
    amountMode: "positive",
    decimal: "dot",
    statementAccount: "Statement account",
    useAssumedBaselines: false,
  };
}

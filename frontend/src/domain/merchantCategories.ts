// Short display names for verified MCCs. Keep unrecognized and non-MCC
// categories intact; this lookup never changes the inputs sent to the model.
// Source: https://docs.fiserv.dev/public/docs/merchant-category-codes
const merchantCategories: Record<string, string> = {
  "4722": "Travel agency / tour operator",
  "5200": "Home supply store",
  "5311": "Department store",
  "5399": "General merchandise store",
  "5411": "Grocery store / supermarket",
  "5541": "Gas station",
  "5651": "Family clothing store",
  "5732": "Electronics store",
  "5812": "Restaurant",
  "5814": "Fast food restaurant",
  "5912": "Pharmacy",
  "5968": "Direct subscription seller",
  "7832": "Movie theater",
};

export function merchantCategoryName(value: string | number | null) {
  return value !== null && Object.hasOwn(merchantCategories, String(value))
    ? merchantCategories[String(value)]
    : undefined;
}

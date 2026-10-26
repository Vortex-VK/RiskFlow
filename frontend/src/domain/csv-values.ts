export type DateOptions = {
  dateOrder?: "iso" | "mdy" | "dmy";
  timezone?: string;
};

export function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    throw new Error(
      "The file contains invalid text bytes. Export it again as UTF-8 CSV (or UTF-16 with a byte-order mark).",
    );
  }
}

export function csvMoney(
  value: string,
  decimal: "dot" | "comma" = "dot",
): number {
  let text = value
    .trim()
    .replace(/^USD\s*/i, "")
    .replace(/\s*USD$/i, "")
    .trim();
  let sign = 1;
  text = text.replace(
    /^\$\s*([+-])\s*(?=\d)/,
    (_match, symbol: string) => `${symbol}$`,
  );
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1).trim();
  } else if (text.startsWith("-")) {
    sign = -1;
    text = text.slice(1);
  } else if (text.startsWith("+")) text = text.slice(1);
  text = text.replace(/^USD\s*/i, "").replace(/^\$\s*/, "");
  const pattern =
    decimal === "dot"
      ? /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/
      : /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  if (!pattern.test(text))
    throw new Error(
      "Invalid amount. Check decimal format; use at most two decimal places, without formulas or exponent notation.",
    );
  text =
    decimal === "dot"
      ? text.replaceAll(",", "")
      : text.replaceAll(".", "").replace(",", ".");
  const [whole = "", fraction = ""] = text.split(".");
  const cents = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000)
    throw new Error("Amount must not exceed $1,000,000.");
  return sign * cents;
}

export function normalizeCsvDate(
  value: string,
  time: string,
  options: DateOptions,
): { iso: string; dateOnly: boolean } {
  let input = value.trim();
  if (time) input += `T${time.trim()}`;
  const local = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/);
  if (local) {
    if (!options.dateOrder || options.dateOrder === "iso")
      throw new Error(
        "Choose month/day/year or day/month/year for slash dates; ambiguous dates are never guessed.",
      );
    const [, first, second, year, rest] = local;
    input = `${year}-${(options.dateOrder === "mdy" ? first! : second!).padStart(2, "0")}-${(options.dateOrder === "mdy" ? second! : first!).padStart(2, "0")}${rest}`;
  }
  input = input
    .replace(/^(\d{4})\/(\d\d)\/(\d\d)/, "$1-$2-$3")
    .replace(/^(\d{4}-\d\d-\d\d) /, "$1T");
  const dateOnly = /^\d{4}-\d\d-\d\d$/.test(input);
  if (dateOnly) return { iso: `${input}T00:00:00Z`, dateOnly };
  input = input.replace(/(T\d\d:\d\d)(?=Z|[+-]\d\d:\d\d|$)/, "$1:00");
  if (/T\d\d:\d\d:\d\d(?:\.\d{1,3})?$/.test(input)) {
    if (
      !options.timezone ||
      !/^(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(options.timezone)
    )
      throw new Error(
        "This timestamp has no timezone. Choose the export's UTC offset before importing.",
      );
    input += options.timezone;
  }
  return { iso: input, dateOnly };
}

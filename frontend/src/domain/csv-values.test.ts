import { expect, it } from "vitest";
import { decodeCsvBytes, csvMoney } from "./csv-values";

it("decodes BOM-marked UTF-16 and rejects damaged UTF-8", () => {
  const text = "Date,Amount\n2026-10-20,12";
  const buffer = new ArrayBuffer(2 + text.length * 2);
  const view = new DataView(buffer);
  view.setUint16(0, 0xfeff, true);
  [...text].forEach((c, i) => view.setUint16(2 + i * 2, c.charCodeAt(0), true));
  expect(decodeCsvBytes(buffer)).toBe(text);
  expect(() => decodeCsvBytes(new Uint8Array([0xc3, 0x28]).buffer)).toThrow(
    "invalid text bytes",
  );
});

it("parses decimal cents exactly without rounding, sign erasure or currency conversion", () => {
  expect(csvMoney("(USD 1,234.56)")).toBe(-123456);
  expect(csvMoney("-USD 1,234.56")).toBe(-123456);
  expect(csvMoney("1.234,56", "comma")).toBe(123456);
  for (const text of [
    "1e3",
    "1.001",
    "£12",
    "12 EUR",
    "1,23",
    "NaN",
    "1000001",
  ])
    expect(() => csvMoney(text)).toThrow();
});

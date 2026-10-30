import { describe, it, expect } from "vitest";
import {
  parseAmountToMinor,
  formatMoney,
  convertMinor,
  rateToScaled,
  scaledRateToNumber,
  formatRate,
  sumMinor,
  percentage,
  CURRENCY_CODES,
  CURRENCIES,
  isCurrencyCode,
  currencyDecimals,
} from "src/lib/money";

describe("money.ts", () => {
  describe("parseAmountToMinor", () => {
    it("should parse ARS format with comma as decimal separator", () => {
      const result = parseAmountToMinor("1.250,50", "ARS");
      expect(result).toBe(125050);
    });

    it("should parse USD format with dot as decimal separator", () => {
      const result = parseAmountToMinor("1,250.50", "USD");
      expect(result).toBe(125050);
    });

    it("should parse negative amounts", () => {
      const result = parseAmountToMinor("-20", "ARS");
      expect(result).toBe(-2000);
    });

    it("should return null for invalid input", () => {
      const result = parseAmountToMinor("abc", "ARS");
      expect(result).toBeNull();

      const result2 = parseAmountToMinor("", "ARS");
      expect(result2).toBeNull();
    });

    it("should handle zero", () => {
      const result = parseAmountToMinor("0", "ARS");
      expect(result).toBe(0);
    });
  });

  describe("formatMoney", () => {
    it("should format with currency symbol", () => {
      const result = formatMoney(125050, "ARS");
      expect(result).toContain("$");
    });

    it("should format without currency when showCurrency=false", () => {
      const result = formatMoney(125050, "ARS", { showCurrency: false });
      expect(result).not.toContain("$");
    });

    it("should format EUR", () => {
      const result = formatMoney(125050, "EUR");
      expect(result).toContain("€");
    });
  });

  describe("convertMinor", () => {
    it("should convert with rate scaled", () => {
      const result = convertMinor(1000000, 1500);
      expect(result).toBe(1500);
    });

    it("should return 0 for non-finite values", () => {
      const result = convertMinor(NaN, 1500000);
      expect(result).toBe(0);
    });
  });

  describe("rateToScaled", () => {
    it("should convert rate to scaled", () => {
      const result = rateToScaled(1.5);
      expect(result).toBe(1500000);
    });

    it("should return null for invalid rate", () => {
      const result = rateToScaled(0);
      expect(result).toBeNull();

      const result2 = rateToScaled(-1);
      expect(result2).toBeNull();
    });
  });

  describe("scaledRateToNumber", () => {
    it("should convert scaled to number", () => {
      const result = scaledRateToNumber(1500000);
      expect(result).toBe(1.5);
    });

    it("should return number for valid scaled", () => {
      const result = scaledRateToNumber(1000000);
      expect(result).toBe(1);
    });
  });

  describe("percentage", () => {
    it("should calculate percentage", () => {
      expect(percentage(25, 100)).toBe(25);
    });

    it("should return 0 when total is 0", () => {
      expect(percentage(0, 0)).toBe(0);
    });
  });

  describe("CURRENCY_CODES", () => {
    it("should include all expected codes", () => {
      expect(CURRENCY_CODES).toContain("ARS");
      expect(CURRENCY_CODES).toContain("USD");
      expect(CURRENCY_CODES).toContain("EUR");
    });
  });

  describe("CURRENCIES", () => {
    it("should have metadata for each code", () => {
      expect(CURRENCIES["ARS"]).toBeDefined();
      expect(CURRENCIES["USD"]).toBeDefined();
      expect(CURRENCIES["EUR"]).toBeDefined();
    });

    it("should have correct name and symbol for ARS", () => {
      expect(CURRENCIES["ARS"].name).toBe("Peso argentino");
      expect(CURRENCIES["ARS"].symbol).toBe("$");
    });
  });

  describe("isCurrencyCode", () => {
    it("should recognize valid codes", () => {
      expect(isCurrencyCode("ARS")).toBe(true);
      expect(isCurrencyCode("USD")).toBe(true);
      expect(isCurrencyCode("EUR")).toBe(true);
      expect(isCurrencyCode("BRL")).toBe(true);
      expect(isCurrencyCode("INVALID")).toBe(false);
    });
  });

  describe("currencyDecimals", () => {
    it("should return correct decimals for each currency", () => {
      expect(currencyDecimals("ARS")).toBe(2);
      expect(currencyDecimals("CLP")).toBe(0);
      expect(currencyDecimals("JPY")).toBe(0);
      expect(currencyDecimals("USD")).toBe(2);
    });
  });
});
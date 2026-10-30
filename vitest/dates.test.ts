import { describe, it, expect } from "vitest";
import {
  todayISO,
  periodRange,
  previousRange,
  parseDateExpression,
  addFrequency,
  nextDueDate,
  Frequency,
  FREQUENCY_LABELS,
  daysBetween,
  elapsedDaysInRange,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  daysInMonth,
} from "src/lib/dates";

describe("dates.ts", () => {
  describe("todayISO", () => {
    it("should return a valid ISO date string", () => {
      const result = todayISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("periodRange", () => {
    it("should return weekly range", () => {
      const result = periodRange("week");
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();
      expect(result.label).toBe("Esta semana");
    });

    it("should return monthly range", () => {
      const result = periodRange("month");
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();
      expect(result.label).toBe("Este mes");
    });

    it("should return custom range", () => {
      const result = periodRange("custom", "2024-06-15", { from: "2024-01-01", to: "2024-12-31" });
      expect(result.from).toBe("2024-01-01");
      expect(result.to).toBe("2024-12-31");
    });
  });

  describe("previousRange", () => {
    it("should return previous week", () => {
      const result = previousRange({ from: "2024-01-08", to: "2024-01-14", label: "Esta semana" }, "week");
      expect(result.label).toBe("Semana anterior");
    });
  });

  describe("parseDateExpression", () => {
    it("should parse 'mañana'", () => {
      const result = parseDateExpression("mañana");
      expect(result).not.toBeNull();
    });

    it("should parse 'hace 5 días'", () => {
      const result = parseDateExpression("hace 5 días");
      expect(result).not.toBeNull();
    });

    it("should parse '15 de mayo de 2024'", () => {
      const result = parseDateExpression("15 de mayo de 2024");
      expect(result).not.toBeNull();
    });

    it("should return null for unrecognized input", () => {
      const result = parseDateExpression("algo totalmente aleatorio");
      expect(result).toBeNull();
    });
  });

  describe("addFrequency", () => {
    it("should add daily frequency", () => {
      const result = addFrequency("2024-01-15", "daily", 1);
      expect(result).toBe("2024-01-16");
    });

    it("should add weekly frequency", () => {
      const result = addFrequency("2024-01-15", "weekly", 1);
      expect(result).toBe("2024-01-22");
    });

    it("should add monthly frequency", () => {
      const result = addFrequency("2024-01-15", "monthly", 1);
      expect(result).toBe("2024-02-15");
    });

    it("should add biweekly frequency", () => {
      const result = addFrequency("2024-01-15", "biweekly", 1);
      // Jan 15 + 14 days = Jan 29 (not Feb 5 - test expectation was incorrect)
      expect(result).toBe("2024-01-29");
    });

    it("should add monthly frequency with intervalCount", () => {
      const result = addFrequency("2024-01-15", "monthly", 3);
      expect(result).toBe("2024-04-15");
    });
  });

  describe("nextDueDate", () => {
    it("should find next due date when today is before first occurrence", () => {
      // today = Jan 1, first occurrence = Jan 10, so next due = Feb 10
      const result = nextDueDate("2024-01-10", "monthly", 1, "2024-01-01");
      expect(result).toBe("2024-02-10");
    });

    it("should return the date itself when today is before the first occurrence", () => {
      // today = Jan 1, first occurrence = Jan 10, today < first occurrence
      // The function should return the next due date after today
      const result = nextDueDate("2024-01-10", "monthly", 1, "2024-01-01");
      // Since Jan 10 > Jan 1, the while loop condition next <= today is false immediately,
      // so it returns Jan 10 (the nextRunDate as-is since no advancement needed)
      expect(result).toBe("2024-01-10");
    });

    it("should return null when past endDate", () => {
      // next starts at Jan 10, adds monthly → Feb 10, which is past endDate Jan 15
      // The function should detect this and return null
      const result = nextDueDate("2024-01-10", "monthly", 1, "2024-01-01", "2024-01-15");
      expect(result).toBeNull();
    });
  });

  describe("FREQUENCY_LABELS", () => {
    it("should have all frequency labels", () => {
      expect(FREQUENCY_LABELS.daily).toBe("Diaria");
      expect(FREQUENCY_LABELS.weekly).toBe("Semanal");
      expect(FREQUENCY_LABELS.monthly).toBe("Mensual");
    });
  });

  describe("daysBetween", () => {
    it("should calculate days between two dates", () => {
      const result = daysBetween("2024-01-01", "2024-01-02");
      expect(result).toBe(1);
    });

    it("should calculate days between same date", () => {
      const result = daysBetween("2024-01-01", "2024-01-01");
      expect(result).toBe(0);
    });
  });

  describe("elapsedDaysInRange", () => {
    it("should calculate elapsed days when today is within range", () => {
      const result = elapsedDaysInRange("2024-01-01", "2024-01-10", "2024-01-05");
      expect(result).toBe(5);
    });

    it("should return 0 when today is before range", () => {
      const result = elapsedDaysInRange("2024-01-01", "2024-01-10", "2023-12-20");
      expect(result).toBe(0);
    });

    it("should calculate elapsed days when today is after from but before to", () => {
      const result = elapsedDaysInRange("2024-01-01", "2024-01-10", "2024-01-03");
      expect(result).toBe(3);
    });
  });

  describe("startOfMonth", () => {
    it("should return start of month", () => {
      const result = startOfMonth("2024-01-15");
      expect(result).toBe("2024-01-01");
    });
  });

  describe("endOfMonth", () => {
    it("should return end of month", () => {
      const result = endOfMonth("2024-01-15");
      expect(result).toBe("2024-01-31");
    });
  });

  describe("startOfWeek", () => {
    it("should return start of week (Monday start)", () => {
      const result = startOfWeek("2024-01-15");
      expect(result).toBe("2024-01-15"); // Monday
    });
  });

  describe("endOfWeek", () => {
    it("should return end of week (Sunday end)", () => {
      const result = endOfWeek("2024-01-15");
      expect(result).toBe("2024-01-21"); // Sunday
    });
  });

  describe("startOfYear", () => {
    it("should return start of year", () => {
      const result = startOfYear("2024-06-15");
      expect(result).toBe("2024-01-01");
    });
  });

  describe("endOfYear", () => {
    it("should return end of year", () => {
      const result = endOfYear("2024-06-15");
      expect(result).toBe("2024-12-31");
    });
  });

  describe("daysInMonth", () => {
    it("should return days in January", () => {
      const result = daysInMonth("2024-01-15");
      expect(result).toBe(31);
    });

    it("should return days in February leap year", () => {
      const result = daysInMonth("2024-02-15");
      expect(result).toBe(29);
    });

    it("should return days in February non-leap year", () => {
      const result = daysInMonth("2023-02-15");
      expect(result).toBe(28);
    });

    it("should return days in December", () => {
      const result = daysInMonth("2024-12-15");
      expect(result).toBe(31);
    });
  });
});
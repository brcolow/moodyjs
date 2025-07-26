import { SurfacePlate, Table } from "../moody"
import { expect, describe, it, beforeEach } from 'vitest'

describe("Table", () => {
  let table
  let result

  beforeEach(() => {
    table = new Table(SurfacePlate.TopStartingDiagonal, [1, 2, 3], 4, 48, 72, 4)
  });

  describe("midStationValue", () => {
    it("should return the middle value for odd-length array", () => {
      result = table.midStationValue([1, 2, 3])
      expect(result).toBe(2)
    });

    it("should return the average of two middle values for even-length array", () => {
      result = table.midStationValue([10, 20, 30, 40])
      expect(result).toBe(25)
    });

    it("should return null for an empty array", () => {
      result = table.midStationValue([])
      expect(result).toBeNull()
    });

    it("should return the single value for a one-element array", () => {
      result = table.midStationValue([99])
      expect(result).toBe(99)
    });

    it("should return average of two values for a two-element array", () => {
      result = table.midStationValue([8, 12])
      expect(result).toBe(10)
    });
  });
});
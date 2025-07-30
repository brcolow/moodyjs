import { SurfacePlate, Table } from "../moody"
import { expect, describe, it, beforeEach } from 'vitest'

describe("Table", () => {
  let table
  let result

  beforeEach(() => {
    table = new Table(SurfacePlate.TopStartingDiagonal, [1, 2, 3], 4, 48, 72, 4)
  })

  describe("midStationValue", () => {
    it("should return the middle value for odd-length array", () => {
      result = table.midStationValue([1, 2, 3])
      expect(result).toBe(2)
    })

    it("should return the average of two middle values for even-length array", () => {
      result = table.midStationValue([10, 20, 30, 40])
      expect(result).toBe(25)
    })

    it("should return null for an empty array", () => {
      result = table.midStationValue([])
      expect(result).toBeNull()
    })

    it("should return the single value for a one-element array", () => {
      result = table.midStationValue([99])
      expect(result).toBe(99)
    })

    it("should return average of two values for a two-element array", () => {
      result = table.midStationValue([8, 12])
      expect(result).toBe(10)
    })
  })
})

describe("SurfacePlate", () => {
  describe("calculateSuggestedStations", () => {
    it("should calculate correct values for 48x72 surface with 4in spacing", () => {
      const diag = Math.sqrt(48 ** 2 + 72 ** 2)
      const result = SurfacePlate.calculateSuggestedStations(72, 48, diag, 4)

      expect(result.suggestedDiagonalInset).toBeCloseTo(3.2666, 4)
      expect(result.suggestedNumberOfDiagonalStations).toBe(20)
      expect(result.suggestedNumberOfHorizontalStations).toBe(16)
      expect(result.suggestedNumberOfVerticalStations).toBe(10)
    })

    it("should calculate correct values for 36x60 surface with 3.5in spacing", () => {
      const diag = Math.sqrt(36 ** 2 + 60 ** 2)
      const result = SurfacePlate.calculateSuggestedStations(60, 36, diag, 3.5)

      expect(result.suggestedDiagonalInset).toBeCloseTo(3.4857, 4)
      expect(result.suggestedNumberOfDiagonalStations).toBe(18)
      expect(result.suggestedNumberOfHorizontalStations).toBe(15)
      expect(result.suggestedNumberOfVerticalStations).toBe(8)
    })

    it("should calculate correct values for 48x48 surface with 3in spacing", () => {
      const diag = Math.sqrt(48 ** 2 + 48 ** 2)
      const result = SurfacePlate.calculateSuggestedStations(48, 48, diag, 3)

      expect(result.suggestedDiagonalInset).toBeCloseTo(2.4411, 4)
      expect(result.suggestedNumberOfDiagonalStations).toBe(21)
      expect(result.suggestedNumberOfHorizontalStations).toBe(14)
      expect(result.suggestedNumberOfVerticalStations).toBe(14)
    })

    it("should return zero stations if surface too small for spacing", () => {
      const diag = Math.sqrt(4 ** 2 + 4 ** 2)
      const result = SurfacePlate.calculateSuggestedStations(4, 4, diag, 10)

      expect(result.suggestedNumberOfDiagonalStations).toBe(0)
      expect(result.suggestedNumberOfHorizontalStations).toBe(0)
      expect(result.suggestedNumberOfVerticalStations).toBe(0)
    })

    it("should work with non-integer spacing", () => {
      const diag = Math.sqrt(50 ** 2 + 50 ** 2)
      const result = SurfacePlate.calculateSuggestedStations(50, 50, diag, 3.25)

      expect(result.suggestedDiagonalInset).toBeLessThan(3.25)
      expect(result.suggestedNumberOfDiagonalStations).toBeGreaterThan(0)
      expect(result.suggestedNumberOfHorizontalStations).toBeGreaterThan(0)
      expect(result.suggestedNumberOfVerticalStations).toBeGreaterThan(0)
    })
  })
})
import { MoodyReport, SurfacePlate, Table } from "../moody"
import { expect, describe, it, beforeEach } from 'vitest'
import "./test-utils"

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

describe("MoodyReport", () => {
  let moodyReport

  beforeEach(() => {
    const surfacePlate = new SurfacePlate(48, 72, 4)
    moodyReport = new MoodyReport(surfacePlate,
      [6.5, 6.0, 5.0, 5.2, 5.5, 5.6, 5.5, 5.0, 5.5, 4.8, 5.0, 5.2, 5.3, 4.9, 4.6, 4.2, 5.3, 4.9, 4.5, 3.5], // topStartingDiagonal
      [6.6, 5.4, 5.4, 5.2, 5.5, 5.7, 5.0, 5.0, 5.4, 4.5, 4.4, 4.5, 4.5, 4.8, 4.2, 4.2, 4.2, 4.8, 4.3, 3.2], // bottomStartingDiagonal
      [20.5, 19.7, 20.5, 20.3, 20.2, 19.9, 19.0, 19.5, 18.8, 18.6, 18.7, 18.6, 18.4, 18.5, 19.0, 17.9],     // northPerimeter
      [3.5, 2.1, 2.5, 2.8, 3.4, 3.2, 3.5, 4.0, 4.2, 3.5],                                                   // eastPerimeter
      [16.4, 15, 15.6, 15.5, 15.1, 15.3, 15.1, 14.6, 14, 13.5, 13.5, 13.3, 13.3, 13.4, 14, 13.9],           // southPerimeter
      [6, 4.6, 4.5, 4.7, 5.0, 4.5, 5.9, 6, 6, 4.9],                                                         // westPerimeter
      [11.7, 12.4, 12.1, 12.5, 12.0, 11.5, 11.5, 11.3, 11.3, 10.3, 10.8, 10.3, 10, 10.7, 10.4, 10.4],       // horizontalCenter
      [6.6, 6.4, 6.3, 6.5, 6.6, 6.9, 7.5, 7.4, 7.1, 7]                                                      // verticalCenter
    )
  })

  describe("using original Moody paper data", () => {
    it("should match table 1 (top-starting diagonal)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.topStartingDiagonalTable.angularDisplacements).toEqual([0, 0, -0.5, -1.5, -1.3, -1, -0.9, -1, -1.5, -1, -1.7, -1.5, -1.3, -1.2, -1.6, -1.9, -2.3, -1.2, -1.6, -2.0, -3.0])

      // Column #4
      expect(moodyReport.topStartingDiagonalTable.sumOfDisplacements).toEqual([0, 0, -0.5, -2.0, -3.3, -4.3, -5.2, -6.2, -7.7, -8.7, -10.4, -11.9, -13.2, -14.4, -16.0, -17.9, -20.2, -21.4, -23.0, -25.0, -28.0])

      // Column #5
      expect(moodyReport.topStartingDiagonalTable.cumulativeCorrectionFactors).toEqual([-3.6, -2.2, -0.8, 0.6, 2.0, 3.4, 4.8, 6.2, 7.6, 9.0, 10.4, 11.8, 13.2, 14.6, 16.0, 17.4, 18.8, 20.2, 21.6, 23.0, 24.4])

      // Column #6
      expect(moodyReport.topStartingDiagonalTable.displacementsFromDatumPlane).toEqual([-3.6, -2.2, -1.3, -1.4, -1.3, -0.9, -0.4, 0, -0.1, 0.3, 0, -0.1, 0, 0.2, 0, -0.5, -1.4, -1.2, -1.4, -2.0, -3.6])

      // Column #7
      expect(moodyReport.topStartingDiagonalTable.displacementsFromBaseLine).toEqual([3.2, 4.6, 5.5, 5.4, 5.5, 5.9, 6.4, 6.8, 6.7, 7.1, 6.8, 6.7, 6.8, 7.0, 6.8, 6.3, 5.4, 5.6, 5.4, 4.8, 3.2])

      // Column #8
      // Original Moody paper has 1.4 at index 8, but that's incorrect (even using Moody's rounded up value for sin(1 second)): 67 * 4 * 0.000005 = 13.4
      expect(moodyReport.topStartingDiagonalTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.6, 0.9, 1.1, 1.1, 1.1, 1.2, 1.3, 1.4, 1.3, 1.4, 1.4, 1.3, 1.4, 1.4, 1.4, 1.3, 1.1, 1.1, 1.1, 1.0, 0.6], 1, 10000)
    })

    it("should match table 2 (bottom-starting diagonal)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.bottomStartingDiagonalTable.angularDisplacements).toEqual([0, 0, -1.2, -1.2, -1.4, -1.1, -0.9, -1.6, -1.6, -1.2, -2.1, -2.2, -2.1, -2.1, -1.8, -2.4, -2.4, -2.4, -1.8, -2.3, -3.4])

      // Column #4
      expect(moodyReport.bottomStartingDiagonalTable.sumOfDisplacements).toEqual([0, 0, -1.2, -2.4, -3.8, -4.9, -5.8, -7.4, -9.0, -10.2, -12.3, -14.5, -16.6, -18.7, -20.5, -22.9, -25.3, -27.7, -29.5, -31.8, -35.2])

      // Column #5
      expect(moodyReport.bottomStartingDiagonalTable.cumulativeCorrectionFactors).toBeCloseToArray([-5.3, -3.5, -1.8, 0, 1.7, 3.5, 5.3, 7.0, 8.8, 10.5, 12.3, 14.1, 15.8, 17.6, 19.3, 21.1, 22.9, 24.6, 26.4, 28.1, 29.9], 1)

      // Column #6
      expect(moodyReport.bottomStartingDiagonalTable.displacementsFromDatumPlane).toBeCloseToArray([-5.3, -3.5, -3.0, -2.4, -2.1, -1.4, -0.5, -0.4, -0.2, 0.3, 0, -0.4, -0.8, -1.1, -1.2, -1.8, -2.4, -3.1, -3.1, -3.7, -5.3], 1)

      // Column #7
      expect(moodyReport.bottomStartingDiagonalTable.displacementsFromBaseLine).toBeCloseToArray([1.5, 3.3, 3.8, 4.4, 4.7, 5.4, 6.3, 6.4, 6.6, 7.1, 6.8, 6.4, 6.0, 5.7, 5.6, 5.0, 4.4, 3.7, 3.7, 3.1, 1.5], 1)

      // Column #8
      expect(moodyReport.bottomStartingDiagonalTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.3, 0.6, 0.7, 0.8, 0.9, 1.1, 1.2, 1.3, 1.3, 1.4, 1.4, 1.3, 1.2, 1.1, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.3], 1, 10000)
    })

    it("should match table 3 (north perimeter)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.northPerimeterTable.angularDisplacements).toEqual([0, 0, -0.8, 0, -0.2, -0.3, -0.6, -1.5, -1.0, -1.7, -1.9, -1.8, -1.9, -2.1, -2.0, -1.5, -2.6])

      // Column #4
      expect(moodyReport.northPerimeterTable.sumOfDisplacements).toEqual([0, 0, -0.8, -0.8, -1.0, -1.3, -1.9, -3.4, -4.4, -6.1, -8.0, -9.8, -11.7, -13.8, -15.8, -17.3, -19.9])

      // Column #5
      expect(moodyReport.northPerimeterTable.cumulativeCorrectionFactors).toBeCloseToArray([-5.3, -4.0, -2.6, -1.3, 0.1, 1.4, 2.8, 4.1, 5.5, 6.9, 8.2, 9.6, 10.9, 12.3, 13.6, 15.0, 16.3], 1)

      // Column #6
      expect(moodyReport.northPerimeterTable.displacementsFromDatumPlane).toBeCloseToArray([-5.3, -4.0, -3.4, -2.1, -0.9, 0.1, 0.9, 0.7, 1.1, 0.8, 0.2, -0.2, -0.8, -1.5, -2.2, -2.3, -3.6], 1)

      // Column #7
      expect(moodyReport.northPerimeterTable.displacementsFromBaseLine).toBeCloseToArray([1.5, 2.8, 3.4, 4.7, 5.9, 6.9, 7.7, 7.5, 7.9, 7.6, 7.0, 6.6, 6.0, 5.3, 4.6, 4.5, 3.2], 1)

      // Column #8
      expect(moodyReport.northPerimeterTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.3, 0.6, 0.7, 0.9, 1.2, 1.4, 1.5, 1.5, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 0.9, 0.9, 0.6], 1, 10000)
    })

    it("should match table 4 (east perimeter)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.eastPerimeterTable.angularDisplacements).toEqual([0, 0, -1.4, -1.0, -0.7, -0.1, -0.3, 0, 0.5, 0.7, 0])

      // Column #4
      expect(moodyReport.eastPerimeterTable.sumOfDisplacements).toEqual([0, 0, -1.4, -2.4, -3.1, -3.2, -3.5, -3.5, -3.0, -2.3, -2.3])

      // Column #5
      expect(moodyReport.eastPerimeterTable.cumulativeCorrectionFactors).toBeCloseToArray([-5.3, -4.9, -4.5, -4.1, -3.7, -3.3, -2.9, -2.5, -2.1, -1.7, -1.3], 1)

      // Column #6
      expect(moodyReport.eastPerimeterTable.displacementsFromDatumPlane).toBeCloseToArray([-5.3, -4.9, -6.0, -6.5, -6.8, -6.5, -6.4, -6.0, -5.1, -4.0, -3.6], 1)

      // Column #7
      expect(moodyReport.eastPerimeterTable.displacementsFromBaseLine).toBeCloseToArray([1.5, 1.9, 0.8, 0.3, 0, 0.3, 0.4, 0.8, 1.7, 2.8, 3.2], 1)

      // Column #8
      expect(moodyReport.eastPerimeterTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.3, 0.4, 0.2, 0.1, 0, 0.1, 0.1, 0.2, 0.3, 0.5, 0.6], 1, 10000)
    })

    it("should match table 5 (south perimeter)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.southPerimeterTable.angularDisplacements).toEqual([0, 0, -1.4, -0.8, -0.9, -1.3, -1.1, -1.3, -1.8, -2.4, -2.9, -2.9, -3.1, -3.1, -3.0, -2.4, -2.5])

      // Column #4
      expect(moodyReport.southPerimeterTable.sumOfDisplacements).toEqual([0, 0, -1.4, -2.2, -3.1, -4.4, -5.5, -6.8, -8.6, -11.0, -13.9, -16.8, -19.9, -23.0, -26.0, -28.4, -30.9])

      // Column #5
      expect(moodyReport.southPerimeterTable.cumulativeCorrectionFactors).toBeCloseToArray([-3.6, -1.8, 0, 1.9, 3.7, 5.5, 7.3, 9.2, 11.0, 12.8, 14.7, 16.5, 18.3, 20.1, 22.0, 23.8, 25.6], 1)

      // Column #6
      expect(moodyReport.southPerimeterTable.displacementsFromDatumPlane).toBeCloseToArray([-3.6, -1.8, -1.4, -0.3, 0.6, 1.1, 1.8, 2.4, 2.4, 1.8, 0.8, -0.3, -1.6, -2.9, -4.0, -4.6, -5.3], 1)

      // Column #7
      expect(moodyReport.southPerimeterTable.displacementsFromBaseLine).toBeCloseToArray([3.2, 5.0, 5.4, 6.5, 7.4, 7.9, 8.6, 9.2, 9.2, 8.6, 7.6, 6.5, 5.2, 3.9, 2.8, 2.2, 1.5], 1)

      // Column #8
      expect(moodyReport.southPerimeterTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.6, 1.0, 1.1, 1.3, 1.5, 1.6, 1.7, 1.8, 1.8, 1.7, 1.5, 1.3, 1.1, 0.8, 0.6, 0.4, 0.3], 1, 10000)
    })

    it("should match table 6 (west perimeter)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.westPerimeterTable.angularDisplacements).toEqual([0, 0, -1.4, -1.5, -1.3, -1.0, -1.5, -0.1, 0, 0, -1.1])

      // Column #4
      expect(moodyReport.westPerimeterTable.sumOfDisplacements).toEqual([0, 0, -1.4, -2.9, -4.2, -5.2, -6.7, -6.8, -6.8, -6.8, -7.9])

      // Column #5
      expect(moodyReport.westPerimeterTable.cumulativeCorrectionFactors).toBeCloseToArray([-3.6, -3.0, -2.4, -1.7, -1.1, -0.5, 0.1, 0.7, 1.4, 2.0, 2.6], 1)

      // Column #6
      expect(moodyReport.westPerimeterTable.displacementsFromDatumPlane).toBeCloseToArray([-3.6, -3.0, -3.8, -4.6, -5.3, -5.7, -6.6, -6.1, -5.4, -4.8, -5.3], 1)

      // Column #7
      expect(moodyReport.westPerimeterTable.displacementsFromBaseLine).toBeCloseToArray([3.2, 3.8, 3.0, 2.2, 1.5, 1.1, 0.2, 0.7, 1.4, 2.0, 1.5], 1)

      // Column #8
      expect(moodyReport.westPerimeterTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.6, 0.7, 0.6, 0.4, 0.3, 0.2, 0, 0.1, 0.3, 0.4, 0.3], 1, 10000)
    })

    it("should match table 7 (horizontal center)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.horizontalCenterTable.angularDisplacements).toEqual([0, 0, 0.7, 0.4, 0.8, 0.3, -0.2, -0.2, -0.4, -0.4, -1.4, -0.9, -1.4, -1.7, -1.0, -1.3, -1.3])

      // Column #4
      expect(moodyReport.horizontalCenterTable.sumOfDisplacements).toEqual([0, 0, 0.7, 1.1, 1.9, 2.2, 2.0, 1.8, 1.4, 1.0, -0.4, -1.3, -2.7, -4.4, -5.4, -6.7, -8.0])

      // Column #5
      // Original Moody paper has -5.3 at index 2, -4.7 at index 3, -3.6 at index 5 (all are off by 0.1)
      expect(moodyReport.horizontalCenterTable.cumulativeCorrectionFactors).toBeCloseToArray([-6.5, -5.9, -5.4, -4.8, -4.2, -3.7, -3.1, -2.6, -2.1, -1.5, -1.0, -0.4, 0.1, 0.7, 1.2, 1.8, 2.3], 1)

      // Column #6
      // Original Moody paper has -4.6 at index 2, -3.6 at index 3, -1.4 at index 5 (all are off by 0.1)
      expect(moodyReport.horizontalCenterTable.displacementsFromDatumPlane).toBeCloseToArray([-6.5, -5.9, -4.7, -3.7, -2.3, -1.5, -1.1, -0.8, -0.7, -0.5, -1.4, -1.7, -2.6, -3.7, -4.2, -4.9, -5.7], 1)

      // Column #6a (only center tables have this)
      // Original Moody paper has -2.9 at index 3, -0.7 at index 5 (all are off by 0.1)
      expect(moodyReport.horizontalCenterTable.errorShiftedOut).toBeCloseToArray([-5.8, -5.2, -3.9, -3.0, -1.6, -0.8, -0.4, -0.1, 0, 0.2, -0.7, -1.0, -1.9, -3.0, -3.5, -4.2, -5.0], 1)
     
      // Column #7
      // Original Moody paper has 3.9 at index 3, 5.2 at index 4, 6.1 at index 5, 6.4 at index 6
      expect(moodyReport.horizontalCenterTable.displacementsFromBaseLine).toBeCloseToArray([1.0, 1.6, 2.9, 3.7, 5.1, 5.9, 6.3, 6.7, 6.8, 7.0, 6.1, 5.8, 4.9, 3.8, 3.3, 2.6, 1.8], 1)

      // Column #8
      expect(moodyReport.horizontalCenterTable.displacementsFromBaseLineLinear).toBeCloseToArray([0.2, 0.3, 0.6, 0.8, 1.0, 1.2, 1.3, 1.3, 1.4, 1.4, 1.2, 1.2, 1.0, 0.8, 0.7, 0.5, 0.3], 1, 10000)
    })

   it("should match table 8 (vertical center)", () => {
      // Our values are Moody's values divided by 10 because we use arc-seconds and he uses 1/10 arc-seconds.
      // Column #3
      expect(moodyReport.verticalCenterTable.angularDisplacements).toEqual([0, 0, -0.2, -0.3, -0.1, 0, 0.3, 0.9, 0.8, 0.5, 0.4])

      // Column #4
      expect(moodyReport.verticalCenterTable.sumOfDisplacements).toEqual([0, 0, -0.2, -0.5, -0.6, -0.6, -0.3, 0.6, 1.4, 1.9, 2.3])

      // Column #5
      expect(moodyReport.verticalCenterTable.cumulativeCorrectionFactors).toBeCloseToArray([1.1, 1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1], 1)

      // Column #6
      expect(moodyReport.verticalCenterTable.displacementsFromDatumPlane).toBeCloseToArray([1.1, 1.0, 0.7, 0.3, 0.1, 0, 0.2, 1.0, 1.7, 2.1, 2.4], 1)

      // Original Moody paper did not fill out Column #6a for the vertical center table.

      // Column #7
      expect(moodyReport.verticalCenterTable.displacementsFromBaseLine).toBeCloseToArray([7.9, 7.8, 7.5, 7.1, 6.9, 6.8, 7.0, 7.8, 8.5, 8.9, 9.2], 1)

      // Column #8
      expect(moodyReport.verticalCenterTable.displacementsFromBaseLineLinear).toBeCloseToArray([1.6, 1.6, 1.5, 1.4, 1.4, 1.4, 1.4, 1.6, 1.7, 1.8, 1.8], 1, 10000)
    })
  })
})
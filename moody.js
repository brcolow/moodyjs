"use strict";
const sineOfOneArcsecond = 0.00000484813

function roundTo(n, numDecimalPlaces) {
  const multiplicator = Math.pow(10, numDecimalPlaces)
  n = parseFloat((n * multiplicator).toFixed(11))
  return Math.round(n) / multiplicator
}

class Unit {
  static Imperial = new Unit("imperial")
  static Metric = new Unit("metric")
}

class Direction {
  static North = new Direction('North')
  static South = new Direction('South')
  static East = new Direction('East')
  static West = new Direction('West')
  static Northeast = new Direction('Northeast')
  static Southeast = new Direction('Southeast')
  static Southwest = new Direction('Southwest')
  static Northwest = new Direction('Northwest')

  constructor(name) {
    this.name = name
  }

  toString() {
    return `${this.name}`
  }
}

class LineSegment {
  start
  end
  name

  constructor(start, end, name) {
    this.start = start
    this.end = end
    this.name = name
  }

  displayName() {
    return this.start + " -> " + this.end
  }
}

class Table {
  // Which of the "Union Jack" lines this table holds data for.
  lineSegment
  // The number of measurement stations for this table.
  numStations
  // The autocollimator readings in arc-seconds (Column #2).
  arcSecondData
  reflectorFootSpacingInches
  lowestValueInColumn6ForAllTables
  surfacePlateHeightInches
  surfacePlateWidthInches
  surfacePlateDiagonalInches
  suggestedDiagonalInset

  constructor(lineSegment, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset) {
    this.lineSegment = lineSegment
    this.autocollimatorReadings = arcSecondData
    this.reflectorFootSpacingInches = reflectorFootSpacingInches
    this.surfacePlateHeightInches = surfacePlateHeightInches
    this.surfacePlateWidthInches = surfacePlateWidthInches
    this.suggestedDiagonalInset = suggestedDiagonalInset
  }

  printDebug() {
    return "Table: " + this.lineSegment.name + " (" + this.lineSegment.displayName() + ")" + "\n" +
      "Num Stations: " + this.numStations + "\n" +
      "Column #1: " + this.stationNumbers.join(", ") + "\n" +
      "Column #2: " + this.autocollimatorReadings.join(", ") + "\n" +
      "Column #3: " + this.angularDisplacements.join(", ") + "\n" +
      "Column #4: " + this.sumOfDisplacements.join(", ") + "\n" +
      "Column #5: " + this.cumulativeCorrectionFactors.join(", ") + "\n" +
      "Column #6: " + this.displacementsFromDatumPlane.join(", ") + "\n" +
      "Column #7: " + this.displacementsFromBaseLine.join(", ") + "\n" +
      "Column #8: " + this.displacementsFromBaseLineLinear.join(", ") + "\n"
  }

  get stationNumbers() {
    return this.arcSecondData.map((_, i) => i + 1)
  }

  set autocollimatorReadings(data) {
    this.arcSecondData = data
    // Add the first data point which always defaults to zero (this is part of finding the reference plane).
    this.numStations = this.arcSecondData.unshift(0)
  }

  get autocollimatorReadings() {
    return this.arcSecondData
  }

  // Angular displacements in arc-seconds (Column #3).
  get angularDisplacements() {
    return this.arcSecondData.map((x, i) => i === 0 ? 0 : roundTo(x - this.arcSecondData[1], 2))
  }

  // Sum of angular displacements in arc-seconds (Column #4).
  get sumOfDisplacements() {
    // Return a new array that contains the partial sums from 0 to index of the angular displacements.
    return this.angularDisplacements.map((_, i, arr) => roundTo(arr.slice(0, i + 1).reduce((x, y) => x + y), 2))
  }

  // Column #5
  // Note that this implementation works for the perimeter and center lines, but is overriden by the diagonal lines as they
  // use a different correction method.
  get cumulativeCorrectionFactors() {
    // Subtract the value opposite the last station in Column #4 from the value opposite the same station in Column #6:
    // Note: The first value of Column #6 and the first value of Column #5 are always the same.
    const difference = this.lastValueOfColumn6 - this.sumOfDisplacements[this.numStations - 1]
    // Subtract this value from that opposite the first station in Column #5 and divide the result by the total number of stations on the line minus one:
    const correctionFactor = (this.firstValueOfColumn5 - difference) / (this.numStations - 1)
    // Beginning at the last station in Column #5, add the correction factor cumulatively up the column at each station:
    // If the last value is wrong we need to check if i = arr.length - 1 and if it is use difference value.
    return this.sumOfDisplacements.map((_, i, arr) => roundTo(difference + ((arr.length - i - 1) * correctionFactor), 2))
  }

  // Returns the value of the "middle" station. If the there is no middle (number of readings is odd) then return average of
  // the two middle-most entries.
  midStationValue(arr) {
    if (arr.length % 2 === 0) {
      return arr[((this.numStations - 1) / 2) - 1]
    } else {
      return 0.5 * (arr[(this.numStations - 1) / 2] + arr[(this.numStations + 1) / 2])
    }
  }

  // Angular displacement from datum plane in arc-seconds (Column #6).
  get displacementsFromDatumPlane() {
    // This is simply column #4 + column #5.
    return this.sumOfDisplacements.map((x, i) => roundTo((x + this.cumulativeCorrectionFactors[i]), 2))
  }

  get lowestValueInColumn6() {
    return Math.min(...this.displacementsFromDatumPlane)
  }

  // Angular displacement from base plane in arc-seconds (Column #7).
  get displacementsFromBaseLine() {
    return this.displacementsFromDatumPlane.map(x => roundTo((x + Math.abs(this.lowestValueInColumn6ForAllTables)), 2))
  }

  // Angular displacement from base plane in inches (same unit as reflector foot spacing) (Column #8).
  get displacementsFromBaseLineLinear() {
    return this.displacementsFromBaseLine.map(x => roundTo((x * sineOfOneArcsecond * this.reflectorFootSpacingInches), 8))
  }
}

class DiagonalTable extends Table {
  constructor(lineSegment, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset) {
    super(lineSegment, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset)
  }

  // Column #5
  // Get the middle value of Column #4 (or average of two if given an odd number of readings)
  // Reverse sign of this value and copy to Column #5. Then continue in arithmetic progression
  // down to last value (by adding) and up to first value (by subtracting).
  get cumulativeCorrectionFactors() {
    // Instead of starting at the middle and then iterating up and down, we proceed unidirectionally from first index.
    const correctionFactor = -this.sumOfDisplacements[this.numStations - 1] / (this.numStations - 1)
    // We slice the array because we don't want to count the first dummy 0 measurement that gets added.
    return this.sumOfDisplacements.map((_, i) => roundTo((correctionFactor * i +
      (0.5 * this.sumOfDisplacements[this.numStations - 1] - this.midStationValue(this.sumOfDisplacements.slice(1)))), 2))
  }

  // FIXME: Right now the vertices correspond to the beginning of the reflector - and the z-height it corresponds to is really the z-height at the end of the reflector. So the ends of all of our lines (made from these vertices) are short by one reflector foot spacing.
  //   We need to shift the vertices by one reflectorFootSpacing value (for x and y) and make sure the (0, 0, z) point is being added correctly so its not too short.
  // FIXME: The other thing is we should only be using xInset/yInset for the diagonal lines and not the other lines. We should use reflector foot spacing as insets for the other lines to align with Moody.
  //   We could make it so we also calculate the suggestedHorizontal and suggestedVertical insets. Right now we are assuming the reflectorFootSpacing evenly divides into the plate width/height - but what if it is non-standard?
  // (0,0) origin is bottom left corner of surface plate.
  vertices(zMultiplier = 1) {
    const plateDiagonalAngle = Math.atan(this.surfacePlateWidthInches / this.surfacePlateHeightInches)
    const xInset = this.suggestedDiagonalInset * Math.sin(plateDiagonalAngle)
    const yInset = this.suggestedDiagonalInset * Math.cos(plateDiagonalAngle)
    if (this.lineSegment.start == Direction.Northwest) {
      // Top-Starting Diagonal
      // y = -(table_width/table_height) * x  + table_height
      // sin(theta) = y / reflector_foot_spacing
      // tan(theta) = y / x
      return this.displacementsFromBaseLineLinear.map((z, i) => {
        const x = xInset + (i * Math.sin(plateDiagonalAngle) * this.reflectorFootSpacingInches)
        const y = this.surfacePlateHeightInches - yInset - (i * Math.cos(plateDiagonalAngle) * this.reflectorFootSpacingInches)
        return [x, y, z * zMultiplier]
      })
    } else {
      // Bottom starting diagonal
      // y = (table_width/table_height) * x
      return this.displacementsFromBaseLineLinear.map((z, i) => {
        const x = this.surfacePlateWidthInches - xInset - (i *  Math.sin(plateDiagonalAngle) * this.reflectorFootSpacingInches)
        const y = this.surfacePlateHeightInches - yInset - (i * Math.cos(plateDiagonalAngle) * this.reflectorFootSpacingInches)
        return [x, y, z * zMultiplier]
      })
    }
  }
}

class PerimeterTable extends Table {
  suggestedNumStations
  // First value of Column #5 (copied from associated diagonal table).
  firstValueOfColumn5
  // Last value of Column #6 (copied from associated diagonal table).
  lastValueOfColumn6

  constructor(lineSegment, suggestedNumStations, firstValueOfColumn5, lastValueOfColumn6, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset) {
    super(lineSegment, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset)
    this.suggestedNumStations = suggestedNumStations
    this.firstValueOfColumn5 = firstValueOfColumn5
    this.lastValueOfColumn6 = lastValueOfColumn6
  }

  midStationValue(arr) {
    if (arr.length % 2 === 1) {
      return arr[Math.floor(arr.length / 2)]
    } else {
      return 0.5 * (arr[((arr.length / 2) - 1) / 2] + arr[arr.length / 2])
    }
  }

  // (0,0) origin is bottom left corner of surface plate.
  vertices(zMultiplier = 1) {
    const plateDiagonalAngle = Math.atan(this.surfacePlateWidthInches / this.surfacePlateHeightInches)
    const xInset = this.suggestedDiagonalInset * Math.sin(plateDiagonalAngle)
    const yInset = this.suggestedDiagonalInset * Math.cos(plateDiagonalAngle)
    if (this.lineSegment.start == Direction.Northeast && this.lineSegment.end == Direction.Northwest) {
      // North Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches - xInset - (i * this.reflectorFootSpacingInches), this.surfacePlateHeightInches - yInset, z * zMultiplier])
    } else if (this.lineSegment.start == Direction.Northeast && this.lineSegment.end == Direction.Southeast) {
      // East Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches - xInset, this.surfacePlateHeightInches - yInset - (i * this.reflectorFootSpacingInches), z * zMultiplier])
    } else if (this.lineSegment.start == Direction.Southeast && this.lineSegment.end == Direction.Southwest) {
      // South Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches - xInset - (i * this.reflectorFootSpacingInches), yInset, z * zMultiplier])
    } else if (this.lineSegment.start == Direction.Northwest && this.lineSegment.end == Direction.Southwest) {
      // West Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [xInset, this.surfacePlateHeightInches - yInset - (i * this.reflectorFootSpacingInches), z * zMultiplier])
    }
  }
}

class CenterTable extends Table {
  suggestedNumStations
  // First value of Column #5 (copied from mid-points of associated perimeter lines).
  firstValueOfColumn5
  // Last value of Column #6 (copied from mid-points of associated perimeter lines).
  lastValueOfColumn6

  constructor(lineSegment, suggestedNumStations, firstValueOfColumn5, lastValueOfColumn6, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset) {
    super(lineSegment, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset)
    this.suggestedNumStations = suggestedNumStations
    this.firstValueOfColumn5 = firstValueOfColumn5
    this.lastValueOfColumn6 = lastValueOfColumn6
  }

  midStationValue(arr) {
    if (arr.length % 2 === 1) {
      return arr[Math.floor(arr.length / 2)]
    } else {
      return 0.5 * (arr[((arr.length / 2) - 1) / 2] + arr[arr.length / 2])
    }
  }

  get errorShiftedOut() {
    // Change the sign of the value opposite the midstation in Column #6 and add it to the value opposite each
    // station in Column #6. Enter the sums in Column #6a.
    // Note: This is only done for the horizontal center line.
    // For the vertical center-line just copy the values from Column #6.
    if (this.lineSegment.start == Direction.East) {
      // Horizontal Center Line
      const toAdd = -this.midStationValue(this.displacementsFromDatumPlane)
      return this.displacementsFromDatumPlane.map(x => roundTo(x + toAdd, 2))
    } else if (this.lineSegment.start == Direction.North) {
      // Vertical Center Line
      return this.displacementsFromDatumPlane
    } else {
      throw new Error('Center line segment did not have start direction of East or West but was: ' + this.lineSegment.start)
    }
  }

  get lowestValueInColumn6() {
    // We override this function because for the center tables we need to grab from Column #6a, not #6.
    return Math.min(...this.errorShiftedOut)
  }

  // Column #5
  // Get the middle value of Column #4 (or average of two if given an odd number of readings)
  // Reverse sign of this value and copy to Column #5. Then continue in arithmetic progression
  // down to last value (by adding) and up to first value (by subtracting).
  get cumulativeCorrectionFactors() {
    const difference = this.lastValueOfColumn6 - this.sumOfDisplacements[this.numStations - 1]
    const correctionFactor = (this.firstValueOfColumn5 - difference) / (this.numStations - 1)
    // Beginning at the last station in Column #5, add the correction factor cumulatively up the column at each station:
    // If the last value is wrong we need to check if i = arr.length - 1 and if it is use difference value.
    return this.sumOfDisplacements.map((_, i, arr) => roundTo(difference + ((arr.length - i - 1) * correctionFactor), 2))
  }

  // Angular displacement from base plane in arc-seconds (Column #7).
  get displacementsFromBaseLine() {
    return this.errorShiftedOut.map(x => roundTo((x + Math.abs(this.lowestValueInColumn6ForAllTables)), 2))
  }

  // (0,0) origin is bottom left corner of surface plate.
  vertices(zMultiplier = 1) {
    const plateDiagonalAngle = Math.atan(this.surfacePlateWidthInches / this.surfacePlateHeightInches)
    const xInset = this.suggestedDiagonalInset * Math.sin(plateDiagonalAngle)
    const yInset = this.suggestedDiagonalInset * Math.cos(plateDiagonalAngle)
    if (this.lineSegment.start == Direction.East) {
      // Horizontal Center Line
      return this.displacementsFromBaseLineLinear.map((z, i) => { return [this.surfacePlateWidthInches - xInset - (i * this.reflectorFootSpacingInches), this.surfacePlateHeightInches / 2, z * zMultiplier] })
    } else if (this.lineSegment.start == Direction.North) {
      // Vertical Center Line
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches / 2, this.surfacePlateHeightInches - yInset - (i * this.reflectorFootSpacingInches), z * zMultiplier])
    }
  }

  printDebug() {
    return "Table: " + this.lineSegment.name + " (" + this.lineSegment.displayName() + ")" + "\n" +
      "Num Stations: " + this.numStations + "\n" +
      "Column #1: " + this.stationNumbers.join(", ") + "\n" +
      "Column #2: " + this.autocollimatorReadings.join(", ") + "\n" +
      "Column #3: " + this.angularDisplacements.join(", ") + "\n" +
      "Column #4: " + this.sumOfDisplacements.join(", ") + "\n" +
      "Column #5: " + this.cumulativeCorrectionFactors.join(", ") + "\n" +
      "Column #6: " + this.displacementsFromDatumPlane.join(", ") + "\n" +
      "Column #6a: " + this.errorShiftedOut.join(", ") + "\n" +
      "Column #7: " + this.displacementsFromBaseLine.join(", ") + "\n" +
      "Column #8: " + this.displacementsFromBaseLineLinear.join(", ") + "\n"
  }
}

class SurfacePlate {
  // The two diagonals (naming is done relative to left-to-right direction).
  TopStartingDiagonal = new LineSegment(Direction.Northwest, Direction.Southeast, "Top-Starting Diagonal")
  BottomStartingDiagonal = new LineSegment(Direction.Northeast, Direction.Southwest, "Bottom-Starting Diagonal")
  // The four perimeter lines.
  NorthPerimeter = new LineSegment(Direction.Northeast, Direction.Northwest, "North Perimeter")
  EastPerimeter = new LineSegment(Direction.Northeast, Direction.Southeast, "East Perimeter")
  SouthPerimeter = new LineSegment(Direction.Southeast, Direction.Southwest, "South Perimeter")
  WestPerimeter = new LineSegment(Direction.Northwest, Direction.Southwest, "West Perimeter")
  // The two center lines.
  HorizontalCenter = new LineSegment(Direction.East, Direction.West, "Horizontal Center")
  VerticalCenter = new LineSegment(Direction.North, Direction.South, "Vertical Center")
  surfacePlateHeightInches
  surfacePlateWidthInches
  surfacePlateDiagonalInches
  suggestedDiagonalInset
  suggestedNumberOfDiagonalStations
  suggestedNumberOfHorizontalStations
  suggestedNumberOfVerticalStations
  reflectorFootSpacingInches

  constructor(surfacePlateHeightInches, surfacePlateWidthInches, reflectorFootSpacingInches) {
    this.surfacePlateHeightInches = surfacePlateHeightInches
    this.surfacePlateWidthInches = surfacePlateWidthInches
    this.reflectorFootSpacingInches = reflectorFootSpacingInches
    this.surfacePlateDiagonalInches = Math.floor(Math.sqrt((surfacePlateHeightInches * surfacePlateHeightInches) + (surfacePlateWidthInches * surfacePlateWidthInches)))
    // To calculate the number of stations for the diagonal lines we want to find what inset they should use from the top-left and bottom-right corners.
    // Let a = diagonal line inches and b = reflector spacing inches then:
    // Want to solve the following for x (the diagonal inset from edge inches)
    // (a - 2x) mod b = 0   where a > 0, b > 0, and x <= b
    // Given the above constraints we can solve for x:
    // x = (a mod b) / 2
    //  (a) for 48"x72" a = 86.5 and b = 4 then   x = (86.5 mod 4) / 2 = 1.25  which works, since 86.5 - 1.25 * 2 = 84 ... and 84 / 4 = 21 measurements exactly
    //  (b) for 36"x60" a = 70 and b = 3.5 then   x = (70 mod 3.5) / 2 = 0     which works, since 70 - 0 * 2 = 7       ... and 70 / 3.5 = 20 measurements exactly
    //  (c) for 48"x48" a = 67.9 and b = 3 then   x = (67.9 mod 3) / 2 = 0.95  which works, since 67.9 - 0.95 * 2 = 66 ... and 66 / 3 = 22 measurements exactly
    // NOTE - While this works, this gives us the MINIMAL INSET possible, which is not necessarily what we want. It can return 0 inset, for example, as shown above in example (b).
    // We can check if x is too small (say less than 1), and use the following in that case:
    // x = ((a mod b) / 2) + b / 2
    //
    // Actually, this equation will always give the best answer, to avoid the edge damage region, and x will always be less than b still as: (a mod b) < b
    // Thus, we use, for all cases:
    // x = ((a mod b) / 2) + b / 2
    this.suggestedDiagonalInset = ((this.surfacePlateDiagonalInches % reflectorFootSpacingInches) / 2) + (reflectorFootSpacingInches / 2)
    this.suggestedNumberOfDiagonalStations = (this.surfacePlateDiagonalInches - (2 * this.suggestedDiagonalInset)) / reflectorFootSpacingInches
    this.suggestedNumberOfHorizontalStations = (surfacePlateWidthInches - (2 * reflectorFootSpacingInches)) / reflectorFootSpacingInches
    this.suggestedNumberOfVerticalStations = (surfacePlateHeightInches - (2 * reflectorFootSpacingInches)) / reflectorFootSpacingInches
  }
}

class MoodyReport {
  topStartingDiagonalTable
  bottomStartingDiagonalTable
  northPerimeterTable
  eastPerimeterTable
  southPerimeterTable
  westPerimeterTable
  horizontalCenterTable
  verticalCenterTable

  constructor(surfacePlate, topStartingDiagonalReadings, bottomStartingDiagonalReadings, northPerimeterReadings, eastPerimeterReadings,
    southPerimeterReadings, westPerimeterReadings, horizontalCenterReadings, verticalCenterReadings) {
    this.topStartingDiagonalTable = new DiagonalTable(surfacePlate.TopStartingDiagonal, topStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.bottomStartingDiagonalTable = new DiagonalTable(surfacePlate.BottomStartingDiagonal, bottomStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.northPerimeterTable = new PerimeterTable(surfacePlate.NorthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0],
      northPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.eastPerimeterTable = new PerimeterTable(surfacePlate.EastPerimeter, surfacePlate.suggestedNumberOfVerticalStations,
      this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0],
      eastPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.southPerimeterTable = new PerimeterTable(surfacePlate.SouthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0],
      southPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.westPerimeterTable = new PerimeterTable(surfacePlate.WestPerimeter, surfacePlate.suggestedNumberOfVerticalStations,
      this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0],
      westPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    // TODO: Are we passing the right value for firstValueOfColumn5 for {horizontal/vertical}CenterTable?
    this.horizontalCenterTable = new CenterTable(surfacePlate.HorizontalCenter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane),
      this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane),
      horizontalCenterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.verticalCenterTable = new CenterTable(surfacePlate.VerticalCenter, surfacePlate.suggestedNumberOfVerticalStations,
      this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane),
      this.southPerimeterTable.midStationValue(this.southPerimeterTable.displacementsFromDatumPlane),
      verticalCenterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)

    // Moody uses North Perimeter Line as the example, for the other one's it requires a bit of thinking as to which
    // diagonal line values need to be copied to the other perimeter lines for consistency.

    // Copy value in Column #6 of NE end of NE-SW diagonal in to Columns #5 and #6 for perimeter lines.
    this.northPerimeterTable.cumulativeCorrectionFactors.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.northPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0])
    // Copy value in Column #6 of NW end of NW-SE diagonal in to Column #6 (only) for perimeter lines.
    this.northPerimeterTable.displacementsFromDatumPlane.push(this.bottomStartingDiagonalTable.displacementsFromDatumPlane.at(-1))

    // Do the same (consistent) thing for the other cardinal tables:
    this.southPerimeterTable.cumulativeCorrectionFactors.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.southPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.southPerimeterTable.displacementsFromDatumPlane.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane.at(-1))

    this.eastPerimeterTable.cumulativeCorrectionFactors.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.eastPerimeterTable.displacementsFromDatumPlane.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.eastPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane.at(-1))

    this.westPerimeterTable.cumulativeCorrectionFactors.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.westPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0])
    this.westPerimeterTable.displacementsFromDatumPlane.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane.at(-1))

    // Moody uses the Horizontal Center Line as the example, for the other one (Vertical Center Line), it requires a bit of
    // thinking as to which perimeter line values need to be copied to the other center line for consistency.

    // Enter the value for the midpoint of the east perimeter line opposite the first station in Columns #5 and #6.
    this.horizontalCenterTable.cumulativeCorrectionFactors.unshift(this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane))
    this.horizontalCenterTable.displacementsFromDatumPlane.unshift(this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane))
    // Enter the value for the midpoint of the west perimeter line opposite the last station in Column #6 (only).
    this.horizontalCenterTable.displacementsFromDatumPlane.push(this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane))

    // Do the same (consistent) thing for vertical center line:
    this.verticalCenterTable.cumulativeCorrectionFactors.unshift(this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane))
    this.verticalCenterTable.displacementsFromDatumPlane.unshift(this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane))
    this.verticalCenterTable.displacementsFromDatumPlane.push(this.southPerimeterTable.midStationValue(this.southPerimeterTable.displacementsFromDatumPlane))

    // Find the lowest value in Column #6 across all tables:
    const lowestValueInColumn6 = Math.min(...this.tables.map(table => table.lowestValueInColumn6))
    this.tables.forEach(table => table.lowestValueInColumn6ForAllTables = lowestValueInColumn6)
  }

  vertices(zMultiplier = 1) {
    return this.tables.map(table => table.vertices(zMultiplier)).flat(1)
  }

  get tables() {
    return [this.topStartingDiagonalTable, this.bottomStartingDiagonalTable, this.northPerimeterTable,
      this.eastPerimeterTable, this.southPerimeterTable, this.westPerimeterTable, this.horizontalCenterTable, this.verticalCenterTable]
  }

  printDebug() {
    return this.topStartingDiagonalTable.printDebug() + 
     this.bottomStartingDiagonalTable.printDebug() + 
     this.northPerimeterTable.printDebug() + 
     this.southPerimeterTable.printDebug() + 
     this.eastPerimeterTable.printDebug() + 
     this.westPerimeterTable.printDebug() + 
     this.horizontalCenterTable.printDebug() + 
     this.verticalCenterTable.printDebug()
  }
}

// Moody's original paper states 48x78 which is a non-standard size. It is most likely a typo. Bruce Allen's corrections paper states:

// Table 1 carries the title “Worksheets for Calibrating a 48 x 78-Inch Surface Plate”. The diagonal length of
// such a plate would be slightly less than 92 inches. However the first and second worksheets indicate diagonal
// stations beginning at 3 inches and ending at 83 inches. That is consistent with a 48 x 72 inch surface plate
// (also a US standard size [13]) which has an 86.5-inch diagonal. The title of the Table 1 should be 
// “Worksheets for Calibrating a 48 x 72-Inch Surface Plate”. 
const moodySurfacePlateHeightInches = 48
const moodySurfacePlateWidthInches = 72
const moodyReflectorFootSpacingInches = 4
// TODO: Use a unit pair to specify reflector foot spacing and surface plate width/height and remove naming *Inches
const moodyData =  [
  [6.5, 6.0, 5.0, 5.2, 5.5, 5.6, 5.5, 5.0, 5.5, 4.8, 5.0, 5.2, 5.3, 4.9, 4.6, 4.2, 5.3, 4.9, 4.5, 3.5], // topStartingDiagonal
  [6.6, 5.4, 5.4, 5.2, 5.5, 5.7, 5.0, 5.0, 5.4, 4.5, 4.4, 4.5, 4.5, 4.8, 4.2, 4.2, 4.2, 4.8, 4.3, 3.2], // bottomStartingDiagonal
  [20.5, 19.7, 20.5, 20.3, 20.2, 19.9, 19.0, 19.5, 18.8, 18.6, 18.7, 18.6, 18.4, 18.5, 19.0, 17.9],     // northPerimeter
  [3.5, 2.1, 2.5, 2.8, 3.4, 3.2, 3.5, 4.0, 4.2, 3.5],                                                   // eastPerimeter
  [16.4, 15, 15.6, 15.5, 15.1, 15.3, 15.1, 14.6, 14, 13.5, 13.5, 13.3, 13.3, 13.4, 14, 13.9],           // southPerimeter
  [6, 4.6, 4.5, 4.7, 5.0, 4.5, 5.9, 6, 6, 4.9],                                                         // westPerimeter
  [11.7, 12.4, 12.1, 12.5, 12.0, 11.5, 11.5, 11.3, 11.3, 10.3, 10.8, 10.3, 10, 10.7, 10.4, 10.4],       // horizontalCenter
  [6.6, 6.4, 6.3, 6.5, 6.6, 6.9, 7.5, 7.4, 7.1, 7]]                                                     // verticalCenter

/*
const surfacePlate = new SurfacePlate(48, 72, reflectorFootSpacingInches)
const moodyReport = new MoodyReport(surfacePlate, ...moodyData)
console.log(moodyReport.printDebug())
*/

const lines = [ "topStartingDiagonal", "bottomStartingDiagonal", "northPerimeter", "eastPerimeter", "southPerimeter",
  "westPerimeter", "horizontalCenter", "verticalCenter"]
window.addEventListener('DOMContentLoaded', () => {
  // FIXME: This is just for testing - so we don't have to type in the values each time.
  document.getElementById("plateHeight").value = moodySurfacePlateHeightInches
  document.getElementById("plateWidth").value = moodySurfacePlateWidthInches
  document.getElementById("reflectorFootSpacing").value = moodyReflectorFootSpacingInches

  document.getElementById('fillTestData').addEventListener("click", () => {
    lines.forEach((line, lineIndex) => {
      moodyData[lineIndex].forEach((tableEntry, index) => {
          document.getElementById(line + "Table" + (index + 1)).value = tableEntry
      })
    })
    // Trigger table refresh.
    document.getElementsByClassName("readingInput")[0].dispatchEvent(new Event('input', { bubbles: true }))
  })

  document.getElementById("createTables").addEventListener("click", () => {
    createTables()
  })

})

// Creates the tables for each line (along with its' own table graphic) and adds to the DOM.
function createTables() {
  const surfacePlate = new SurfacePlate(document.getElementById("plateHeight").value,
    document.getElementById("plateWidth").value, document.getElementById("reflectorFootSpacing").value)
  document.getElementById('plateDiagonal').value = surfacePlate.surfacePlateDiagonalInches
  document.getElementById('diagonalInset').value = surfacePlate.suggestedDiagonalInset
  document.getElementById('numHorizontalStations').value = surfacePlate.suggestedNumberOfHorizontalStations
  document.getElementById('numVerticalStations').value = surfacePlate.suggestedNumberOfVerticalStations
  document.getElementById('numDiagonalStations').value = surfacePlate.suggestedNumberOfDiagonalStations
  const plateDiagonalFull = Math.sqrt(((surfacePlate.surfacePlateHeightInches * surfacePlate.surfacePlateHeightInches) + (surfacePlate.surfacePlateWidthInches * surfacePlate.surfacePlateWidthInches)))
  const gradeAAFlatnessReq = .04 * (plateDiagonalFull * plateDiagonalFull) + 40
  document.getElementById('gradeAA').value = roundTo(gradeAAFlatnessReq, 2)
  document.getElementById('gradeA').value = roundTo(gradeAAFlatnessReq * 2, 2)
  document.getElementById('gradeB').value = roundTo(gradeAAFlatnessReq * 4, 2)
  const plateDiagonalFullMicrometers = plateDiagonalFull * 25.4
  const isoGrade0FlatnessReq = 0.003 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 2.5
  document.getElementById('grade0').value = roundTo(isoGrade0FlatnessReq * 39.37, 2) // Convert from micrometers to microinches
  const isoGrade1FlatnessReq = 0.006 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 5
  document.getElementById('grade1').value = roundTo(isoGrade1FlatnessReq * 39.37, 2) // Convert from micrometers to microinches
  const isoGrade2FlatnessReq = 0.012 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 10
  document.getElementById('grade2').value = roundTo(isoGrade2FlatnessReq * 39.37, 2) // Convert from micrometers to microinches
  const isoGrade3FlatnessReq = 0.024 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 20
  document.getElementById('grade3').value = roundTo(isoGrade3FlatnessReq * 39.37, 2) // Convert from micrometers to microinches
  const flatnessInputs = [document.getElementById('gradeAA'), document.getElementById('gradeA'), document.getElementById('gradeB'),
    document.getElementById('grade0'), document.getElementById('grade1'), document.getElementById('grade2'), document.getElementById('grade3')]
  document.getElementById("overallFlatness").addEventListener("input", event => {
   for (const flatnessInput of flatnessInputs) {
     console.log(flatnessInput.value)
     if (Number(event.target.value) <= Number(flatnessInput.value)) {
       flatnessInput.style.background = '#C6EFCE'
     } else {
       flatnessInput.style.background = '#FFC7CE'
     }
   }
  })

  createTableGraphic(surfacePlate)

  lines.forEach(line => {
    const linePropertyName = line[0].toUpperCase() + line.slice(1)
    document.getElementById(line + "Table").createCaption().textContent =
      surfacePlate[linePropertyName].name + " (" + surfacePlate[linePropertyName].displayName() + ")"
    // Delete all non-header rows from table.
    Array.from(document.getElementById(line + "Table").getElementsByTagName("tbody")[0].getElementsByTagName("tr")).forEach(tr => tr.remove())
    // Delete all previously constructed SVG table graphics (for each line).
    if (document.getElementById(line + "TableSvg") != null) {
      document.getElementById(line + "TableSvg").remove()
    }
    const numberOfStations = getNumberOfStations(line, surfacePlate)

    for (let i = 0; i <= numberOfStations; i++) {
      // Create the table rows.
      const row = document.getElementById(line + "Table").getElementsByTagName("tbody")[0].insertRow()
      row.insertCell().textContent = i + 1
      const readingInput = document.createElement("input")
      readingInput.inputMode = "decimal"
      readingInput.required = true
      readingInput.pattern = "[0-9]*[.,]{0,1}[0-9]*"
      readingInput.id = line + "Table" + i
      readingInput.classList.add("readingInput", line + "ReadingInput")
      readingInput.addEventListener("input", event => {
        refreshTables(event, lines, surfacePlate)
      })
      row.insertCell().appendChild(readingInput)
    }
    document.getElementById(line + "Table").style.visibility = "visible"

    // Create the table graphics for each line (with the others greyed out).
    const tableGraphic = document.getElementById("tableGraphic")
    const specificLineTableGraphic = tableGraphic.cloneNode(true)
    specificLineTableGraphic.id = line + "TableSvg"
    specificLineTableGraphic.setAttribute("width", "97%")
    lines.filter(l => l !== line).forEach(otherLine => {
      specificLineTableGraphic.getElementById(otherLine + "LineGroup").setAttribute("stroke", "#A0A0A0")
      specificLineTableGraphic.getElementById(otherLine + "LineGroup").setAttribute("fill", "#A0A0A0")
    })
    document.getElementById(line + "TableSvgContainer").appendChild(specificLineTableGraphic)
  })

  // Now that the rows have been created, set the first input for autocollimator readings to 0 and readonly.
  lines.forEach(line => {
    document.getElementById(line + "Table0").value = "0"
    document.getElementById(line + "Table0").readOnly = true
  })
}

// Creates the main (with multi-colored lines) SVG table graphic and adds it to the DOM.
function createTableGraphic(surfacePlate) {
  const surfacePlateWidthInches = Number(document.getElementById("plateWidth").value)
  const surfacePlateHeightInches = Number(document.getElementById("plateHeight").value)
  document.getElementById('tableGraphic').style.visibility = "visible"
  const surfacePlatePercentHeight = 100 * (surfacePlateHeightInches / (surfacePlateWidthInches + surfacePlateHeightInches))
  const surfacePlatePercentWidth = 100 * (surfacePlateWidthInches / (surfacePlateWidthInches + surfacePlateHeightInches))
  document.getElementById('tableGraphic').setAttribute("viewBox", "0 0 " + surfacePlatePercentWidth + " " + surfacePlatePercentHeight)
  document.getElementById('tableGraphic').setAttribute("width", "30%")
  document.getElementById('outsideRect').setAttribute("width", surfacePlatePercentWidth)
  document.getElementById('outsideRect').setAttribute("height", surfacePlatePercentHeight)
  const plateDiagonalAngle = Math.atan(surfacePlateWidthInches / surfacePlateHeightInches)
  const xInset = surfacePlate.suggestedDiagonalInset * Math.sin(plateDiagonalAngle)
  const yInset = surfacePlate.suggestedDiagonalInset * Math.cos(plateDiagonalAngle)
  document.getElementById('insideRect').setAttribute("x", xInset)
  document.getElementById('insideRect').setAttribute("y", yInset)
  document.getElementById('insideRect').setAttribute("width", surfacePlatePercentWidth - (2 * xInset))
  document.getElementById('insideRect').setAttribute("height", surfacePlatePercentHeight - (2 * yInset))

  // Setup each path of the table SVG graphic (move to start position, draw to end position).
  document.getElementById('topStartingDiagonalLine').setAttribute("d", `M ${xInset} ${yInset} L ${surfacePlatePercentWidth - xInset} ${surfacePlatePercentHeight - yInset}`)
  document.getElementById('bottomStartingDiagonalLine').setAttribute("d", `M ${xInset} ${surfacePlatePercentHeight - yInset} L ${surfacePlatePercentWidth - xInset} ${yInset}`)
  document.getElementById('northPerimeterLine').setAttribute("d", `M ${xInset} ${yInset} L ${surfacePlatePercentWidth - xInset} ${yInset}`)
  document.getElementById('eastPerimeterLine').setAttribute("d", `M ${surfacePlatePercentWidth - xInset} ${yInset} L ${surfacePlatePercentWidth - xInset} ${surfacePlatePercentHeight - yInset}`)
  document.getElementById('southPerimeterLine').setAttribute("d", `M ${surfacePlatePercentWidth - xInset} ${surfacePlatePercentHeight - yInset} L ${xInset} ${surfacePlatePercentHeight - yInset}`)
  document.getElementById('westPerimeterLine').setAttribute("d", `M ${xInset} ${surfacePlatePercentHeight - yInset} L ${xInset} ${yInset}`)
  document.getElementById('horizontalCenterLine').setAttribute("d", `M ${surfacePlatePercentWidth - xInset} ${surfacePlatePercentHeight / 2} L ${xInset} ${surfacePlatePercentHeight / 2}`)
  document.getElementById('verticalCenterLine').setAttribute("d", `M ${surfacePlatePercentWidth / 2} ${yInset} L ${surfacePlatePercentWidth / 2} ${surfacePlatePercentHeight - yInset}`)
}

// Returns the number of stations for the given line.
function getNumberOfStations(line, surfacePlate) {
  if (line.endsWith('Diagonal')) {
    return surfacePlate.suggestedNumberOfDiagonalStations
  } else if (line.startsWith('north') || line.startsWith('south') || line.startsWith('horizontal')) {
    return surfacePlate.suggestedNumberOfHorizontalStations
  } else {
    return surfacePlate.suggestedNumberOfVerticalStations
  }
}

// Recalculates the values by creating a new MoodyReport and updates the table cell values accordingly.
function refreshTables(event, lines, surfacePlate) {
  // One of the autocollimator readings have changed - so recalculate everything (by making a new MoodyReport).
  const readingInputs = document.getElementsByClassName("readingInput")
  if (readingInputs.length > 0) {
    if (Array.from(readingInputs).filter(readingInput => readingInput.value !== '').length == readingInputs.length) {
      // All inputs for autocollimator readings are non-empty, so create new MoodyTable with the readings.
      const moodyReport = new MoodyReport(surfacePlate,
        Array.from(document.getElementsByClassName("topStartingDiagonalReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("bottomStartingDiagonalReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("northPerimeterReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("eastPerimeterReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("southPerimeterReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("westPerimeterReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("horizontalCenterReadingInput")).filter(input => input.readOnly == false).map(input => input.value),
        Array.from(document.getElementsByClassName("verticalCenterReadingInput")).filter(input => input.readOnly == false).map(input => input.value))

      const allZPositions = moodyReport.vertices().map(point => point[2])
      const overallFlatness = (Math.max(...allZPositions) - Math.min(...allZPositions)) * 1000000 // Convert inches to microinches.
      document.getElementById("overallFlatness").value = overallFlatness
      document.getElementById("overallFlatness").dispatchEvent(new Event('input', { 'bubbles': true }))
      /*
      const allXPositions = moodyReport.vertices().map(point => point[0])
      const allYPositions = moodyReport.vertices().map(point => point[1])

      console.log(allXPositions)
      console.log(allYPositions)
      console.log("EXCEL CSV:\r\n")
      for (let i = 0; i < allXPositions.length; i++) {
        console.log(allXPositions[i] + ", " + allYPositions[i])
      }
      */
      let tableModelMatrix = Mat4.create()
      initialize3DTableGraphic(moodyReport, tableModelMatrix)

      // console.log(moodyReport.printDebug())
      lines.forEach(l => {
        Array.from(document.getElementById(l + "Table").getElementsByTagName("tbody")[0].rows).forEach((tableRow, index) => {
          const column3Input = document.createElement("input")
          column3Input.readOnly = true
          column3Input.value = moodyReport[l + "Table"].angularDisplacements[index]
          if (tableRow.cells.length > 2) {
            tableRow.deleteCell(2)
          }
          tableRow.insertCell(2).appendChild(column3Input)

          const column4Input = document.createElement("input")
          column4Input.readOnly = true
          column4Input.value = moodyReport[l + "Table"].sumOfDisplacements[index]
          if (tableRow.cells.length > 3) {
            tableRow.deleteCell(3)
          }
          tableRow.insertCell(3).appendChild(column4Input)

          const column5Input = document.createElement("input")
          column5Input.readOnly = true
          column5Input.value = moodyReport[l + "Table"].cumulativeCorrectionFactors[index]
          if (tableRow.cells.length > 4) {
            tableRow.deleteCell(4)
          }
          tableRow.insertCell(4).appendChild(column5Input)

          const column6Input = document.createElement("input")
          column6Input.readOnly = true
          column6Input.value = moodyReport[l + "Table"].displacementsFromDatumPlane[index]
          if (tableRow.cells.length > 5) {
            tableRow.deleteCell(5)
          }
          tableRow.insertCell(5).appendChild(column6Input)

          const column7Input = document.createElement("input")
          column7Input.readOnly = true
          column7Input.value = moodyReport[l + "Table"].displacementsFromBaseLine[index]
          if (tableRow.cells.length > 6) {
            tableRow.deleteCell(6)
          }
          tableRow.insertCell(6).appendChild(column7Input)

          const column8Input = document.createElement("input")
          column8Input.readOnly = true
          column8Input.value = (moodyReport[l + "Table"].displacementsFromBaseLineLinear[index] * 10000).toFixed(4)
          if (tableRow.cells.length > 7) {
            tableRow.deleteCell(7)
          }
          tableRow.insertCell(7).appendChild(column8Input)
        })
      })
    }
  }
}

let mouseDown = false
let lastMouseX = null
let lastMouseY = null
const keyMap = []

function initialize3DTableGraphic(moodyReport, tableModelMatrix) {
  const canvas = document.getElementById("glcanvas")
  // const gl = canvas.getContext("webgl")
  const gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"))
  if (gl === null) {
    console.log("Unable to initialize WebGL. Your browser or machine may not support it.")
    const ctx = canvas.getContext("2d")

    ctx.font = "30px Arial"
    ctx.fillStyle = "red"
    ctx.textAlign = "center"
    ctx.fillText("Unable to initialize WebGL!", canvas.width / 2, canvas.height / 2)
    return
  }

  canvas.onmousedown = event => {
    mouseDown = true
    lastMouseX = event.clientX
    lastMouseY = event.clientY
  }

  document.onmouseup = () => { mouseDown = false }
  document.onmousemove = () => {
    // FIXME: The mouse rotation is really annoying - this is not the way. We need a better "trackball" rotation.
    if (!mouseDown) {
       return
    }
    const deltaX = event.clientX - lastMouseX
    let newRotationMatrix = Mat4.create()
    // rotate around Y axis
    newRotationMatrix.rotate((deltaX / 5) * (Math.PI / 180), [0, -1, 0])

    const deltaY = event.clientY - lastMouseY
    // rotate around the X axis
    newRotationMatrix.rotate((deltaY / 5) * (Math.PI / 180), [-1, 0, 0])

    tableModelMatrix.multiply(newRotationMatrix)

    lastMouseX = event.clientX
    lastMouseY = event.clientY
  }

  canvas.onwheel = event => {
    // FIXME: Zooming is nice, but we want the table to remain "centered" - current behavior is counter-intuitive.
    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    const zoomFactor = 1 + direction * 0.1
    const scaleMatrix = Mat4.create()
    scaleMatrix.scale([zoomFactor, zoomFactor])
    tableModelMatrix.multiply(scaleMatrix)
  }

  // Pretty weird hack that allows the canvas to be focused and thus receive keydown events.
  canvas.tabIndex = 1

  canvas.onkeyup = event => {
    keyMap[event.key] = false
  }

  canvas.onkeydown = event => {
    event.preventDefault()
    keyMap[event.key] = true
    const translateMatrix = Mat4.create()
    if (keyMap['ArrowUp'] === true) {
      translateMatrix.translate([0, -1.0, 0.0])
    }
    if (keyMap['ArrowDown'] === true) {
      translateMatrix.translate([0, 1.0, 0.0])
    }
    if (keyMap['ArrowRight'] === true) {
      translateMatrix.translate([-1.0, 0.0, 0.0])
    }
    if (keyMap['ArrowLeft'] === true) {
      translateMatrix.translate([1.0, 0.0, 0.0])
    }
    if (keyMap['w'] === true) {
      translateMatrix.translate([0.0, 0.0, -1.0])
    }
    if (keyMap['s'] === true) {
      translateMatrix.translate([0.0, 0.0, 1.0])
    }
    tableModelMatrix.multiply(translateMatrix)
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource)
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "projectionMatrix"),
      modelMatrix: gl.getUniformLocation(shaderProgram, "modelMatrix"),
      viewMatrix: gl.getUniformLocation(shaderProgram, "viewMatrix"),
    },
  }
  const zMultiplier = 100000
  const buffers = initBuffers(gl, moodyReport, zMultiplier)

  function render() {
    drawTableSurface(moodyReport, gl, programInfo, buffers, tableModelMatrix)
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

// Creates a 3D surface of the linear plate heights (calculated as Column #8 of the line tables).
function drawTableSurface(moodyReport, gl, programInfo, buffers, tableModelMatrix) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.clearDepth(1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const fieldOfView = (45 * Math.PI) / 180 // radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight
  const zNear = 0.1
  const zFar = 1000.0
  const projectionMatrix = Mat4.create()

  projectionMatrix.perspective(fieldOfView, aspect, zNear, zFar)

  const modelMatrix = Mat4.create()
  modelMatrix.multiply(tableModelMatrix)

  const viewMatrix = Mat4.create()
  viewMatrix.translate([-35.0, -24.0, -70.0])

  setPositionAttribute(gl, buffers, programInfo)
  setColorAttribute(gl, buffers, programInfo)
  gl.useProgram(programInfo.program)

  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix)
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix)
  gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix)

  {
    let offset = 0
    let vertexCount = moodyReport.topStartingDiagonalTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.bottomStartingDiagonalTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.northPerimeterTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.eastPerimeterTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.southPerimeterTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.westPerimeterTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.horizontalCenterTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = moodyReport.verticalCenterTable.vertices().flat(1).length / 3
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)

    offset += vertexCount
    vertexCount = buffers.triangleVertices.length
    gl.drawArrays(gl.TRIANGLES, offset, vertexCount / 3)
  }
}

const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    varying lowp vec4 vColor;

    void main() {
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * aVertexPosition;
      gl_PointSize = 10.0;
      vColor = aVertexColor;
    }
`

const fsSource = `
    varying lowp vec4 vColor;
    void main() {
      gl_FragColor = vColor;
    }
`

function initBuffers(gl, moodyReport, zMultiplier) {
  const positionBuffer = initPositionBuffer(gl, moodyReport, zMultiplier)
  const lineColorBuffer = initColorBuffer(gl, moodyReport, positionBuffer.triangleVertices)

  return {
    positionBuffer: positionBuffer.positionBuffer,
    linePositions: positionBuffer.linePositions,
    triangleVertices: positionBuffer.triangleVertices,
    lineColors: lineColorBuffer,
  }
}

function initPositionBuffer(gl, moodyReport, zMultiplier) {
  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)

  const vertices = moodyReport.vertices(zMultiplier).map(vertex => new Vertex(vertex[0], vertex[1], vertex[2])).flat(1)

  const triangulation = bowyerWatson(vertices)

  const triangulatedVertices = triangulation.map(triangle => [triangle.v0.x, triangle.v0.y, triangle.v0.z,
    triangle.v1.x, triangle.v1.y, triangle.v1.z,
    triangle.v2.x, triangle.v2.y, triangle.v2.z]).flat(1)
  const linePositions = new Float32Array(moodyReport.vertices(zMultiplier).flat(1)
    .concat(triangulatedVertices))

  gl.bufferData(gl.ARRAY_BUFFER, linePositions, gl.STATIC_DRAW)

  return { positionBuffer: positionBuffer, linePositions: linePositions, triangleVertices: triangulatedVertices}
}

function initColorBuffer(gl, moodyReport, triangleVertices) {
  const triangleZValues = triangleVertices.filter((v, i) => (i + 1) % 3 == 0)
  const minZ = Math.min(...triangleZValues)
  const maxZ = Math.max(...triangleZValues)
  const normalizedTriangleZValues = triangleZValues.map(value => ((value - minZ) / (maxZ - minZ)))
  const colorMappedZValues = normalizedTriangleZValues.map(value => interpolate(turboColormapData, value))
  const lineColors = new Array(moodyReport.topStartingDiagonalTable.numStations).fill([0.9568627450980393, 0.2627450980392157, 0.21176470588235294, 1.0]).flat(1)
    .concat(new Array(moodyReport.bottomStartingDiagonalTable.numStations).fill([1.0, 0.9254901960784314, 0.2313725490196078, 1.0]).flat(1))
    .concat(new Array(moodyReport.northPerimeterTable.numStations).fill([0.2980392156862745, 0.6862745098039216, 0.3137254901960784, 1.0]).flat(1))
    .concat(new Array(moodyReport.eastPerimeterTable.numStations).fill([1.0, 0.4980392156862745, 0.3137254901960784, 1.0]).flat(1))
    .concat(new Array(moodyReport.southPerimeterTable.numStations).fill([0.12941176470588237, 0.5882352941176471, 0.9529411764705882, 1.0]).flat(1))
    .concat(new Array(moodyReport.westPerimeterTable.numStations).fill([1.0, 0.5019607843137255, 0.6745098039215687, 1.0]).flat(1))
    .concat(new Array(moodyReport.horizontalCenterTable.numStations).fill([0.0, 0.749019607843137, 0.8470588235294118, 1.0]).flat(1))
    .concat(new Array(moodyReport.verticalCenterTable.numStations).fill([0.607843137254902, 0.1568627450980392, 0.6862745098039216, 1.0]).flat(1))
    .concat(colorMappedZValues.flat(1)) // Add color mapped colors for the triangles z-value.

  const lineColorBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineColors), gl.STATIC_DRAW)

  return lineColorBuffer
}

function interpolate(colormap, x) {
  x = Math.max(0.0, Math.min(1.0, x))
  const a = Math.trunc(x * 255.0)
  const b = Math.min(255, a + 1)
  const f = x * 255.0 - a
  return [colormap[a][0] + (colormap[b][0] - colormap[a][0]) * f,
          colormap[a][1] + (colormap[b][1] - colormap[a][1]) * f,
          colormap[a][2] + (colormap[b][2] - colormap[a][2]) * f,
          1.0]
}

function setPositionAttribute(gl, buffers, programInfo) {
  const numComponents = 3
  const type = gl.FLOAT
  const normalize = false
  const stride = 0
  const offset = 0
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.positionBuffer)
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    numComponents,
    type,
    normalize,
    stride,
    offset)
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition)
}

function setColorAttribute(gl, buffers, programInfo) {
  const numComponents = 4
  const type = gl.FLOAT
  const normalize = false
  const stride = 0
  const offset = 0
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.lineColors)
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexColor,
    numComponents,
    type,
    normalize,
    stride,
    offset,
  )
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor)
}

// Initialize a shader program.
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource)
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource)

  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`)
    return null
  }

  return shaderProgram
}

// Creates a shader of the given type, uploads the source and compiles it.
function loadShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`)
    gl.deleteShader(shader)
    return null
  }

  return shader
}

// Turbo Color Map by Google: https://blog.research.google/2019/08/turbo-improved-rainbow-colormap-for.html
// Copyright 2019 Google LLC.
// SPDX-License-Identifier: Apache-2.0
// Author: Anton Mikhailov
const turboColormapData = [[0.18995,0.07176,0.23217],[0.19483,0.08339,0.26149],[0.19956,0.09498,0.29024],[0.20415,0.10652,0.31844],[0.20860,0.11802,0.34607],[0.21291,0.12947,0.37314],[0.21708,0.14087,0.39964],[0.22111,0.15223,0.42558],[0.22500,0.16354,0.45096],[0.22875,0.17481,0.47578],[0.23236,0.18603,0.50004],[0.23582,0.19720,0.52373],[0.23915,0.20833,0.54686],[0.24234,0.21941,0.56942],[0.24539,0.23044,0.59142],[0.24830,0.24143,0.61286],[0.25107,0.25237,0.63374],[0.25369,0.26327,0.65406],[0.25618,0.27412,0.67381],[0.25853,0.28492,0.69300],[0.26074,0.29568,0.71162],[0.26280,0.30639,0.72968],[0.26473,0.31706,0.74718],[0.26652,0.32768,0.76412],[0.26816,0.33825,0.78050],[0.26967,0.34878,0.79631],[0.27103,0.35926,0.81156],[0.27226,0.36970,0.82624],[0.27334,0.38008,0.84037],[0.27429,0.39043,0.85393],[0.27509,0.40072,0.86692],[0.27576,0.41097,0.87936],[0.27628,0.42118,0.89123],[0.27667,0.43134,0.90254],[0.27691,0.44145,0.91328],[0.27701,0.45152,0.92347],[0.27698,0.46153,0.93309],[0.27680,0.47151,0.94214],[0.27648,0.48144,0.95064],[0.27603,0.49132,0.95857],[0.27543,0.50115,0.96594],[0.27469,0.51094,0.97275],[0.27381,0.52069,0.97899],[0.27273,0.53040,0.98461],[0.27106,0.54015,0.98930],[0.26878,0.54995,0.99303],[0.26592,0.55979,0.99583],[0.26252,0.56967,0.99773],[0.25862,0.57958,0.99876],[0.25425,0.58950,0.99896],[0.24946,0.59943,0.99835],[0.24427,0.60937,0.99697],[0.23874,0.61931,0.99485],[0.23288,0.62923,0.99202],[0.22676,0.63913,0.98851],[0.22039,0.64901,0.98436],[0.21382,0.65886,0.97959],[0.20708,0.66866,0.97423],[0.20021,0.67842,0.96833],[0.19326,0.68812,0.96190],[0.18625,0.69775,0.95498],[0.17923,0.70732,0.94761],[0.17223,0.71680,0.93981],[0.16529,0.72620,0.93161],[0.15844,0.73551,0.92305],[0.15173,0.74472,0.91416],[0.14519,0.75381,0.90496],[0.13886,0.76279,0.89550],[0.13278,0.77165,0.88580],[0.12698,0.78037,0.87590],[0.12151,0.78896,0.86581],[0.11639,0.79740,0.85559],[0.11167,0.80569,0.84525],[0.10738,0.81381,0.83484],[0.10357,0.82177,0.82437],[0.10026,0.82955,0.81389],[0.09750,0.83714,0.80342],[0.09532,0.84455,0.79299],[0.09377,0.85175,0.78264],[0.09287,0.85875,0.77240],[0.09267,0.86554,0.76230],[0.09320,0.87211,0.75237],[0.09451,0.87844,0.74265],[0.09662,0.88454,0.73316],[0.09958,0.89040,0.72393],[0.10342,0.89600,0.71500],[0.10815,0.90142,0.70599],[0.11374,0.90673,0.69651],[0.12014,0.91193,0.68660],[0.12733,0.91701,0.67627],[0.13526,0.92197,0.66556],[0.14391,0.92680,0.65448],[0.15323,0.93151,0.64308],[0.16319,0.93609,0.63137],[0.17377,0.94053,0.61938],[0.18491,0.94484,0.60713],[0.19659,0.94901,0.59466],[0.20877,0.95304,0.58199],[0.22142,0.95692,0.56914],[0.23449,0.96065,0.55614],[0.24797,0.96423,0.54303],[0.26180,0.96765,0.52981],[0.27597,0.97092,0.51653],[0.29042,0.97403,0.50321],[0.30513,0.97697,0.48987],[0.32006,0.97974,0.47654],[0.33517,0.98234,0.46325],[0.35043,0.98477,0.45002],[0.36581,0.98702,0.43688],[0.38127,0.98909,0.42386],[0.39678,0.99098,0.41098],[0.41229,0.99268,0.39826],[0.42778,0.99419,0.38575],[0.44321,0.99551,0.37345],[0.45854,0.99663,0.36140],[0.47375,0.99755,0.34963],[0.48879,0.99828,0.33816],[0.50362,0.99879,0.32701],[0.51822,0.99910,0.31622],[0.53255,0.99919,0.30581],[0.54658,0.99907,0.29581],[0.56026,0.99873,0.28623],[0.57357,0.99817,0.27712],[0.58646,0.99739,0.26849],[0.59891,0.99638,0.26038],[0.61088,0.99514,0.25280],[0.62233,0.99366,0.24579],[0.63323,0.99195,0.23937],[0.64362,0.98999,0.23356],[0.65394,0.98775,0.22835],[0.66428,0.98524,0.22370],[0.67462,0.98246,0.21960],[0.68494,0.97941,0.21602],[0.69525,0.97610,0.21294],[0.70553,0.97255,0.21032],[0.71577,0.96875,0.20815],[0.72596,0.96470,0.20640],[0.73610,0.96043,0.20504],[0.74617,0.95593,0.20406],[0.75617,0.95121,0.20343],[0.76608,0.94627,0.20311],[0.77591,0.94113,0.20310],[0.78563,0.93579,0.20336],[0.79524,0.93025,0.20386],[0.80473,0.92452,0.20459],[0.81410,0.91861,0.20552],[0.82333,0.91253,0.20663],[0.83241,0.90627,0.20788],[0.84133,0.89986,0.20926],[0.85010,0.89328,0.21074],[0.85868,0.88655,0.21230],[0.86709,0.87968,0.21391],[0.87530,0.87267,0.21555],[0.88331,0.86553,0.21719],[0.89112,0.85826,0.21880],[0.89870,0.85087,0.22038],[0.90605,0.84337,0.22188],[0.91317,0.83576,0.22328],[0.92004,0.82806,0.22456],[0.92666,0.82025,0.22570],[0.93301,0.81236,0.22667],[0.93909,0.80439,0.22744],[0.94489,0.79634,0.22800],[0.95039,0.78823,0.22831],[0.95560,0.78005,0.22836],[0.96049,0.77181,0.22811],[0.96507,0.76352,0.22754],[0.96931,0.75519,0.22663],[0.97323,0.74682,0.22536],[0.97679,0.73842,0.22369],[0.98000,0.73000,0.22161],[0.98289,0.72140,0.21918],[0.98549,0.71250,0.21650],[0.98781,0.70330,0.21358],[0.98986,0.69382,0.21043],[0.99163,0.68408,0.20706],[0.99314,0.67408,0.20348],[0.99438,0.66386,0.19971],[0.99535,0.65341,0.19577],[0.99607,0.64277,0.19165],[0.99654,0.63193,0.18738],[0.99675,0.62093,0.18297],[0.99672,0.60977,0.17842],[0.99644,0.59846,0.17376],[0.99593,0.58703,0.16899],[0.99517,0.57549,0.16412],[0.99419,0.56386,0.15918],[0.99297,0.55214,0.15417],[0.99153,0.54036,0.14910],[0.98987,0.52854,0.14398],[0.98799,0.51667,0.13883],[0.98590,0.50479,0.13367],[0.98360,0.49291,0.12849],[0.98108,0.48104,0.12332],[0.97837,0.46920,0.11817],[0.97545,0.45740,0.11305],[0.97234,0.44565,0.10797],[0.96904,0.43399,0.10294],[0.96555,0.42241,0.09798],[0.96187,0.41093,0.09310],[0.95801,0.39958,0.08831],[0.95398,0.38836,0.08362],[0.94977,0.37729,0.07905],[0.94538,0.36638,0.07461],[0.94084,0.35566,0.07031],[0.93612,0.34513,0.06616],[0.93125,0.33482,0.06218],[0.92623,0.32473,0.05837],[0.92105,0.31489,0.05475],[0.91572,0.30530,0.05134],[0.91024,0.29599,0.04814],[0.90463,0.28696,0.04516],[0.89888,0.27824,0.04243],[0.89298,0.26981,0.03993],[0.88691,0.26152,0.03753],[0.88066,0.25334,0.03521],[0.87422,0.24526,0.03297],[0.86760,0.23730,0.03082],[0.86079,0.22945,0.02875],[0.85380,0.22170,0.02677],[0.84662,0.21407,0.02487],[0.83926,0.20654,0.02305],[0.83172,0.19912,0.02131],[0.82399,0.19182,0.01966],[0.81608,0.18462,0.01809],[0.80799,0.17753,0.01660],[0.79971,0.17055,0.01520],[0.79125,0.16368,0.01387],[0.78260,0.15693,0.01264],[0.77377,0.15028,0.01148],[0.76476,0.14374,0.01041],[0.75556,0.13731,0.00942],[0.74617,0.13098,0.00851],[0.73661,0.12477,0.00769],[0.72686,0.11867,0.00695],[0.71692,0.11268,0.00629],[0.70680,0.10680,0.00571],[0.69650,0.10102,0.00522],[0.68602,0.09536,0.00481],[0.67535,0.08980,0.00449],[0.66449,0.08436,0.00424],[0.65345,0.07902,0.00408],[0.64223,0.07380,0.00401],[0.63082,0.06868,0.00401],[0.61923,0.06367,0.00410],[0.60746,0.05878,0.00427],[0.59550,0.05399,0.00453],[0.58336,0.04931,0.00486],[0.57103,0.04474,0.00529],[0.55852,0.04028,0.00579],[0.54583,0.03593,0.00638],[0.53295,0.03169,0.00705],[0.51989,0.02756,0.00780],[0.50664,0.02354,0.00863],[0.49321,0.01963,0.00955],[0.47960,0.01583,0.01055]]

// Delaunay Triangulation from: https://github.com/msavela/delaunay/
class Vertex {
  constructor(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }

  // We just use the 2D distance. The z is saved for later use - but it is not used in the triangulation.
  distanceTo(otherVertex) {
    return Math.sqrt((this.x - otherVertex.x) ** 2 + (this.y - otherVertex.y) ** 2)
  }

  equals(vertex) {
    return this.x === vertex.x && this.y == vertex.y
  }
}

class Edge {
  constructor(v0, v1) {
    this.v0 = v0
    this.v1 = v1
  }

  equals(edge) {
    return (this.v0.equals(edge.v0) && this.v1.equals(edge.v1)) ||
      (this.v0.equals(edge.v1) && this.v1.equals(edge.v0))
  }
}

class Triangle {
  constructor(v0, v1, v2) {
    this.v0 = v0
    this.v1 = v1
    this.v2 = v2
    this.calcCircumcircle()
  }

  calcCircumcircle() {
    // Reference: http://www.faqs.org/faqs/graphics/algorithms-faq/
    // Subject 1.04: How do I generate a circle through three points?
    const A = this.v1.x - this.v0.x
    const B = this.v1.y - this.v0.y
    const C = this.v2.x - this.v0.x
    const D = this.v2.y - this.v0.y

    const E = A * (this.v0.x + this.v1.x) + B * (this.v0.y + this.v1.y)
    const F = C * (this.v0.x + this.v2.x) + D * (this.v0.y + this.v2.y)

    const G = 2.0 * (A * (this.v2.y - this.v1.y) - B * (this.v2.x - this.v1.x))

    let dx, dy

    // Collinear points, get extremes and use midpoint as center
    if (Math.round(Math.abs(G)) == 0) {
      const minx = Math.min(this.v0.x, this.v1.x, this.v2.x)
      const miny = Math.min(this.v0.y, this.v1.y, this.v2.y)
      const maxx = Math.max(this.v0.x, this.v1.x, this.v2.x)
      const maxy = Math.max(this.v0.y, this.v1.y, this.v2.y)

      this.center = new Vertex((minx + maxx) / 2, (miny + maxy) / 2, 0)

      dx = this.center.x - minx
      dy = this.center.y - miny
    } else {
      const cx = (D * E - B * F) / G
      const cy = (A * F - C * E) / G

      this.center = new Vertex(cx, cy, 0)

      dx = this.center.x - this.v0.x
      dy = this.center.y - this.v0.y
    }
    this.radius = Math.sqrt(dx * dx + dy * dy)
  }

  inCircumcircle(v) {
    const dx = this.center.x - v.x
    const dy = this.center.y - v.y
    return Math.sqrt(dx * dx + dy * dy) <= this.radius
  }
}

function getSuperTriangle(vertices) {
  let minx = Infinity
  let miny = Infinity

  let maxx = -Infinity
  let maxy = -Infinity
  vertices.forEach(vertex => {
    minx = Math.min(minx, vertex.x)
    miny = Math.min(minx, vertex.y)
    maxx = Math.max(maxx, vertex.x)
    maxy = Math.max(maxx, vertex.y)
  })

  const dx = (maxx - minx) * 10
  const dy = (maxy - miny) * 10

  const v0 = new Vertex(minx - dx, miny - dy * 3, 0)
  const v1 = new Vertex(minx - dx, maxy + dy, 0)
  const v2 = new Vertex(maxx + dx * 3, maxy + dy, 0)

  return new Triangle(v0, v1, v2)
}

function addVertex(vertex, triangles) {
  let edges = []

  // Remove triangles with circumcircles containing the vertex
  triangles = triangles.filter(triangle => {
    if (triangle.inCircumcircle(vertex)) {
      edges.push(new Edge(triangle.v0, triangle.v1))
      edges.push(new Edge(triangle.v1, triangle.v2))
      edges.push(new Edge(triangle.v2, triangle.v0))
      return false
    }
    return true
  })

  // Get unique edges
  edges = uniqueEdges(edges)

  // Create new triangles from the unique edges and new vertex
  edges.forEach(edge => {
    triangles.push(new Triangle(edge.v0, edge.v1, vertex))
  })

  return triangles
}

function uniqueEdges(edges) {
  const uniqueEdges = []
  for (let i = 0; i < edges.length; ++i) {
    let isUnique = true

    // See if edge is unique
    for (let j = 0; j < edges.length; ++j) {
      if (i != j && edges[i].equals(edges[j])) {
        isUnique = false
        break
      }
    }

    // Edge is unique, add to unique edges array
    isUnique && uniqueEdges.push(edges[i])
  }

  return uniqueEdges
}

function bowyerWatson(vertices) {
  // Create bounding 'super' triangle
  let st = getSuperTriangle(vertices)
  // Initialize triangles while adding bounding triangle
  let triangles = [st]

  // Triangulate each vertex
  vertices.forEach(vertex => {
    triangles = addVertex(vertex, triangles)
  })

  // Remove triangles that share edges with super triangle
  triangles = triangles.filter(triangle => {
    return !(triangle.v0 == st.v0 || triangle.v0 == st.v1 || triangle.v0 == st.v2 ||
      triangle.v1 == st.v0 || triangle.v1 == st.v1 || triangle.v1 == st.v2 ||
      triangle.v2 == st.v0 || triangle.v2 == st.v1 || triangle.v2 == st.v2)
  })

  return triangles
}

// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV
const IDENTITY_4X4 = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
])
const EPSILON = 0.000001

class Mat4 extends Float32Array {
  constructor(...values) {
    switch (values.length) {
      case 16:
        super(values)
        break
      default:
        super(IDENTITY_4X4)
        break
    }
  }

  // Creates a new identity 4x4 Matrix.
  static create() {
    return new Mat4()
  }

  scale(v) {
    return Mat4.scale(this, this, v)
  }

  static scale(out, a, v) {
    const x = v[0]
    const y = v[1]

    out[0] = x * a[0]
    out[1] = x * a[1]
    out[2] = x * a[2]

    out[3] = y * a[3]
    out[4] = y * a[4]
    out[5] = y * a[5]

    out[6] = a[6]
    out[7] = a[7]
    out[8] = a[8]
    return out
  }

  multiply(b) {
    return Mat4.multiply(this, this, b)
  }

  static multiply(out, a, b) {
    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]
    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]
    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]
    const a30 = a[12]
    const a31 = a[13]
    const a32 = a[14]
    const a33 = a[15]

    // Cache only the current line of the second matrix
    let b0 = b[0]
    let b1 = b[1]
    let b2 = b[2]
    let b3 = b[3]
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[4]
    b1 = b[5]
    b2 = b[6]
    b3 = b[7]
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[8]
    b1 = b[9]
    b2 = b[10]
    b3 = b[11]
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[12]
    b1 = b[13]
    b2 = b[14]
    b3 = b[15]
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
    return out
  }

  // WebGL/OpenGL compat (z range [-1, 1])
  perspective(fovy, aspect, near, far) {
    return Mat4.perspective(this, fovy, aspect, near, far)
  }

  // WebGL/OpenGL compat (z range [-1, 1])
  static perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2)
    out[0] = f / aspect
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 0
    out[5] = f
    out[6] = 0
    out[7] = 0
    out[8] = 0
    out[9] = 0
    out[11] = -1
    out[12] = 0
    out[13] = 0
    out[15] = 0
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far)
      out[10] = (far + near) * nf
      out[14] = 2 * far * near * nf
    } else {
      out[10] = -1
      out[14] = -2 * near
    }
    return out
  }

  rotate(rad, axis) {
    return Mat4.rotate(this, this, rad, axis)
  }

  static rotate(out, a, rad, axis) {
    let x = axis[0]
    let y = axis[1]
    let z = axis[2]
    let len = Math.sqrt(x * x + y * y + z * z)

    if (len < EPSILON) {
      return null
    }

    len = 1 / len
    x *= len
    y *= len
    z *= len

    const s = Math.sin(rad)
    const c = Math.cos(rad)
    const t = 1 - c

    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]
    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]
    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]

    // Construct the elements of the rotation matrix
    const b00 = x * x * t + c
    const b01 = y * x * t + z * s
    const b02 = z * x * t - y * s
    const b10 = x * y * t - z * s
    const b11 = y * y * t + c
    const b12 = z * y * t + x * s
    const b20 = x * z * t + y * s
    const b21 = y * z * t - x * s
    const b22 = z * z * t + c

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02
    out[1] = a01 * b00 + a11 * b01 + a21 * b02
    out[2] = a02 * b00 + a12 * b01 + a22 * b02
    out[3] = a03 * b00 + a13 * b01 + a23 * b02
    out[4] = a00 * b10 + a10 * b11 + a20 * b12
    out[5] = a01 * b10 + a11 * b11 + a21 * b12
    out[6] = a02 * b10 + a12 * b11 + a22 * b12
    out[7] = a03 * b10 + a13 * b11 + a23 * b12
    out[8] = a00 * b20 + a10 * b21 + a20 * b22
    out[9] = a01 * b20 + a11 * b21 + a21 * b22
    out[10] = a02 * b20 + a12 * b21 + a22 * b22
    out[11] = a03 * b20 + a13 * b21 + a23 * b22

    if (a !== out) {
      // If the source and destination differ, copy the unchanged last row
      out[12] = a[12]
      out[13] = a[13]
      out[14] = a[14]
      out[15] = a[15]
    }
    return out
  }

  translate(v) {
    return Mat4.translate(this, this, v)
  }

  static translate(out, a, v) {
    const x = v[0]
    const y = v[1]
    const z = v[2]

    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12]
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13]
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14]
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15]
    } else {
      const a00 = a[0]
      const a01 = a[1]
      const a02 = a[2]
      const a03 = a[3]
      const a10 = a[4]
      const a11 = a[5]
      const a12 = a[6]
      const a13 = a[7]
      const a20 = a[8]
      const a21 = a[9]
      const a22 = a[10]
      const a23 = a[11]

      out[0] = a00
      out[1] = a01
      out[2] = a02
      out[3] = a03
      out[4] = a10
      out[5] = a11
      out[6] = a12
      out[7] = a13
      out[8] = a20
      out[9] = a21
      out[10] = a22
      out[11] = a23

      out[12] = a00 * x + a10 * y + a20 * z + a[12]
      out[13] = a01 * x + a11 * y + a21 * z + a[13]
      out[14] = a02 * x + a12 * y + a22 * z + a[14]
      out[15] = a03 * x + a13 * y + a23 * z + a[15]
    }

    return out
  }

}
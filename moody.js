const sineOfOneArcsecond = 0.00000484813

function roundTo(n, numDecimalPlaces = 2) {
  const factor = Math.pow(10, numDecimalPlaces)
  return Math.floor(n * factor + 0.5) / factor
}

function roundToSlow(n, numDecimalPlaces) {
  const factor = Math.pow(10, numDecimalPlaces)
  return (Math.floor(n * factor + 0.5) / factor).toFixed(numDecimalPlaces)
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
  plateDiagonalAngle
  xInset
  yInset

  constructor(lineSegment, arcSecondData, reflectorFootSpacingInches, surfacePlateHeightInches, surfacePlateWidthInches, suggestedDiagonalInset) {
    this.lineSegment = lineSegment
    this.autocollimatorReadings = arcSecondData
    this.reflectorFootSpacingInches = reflectorFootSpacingInches
    this.surfacePlateHeightInches = surfacePlateHeightInches
    this.surfacePlateWidthInches = surfacePlateWidthInches
    this.suggestedDiagonalInset = suggestedDiagonalInset
    this.plateDiagonalAngle = Math.atan(this.surfacePlateWidthInches / this.surfacePlateHeightInches)
    this.xInset = this.suggestedDiagonalInset * Math.sin(this.plateDiagonalAngle)
    this.yInset = this.suggestedDiagonalInset * Math.cos(this.plateDiagonalAngle)
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

  // Returns the value of the "middle" station.
  // If the there is no middle (number of readings is even) then return average of
  // the two middle-most entries.
  midStationValue(arr) {
    const n = arr.length
    if (n === 0) return null

    const mid = Math.floor(n / 2)
    return n % 2 === 1 ? arr[mid] : 0.5 * (arr[mid - 1] + arr[mid])
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
    if (this.lineSegment.start == Direction.Northwest) {
      // Top-Starting Diagonal
      // y = -(table_width/table_height) * x + table_height
      // sin(theta) = y / reflector_foot_spacing
      // tan(theta) = y / x
      return this.displacementsFromBaseLineLinear.map((z, i) => {
        const x = this.xInset + (i * Math.sin(this.plateDiagonalAngle) * this.reflectorFootSpacingInches)
        const y = this.surfacePlateHeightInches - this.yInset - (i * Math.cos(this.plateDiagonalAngle) * this.reflectorFootSpacingInches)
        return [x, y, z * zMultiplier]
      })
    } else {
      // Bottom starting diagonal
      // y = (table_width/table_height) * x
      return this.displacementsFromBaseLineLinear.map((z, i) => {
        const x = this.surfacePlateWidthInches - this.xInset - (i * Math.sin(this.plateDiagonalAngle) * this.reflectorFootSpacingInches)
        const y = this.surfacePlateHeightInches - this.yInset - (i * Math.cos(this.plateDiagonalAngle) * this.reflectorFootSpacingInches)
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
    if (this.lineSegment.start == Direction.Northeast && this.lineSegment.end == Direction.Northwest) {
      // North Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches - this.xInset - (i * this.reflectorFootSpacingInches), this.surfacePlateHeightInches - this.yInset, z * zMultiplier])
    } else if (this.lineSegment.start == Direction.Northeast && this.lineSegment.end == Direction.Southeast) {
      // East Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches - this.xInset, this.surfacePlateHeightInches - this.yInset - (i * this.reflectorFootSpacingInches), z * zMultiplier])
    } else if (this.lineSegment.start == Direction.Southeast && this.lineSegment.end == Direction.Southwest) {
      // South Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches - this.xInset - (i * this.reflectorFootSpacingInches), this.yInset, z * zMultiplier])
    } else if (this.lineSegment.start == Direction.Northwest && this.lineSegment.end == Direction.Southwest) {
      // West Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.xInset, this.surfacePlateHeightInches - this.yInset - (i * this.reflectorFootSpacingInches), z * zMultiplier])
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
      console.log("Calling midStationValue on: " + this.displacementsFromDatumPlane)
      console.log(this.midStationValue(this.displacementsFromDatumPlane))
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
    if (this.lineSegment.start == Direction.East) {
      // Horizontal Center Line
      return this.displacementsFromBaseLineLinear.map((z, i) => { return [this.surfacePlateWidthInches - this.xInset - (i * this.reflectorFootSpacingInches), this.surfacePlateHeightInches / 2, z * zMultiplier] })
    } else if (this.lineSegment.start == Direction.North) {
      // Vertical Center Line
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches / 2, this.surfacePlateHeightInches - this.yInset - (i * this.reflectorFootSpacingInches), z * zMultiplier])
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
  static TopStartingDiagonal = new LineSegment(Direction.Northwest, Direction.Southeast, "Top-Starting Diagonal")
  static BottomStartingDiagonal = new LineSegment(Direction.Northeast, Direction.Southwest, "Bottom-Starting Diagonal")
  // The four perimeter lines.
  static NorthPerimeter = new LineSegment(Direction.Northeast, Direction.Northwest, "North Perimeter")
  static EastPerimeter = new LineSegment(Direction.Northeast, Direction.Southeast, "East Perimeter")
  static SouthPerimeter = new LineSegment(Direction.Southeast, Direction.Southwest, "South Perimeter")
  static WestPerimeter = new LineSegment(Direction.Northwest, Direction.Southwest, "West Perimeter")
  // The two center lines.
  static HorizontalCenter = new LineSegment(Direction.East, Direction.West, "Horizontal Center")
  static VerticalCenter = new LineSegment(Direction.North, Direction.South, "Vertical Center")
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
    this.topStartingDiagonalTable = new DiagonalTable(SurfacePlate.TopStartingDiagonal, topStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.bottomStartingDiagonalTable = new DiagonalTable(SurfacePlate.BottomStartingDiagonal, bottomStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.northPerimeterTable = new PerimeterTable(SurfacePlate.NorthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0],
      northPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.eastPerimeterTable = new PerimeterTable(SurfacePlate.EastPerimeter, surfacePlate.suggestedNumberOfVerticalStations,
      this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0],
      eastPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.southPerimeterTable = new PerimeterTable(SurfacePlate.SouthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0],
      southPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.westPerimeterTable = new PerimeterTable(SurfacePlate.WestPerimeter, surfacePlate.suggestedNumberOfVerticalStations,
      this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0],
      westPerimeterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    // TODO: Are we passing the right value for firstValueOfColumn5 for {horizontal/vertical}CenterTable?
    this.horizontalCenterTable = new CenterTable(SurfacePlate.HorizontalCenter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane),
      this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane),
      horizontalCenterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)
    this.verticalCenterTable = new CenterTable(SurfacePlate.VerticalCenter, surfacePlate.suggestedNumberOfVerticalStations,
      this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane),
      this.southPerimeterTable.midStationValue(this.southPerimeterTable.displacementsFromDatumPlane),
      verticalCenterReadings, surfacePlate.reflectorFootSpacingInches, surfacePlate.surfacePlateHeightInches, surfacePlate.surfacePlateWidthInches, surfacePlate.suggestedDiagonalInset)

    // Moody uses the North Perimeter Line as an example; for the other one's, it requires a bit of thinking as to which
    // diagonal line values need to be copied to the other perimeter lines for consistency (with the example).

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

    // Moody uses the Horizontal Center Line as an example; for the other one (Vertical Center Line), it requires a bit of
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

export { getNumberOfStations, MoodyReport, SurfacePlate, roundTo, roundToSlow, Table }

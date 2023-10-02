"use strict";
const sineOfOneArcsecond = 0.00000484813;

function roundTo(n, numDecimalPlaces) {
  const multiplicator = Math.pow(10, numDecimalPlaces);
  n = parseFloat((n * multiplicator).toFixed(11));
  return Math.round(n) / multiplicator;
}

class Unit {
  static Imperial = new Unit("imperial")
  static Metric = new Unit("metric")
}

class Direction {
  static North = new Direction('North');
  static South = new Direction('South');
  static East = new Direction('East');
  static West = new Direction('West');
  static Northeast = new Direction('Northeast');
  static Southeast = new Direction('Southeast');
  static Southwest = new Direction('Southwest');
  static Northwest = new Direction('Northwest');

  constructor(name) {
    this.name = name;
  }

  toString() {
    return `${this.name}`;
  }
}

class LineSegment {
  start;
  end;
  name;

  constructor(start, end, name) {
    this.start = start;
    this.end = end;
    this.name = name;
  }

  displayName() {
    return this.start + " -> " + this.end;
  }
}

class Table {
  // Which of the "Union Jack" lines this table holds data for.
  lineSegment;
  // The number of measurement stations for this table.
  numStations;
  // The autocollimator readings in arc-seconds (Column #2).
  arcSecondData;
  reflectorFootSpacingInches;
  lowestValueInColumn6ForAllTables;
  surfacePlateHeightInches;
  surfacePlateWidthInches;
  surfacePlateDiagonalInches;

  constructor(lineSegment, arcSecondData, reflectorFootSpacingInches) {
    this.lineSegment = lineSegment;
    this.autocollimatorReadings = arcSecondData;
    this.reflectorFootSpacingInches = reflectorFootSpacingInches;
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
      "Column #8: " + this.displacementsFromBaseLineLinear.join(", ") + "\n";
  }

  get stationNumbers() {
    return this.arcSecondData.map((_, i) => i + 1);
  }

  set autocollimatorReadings(data) {
    this.arcSecondData = data;
    // Add the first data point which always defaults to zero (this is part of finding the reference plane).
    this.numStations = this.arcSecondData.unshift(0);
  }

  get autocollimatorReadings() {
    return this.arcSecondData;
  }

  // Angular displacements in arc-seconds (Column #3).
  get angularDisplacements() {
    return this.arcSecondData.map((x, i) => i === 0 ? 0 : roundTo(x - this.arcSecondData[1], 2));
  }

  // Sum of angular displacements in arc-seconds (Column #4).
  get sumOfDisplacements() {
    // Return a new array that contains the partial sums from 0 to index of the angular displacements.
    return this.angularDisplacements.map((_, i, arr) => roundTo(arr.slice(0, i + 1).reduce((x, y) => x + y), 2));
  }

  // Column #5
  // Note that this implementation works for the perimeter and center lines, but is overriden by the diagonal lines as they
  // use a different correction method.
  get cumulativeCorrectionFactors() {
    // Subtract the value opposite the last station in Column #4 from the value opposite the same station in Column #6:
    // Note: The first value of Column #6 and the first value of Column #5 are always the same.
    const difference = this.lastValueOfColumn6 - this.sumOfDisplacements[this.numStations - 1];
    // Subtract this value from that opposite the first station in Column #5 and divide the result by the total number of stations on the line minus one:
    const correctionFactor = (this.firstValueOfColumn5 - difference) / (this.numStations - 1);
    // Beginning at the last station in Column #5, add the correction factor cumulatively up the column at each station:
    // If the last value is wrong we need to check if i = arr.length - 1 and if it is use difference value.
    return this.sumOfDisplacements.map((_, i, arr) => roundTo(difference + ((arr.length - i - 1) * correctionFactor), 2)); 
  }

  // Returns the value of the "middle" station. If the there is no middle (number of readings is odd) then return average of
  // the two middle-most entries.
  midStationValue(arr) {
    if (arr.length % 2 === 0) {
      return arr[((this.numStations - 1) / 2) - 1];
    } else {
      return 0.5 * (arr[(this.numStations - 1) / 2] + arr[(this.numStations + 1) / 2]);
    }
  }

  // Angular displacement from datum plane in arc-seconds (Column #6).
  get displacementsFromDatumPlane() {
    // This is simply column #4 + column #5.
    return this.sumOfDisplacements.map((x, i) => roundTo((x + this.cumulativeCorrectionFactors[i]), 2));
  }

  get lowestValueInColumn6() {
    return Math.min(...this.displacementsFromDatumPlane);
  }

  // Angular displacement from base plane in arc-seconds (Column #7).
  get displacementsFromBaseLine() {
    return this.displacementsFromDatumPlane.map(x => roundTo((x + Math.abs(this.lowestValueInColumn6ForAllTables)), 2));
  }

  // Angular displacement from base plane in inches (same unit as reflector foot spacing) (Column #8).
  get displacementsFromBaseLineLinear() {
    return this.displacementsFromBaseLine.map(x => roundTo((x * sineOfOneArcsecond * this.reflectorFootSpacingInches), 8));
  }
}

class DiagonalTable extends Table {
  constructor(lineSegment, arcSecondData, reflectorFootSpacingInches) {
    super(lineSegment, arcSecondData, reflectorFootSpacingInches);
  }

  // Column #5
  // Get the middle value of Column #4 (or average of two if given an odd number of readings)
  // Reverse sign of this value and copy to Column #5. Then continue in arithmetic progression
  // down to last value (by adding) and up to first value (by subtracting).
  get cumulativeCorrectionFactors() {
    // Instead of starting at the middle and then iterating up and down, we proceed unidirectionally from first index.
    const correctionFactor = -this.sumOfDisplacements[this.numStations - 1] / (this.numStations - 1);
    // We slice the array because we don't want to count the first dummy 0 measurement that gets added.
    return this.sumOfDisplacements.map((_, i, arr) => roundTo((correctionFactor * i +
      (0.5 * this.sumOfDisplacements[this.numStations - 1] - this.midStationValue(this.sumOfDisplacements.slice(1)))), 2));
  }

  // (0,0) origin is bottom left corner of surface plate.
  get vertices() {
    if (this.lineSegment.start == Direction.Northwest) {
      // Top-Starting Diagonal
      // y = -(table_width/table_height) * x  + table_height
      // sin(theta) = y / reflector_foot_spacing
      // tan(theta) = y / x
      const x = i * Math.sin(Math.atan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches;
      const y = this.tableHeightInInches - (i * Math.sqrt(Math.pow(this.reflectorFootSpacingInches, 2) -
        Math.pow(Math.sin(Math.atan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches), 2));
      return this.displacementsFromBaseLineLinear.map((z, i) => [x, y, z]);
    } else {
      // Bottom starting diagonal
      // y = (table_width/table_height) * x
      const x = this.tableWidthInInches - (i *  Math.sin(Math.arctan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches);
      const y = this.tableHeightInInches - (i * Math.sqrt(Math.pow(this.reflectorFootSpacingInches, 2) -
        Math.pow(Math.sin(Math.atan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches), 2));
      return this.displacementsFromBaseLineLinear.map((z, i) => [x, y, z]);
    }
  }
}

class PerimeterTable extends Table {
  suggestedNumStations;
  // First value of Column #5 (copied from associated diagonal table).
  firstValueOfColumn5;
  // Last value of Column #6 (copied from associated diagonal table).
  lastValueOfColumn6;

  constructor(lineSegment, suggestedNumStations, firstValueOfColumn5, lastValueOfColumn6, arcSecondData, reflectorFootSpacingInches) {
    super(lineSegment, arcSecondData, reflectorFootSpacingInches);
    this.suggestedNumStations = suggestedNumStations;
    this.firstValueOfColumn5 = firstValueOfColumn5;
    this.lastValueOfColumn6 = lastValueOfColumn6;
  }

  midStationValue(arr) {
    if (arr.length % 2 === 1) {
      return arr[Math.floor(arr.length / 2)];
    } else {
      return 0.5 * (arr[((arr.length / 2) - 1) / 2] + arr[arr.length / 2]);
    }
  }

  // (0,0) origin is bottom left corner of surface plate.
  get vertices() {
    if (this.lineSegment.start == Direction.Northeast && this.lineSegment.end == Direction.Northwest) {
      // North Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [i * this.reflectorFootSpacingInches, this.surfacePlateHeightInches, z]);
    } else if (this.lineSegment.start == Direction.Northeast && this.lineSegment.end == Direction.Southeast) {
      // East Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches, (this.numStations - i) * this.reflectorFootSpacingInches, z]);
    } else if (this.lineSegment.start == Direction.Southeast && this.lineSegment.end == Direction.Southwest) {
      // West Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [0, (this.numStations - i) * this.reflectorFootSpacingInches, z]);
    } else if (this.lineSegment.start == Direction.Northwest && this.lineSegment.end == Direction.Southwest) {
      // South Perimeter
      return this.displacementsFromBaseLineLinear.map((z, i) => [(this.numStations - i) * this.reflectorFootSpacingInches, 0, z]);
    }
  }
}

class CenterTable extends Table {
  suggestedNumStations;
  // First value of Column #5 (copied from mid-points of associated perimeter lines).
  firstValueOfColumn5;
  // Last value of Column #6 (copied from mid-points of associated perimeter lines).
  lastValueOfColumn6;

  constructor(lineSegment, suggestedNumStations, firstValueOfColumn5, lastValueOfColumn6, arcSecondData, reflectorFootSpacingInches) {
    super(lineSegment, arcSecondData, reflectorFootSpacingInches);
    this.suggestedNumStations = suggestedNumStations;
    this.firstValueOfColumn5 = firstValueOfColumn5;
    this.lastValueOfColumn6 = lastValueOfColumn6;
  }

  midStationValue(arr) {
    if (arr.length % 2 === 1) {
      return arr[Math.floor(arr.length / 2)];
    } else {
      return 0.5 * (arr[((arr.length / 2) - 1) / 2] + arr[arr.length / 2]);
    }
  }

  get errorShiftedOut() {
    // Change the sign of the value opposite the midstation in Column #6 and add it to the value opposite each
    // station in Column #6. Enter the sums in Column #6a.
    // Note: This is only done for the horizontal center line.
    // For the vertical center-line just copy the values from Column #6.
    if (this.lineSegment.start == Direction.East) {
      // Horizontal Center Line
      const toAdd = -this.midStationValue(this.displacementsFromDatumPlane);
      return this.displacementsFromDatumPlane.map(x => roundTo(x + toAdd, 2));
    } else if (this.lineSegment.start == Direction.North) {
      // Vertical Center Line
      return this.displacementsFromDatumPlane;
    }
  }

  get lowestValueInColumn6() {
    // We override this function because for the center tables we need to grab from Column #6a, not #6.
    return Math.min(...this.errorShiftedOut);
  }

  // Column #5
  // Get the middle value of Column #4 (or average of two if given an odd number of readings)
  // Reverse sign of this value and copy to Column #5. Then continue in arithmetic progression
  // down to last value (by adding) and up to first value (by subtracting).
  get cumulativeCorrectionFactors() {
    const difference = this.lastValueOfColumn6 - this.sumOfDisplacements[this.numStations - 1];
    const correctionFactor = (this.firstValueOfColumn5 - difference) / (this.numStations - 1);
    // Beginning at the last station in Column #5, add the correction factor cumulatively up the column at each station:
    // If the last value is wrong we need to check if i = arr.length - 1 and if it is use difference value.
    return this.sumOfDisplacements.map((_, i, arr) => roundTo(difference + ((arr.length - i - 1) * correctionFactor), 2)); 
  }

  // Angular displacement from base plane in arc-seconds (Column #7).
  get displacementsFromBaseLine() {
    return this.errorShiftedOut.map(x => roundTo((x + Math.abs(this.lowestValueInColumn6ForAllTables)), 2));
  }

  // (0,0) origin is bottom left corner of surface plate.
  get vertices() {
    if (this.lineSegment.start == Direction.East) {
      // Horizontal Center Line
      return this.displacementsFromBaseLineLinear.map((z, i) => [(this.numStations - i) * this.reflectorFootSpacingInches, this.surfacePlateHeightInches / 2, z]);
    } else if (this.lineSegment.start == Direction.North) {
      // Vertical Center Line
      return this.displacementsFromBaseLineLinear.map((z, i) => [this.surfacePlateWidthInches / 2, (this.numStations - i) * this.reflectorFootSpacingInches, z]);
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
      "Column #8: " + this.displacementsFromBaseLineLinear.join(", ") + "\n";
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
    this.surfacePlateHeightInches = surfacePlateHeightInches;
    this.surfacePlateWidthInches = surfacePlateWidthInches;
    this.reflectorFootSpacingInches = reflectorFootSpacingInches;
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
    this.suggestedDiagonalInset = ((this.surfacePlateDiagonalInches % reflectorFootSpacingInches) / 2) + (reflectorFootSpacingInches / 2);
    this.suggestedNumberOfDiagonalStations = (this.surfacePlateDiagonalInches - (2 * this.suggestedDiagonalInset)) / reflectorFootSpacingInches;
    this.suggestedNumberOfHorizontalStations = (surfacePlateWidthInches - (2 * reflectorFootSpacingInches)) / reflectorFootSpacingInches;
    this.suggestedNumberOfVerticalStations = (surfacePlateHeightInches - (2 * reflectorFootSpacingInches)) / reflectorFootSpacingInches;
  }
}

class MoodyReport {
  topStartingDiagonalTable;
  bottomStartingDiagonalTable;
  northPerimeterTable;
  eastPerimeterTable;
  southPerimeterTable;
  westPerimeterTable;
  horizontalCenterTable;
  verticalCenterTable;

  constructor(surfacePlate, topStartingDiagonalReadings, bottomStartingDiagonalReadings, northPerimeterReadings, eastPerimeterReadings,
    southPerimeterReadings, westPerimeterReadings, horizontalCenterReadings, verticalCenterReadings) {
    this.topStartingDiagonalTable = new DiagonalTable(surfacePlate.TopStartingDiagonal, topStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches);
    this.bottomStartingDiagonalTable = new DiagonalTable(surfacePlate.BottomStartingDiagonal, bottomStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches);
    this.northPerimeterTable = new PerimeterTable(surfacePlate.NorthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0],
      northPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    this.eastPerimeterTable = new PerimeterTable(surfacePlate.EastPerimeter, surfacePlate.suggestedNumberOfVerticalStations,
      this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0],
      eastPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    this.southPerimeterTable = new PerimeterTable(surfacePlate.SouthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0],
      southPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    this.westPerimeterTable = new PerimeterTable(surfacePlate.WestPerimeter, surfacePlate.suggestedNumberOfVerticalStations,
      this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0],
      westPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    // TODO: Are we passing the right value for firstValueOfColumn5 for {horizontal/vertical}CenterTable?
    this.horizontalCenterTable = new CenterTable(surfacePlate.HorizontalCenter, surfacePlate.suggestedNumberOfHorizontalStations,
      this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane),
      this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane),
      horizontalCenterReadings, surfacePlate.reflectorFootSpacingInches);
    this.verticalCenterTable = new CenterTable(surfacePlate.VerticalCenter, surfacePlate.suggestedNumberOfVerticalStations,
      this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane),
      this.southPerimeterTable.midStationValue(this.southPerimeterTable.displacementsFromDatumPlane),
      verticalCenterReadings, surfacePlate.reflectorFootSpacingInches);

    // Moody uses North Perimeter Line as the example, for the other one's it requires a bit of thinking as to which
    // diagonal line values need to be copied to the other perimeter lines for consistency.

    // Copy value in Column #6 of NE end of NE-SW diagonal in to Columns #5 and #6 for perimeter lines.
    this.northPerimeterTable.cumulativeCorrectionFactors.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.northPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0]);
    // Copy value in Column #6 of NW end of NW-SE diagonal in to Column #6 (only) for perimeter lines.
    this.northPerimeterTable.displacementsFromDatumPlane.push(this.bottomStartingDiagonalTable.displacementsFromDatumPlane.at(-1))

    // Do the same (consistent) thing for the other cardinal tables:
    this.southPerimeterTable.cumulativeCorrectionFactors.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.southPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.southPerimeterTable.displacementsFromDatumPlane.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane.at(-1));

    this.eastPerimeterTable.cumulativeCorrectionFactors.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.eastPerimeterTable.displacementsFromDatumPlane.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.eastPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane.at(-1));

    this.westPerimeterTable.cumulativeCorrectionFactors.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.westPerimeterTable.displacementsFromDatumPlane.unshift(this.topStartingDiagonalTable.displacementsFromDatumPlane[0]);
    this.westPerimeterTable.displacementsFromDatumPlane.unshift(this.bottomStartingDiagonalTable.displacementsFromDatumPlane.at(-1));

    // Moody uses the Horizontal Center Line as the example, for the other one (Vertical Center Line), it requires a bit of
    // thinking as to which perimeter line values need to be copied to the other center line for consistency.

    // Enter the value for the midpoint of the east perimeter line opposite the first station in Columns #5 and #6.
    console.log("Midpoint value of east perimeter: " + this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane));
    console.log("Midpoint value of west perimeter: " + this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane));
    this.horizontalCenterTable.cumulativeCorrectionFactors.unshift(this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane));
    this.horizontalCenterTable.displacementsFromDatumPlane.unshift(this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane));
    // Enter the value for the midpoint of the west perimeter line opposite the last station in Column #6 (only).
    this.horizontalCenterTable.displacementsFromDatumPlane.push(this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane));

    // Do the same (consistent) thing for vertical center line:
    this.verticalCenterTable.cumulativeCorrectionFactors.unshift(this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane));
    this.verticalCenterTable.displacementsFromDatumPlane.unshift(this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane));
    this.verticalCenterTable.displacementsFromDatumPlane.push(this.southPerimeterTable.midStationValue(this.southPerimeterTable.displacementsFromDatumPlane));

    // Find the lowest value in Column #6 across all tables:
    const tables = [this.topStartingDiagonalTable, this.bottomStartingDiagonalTable, this.northPerimeterTable,
      this.eastPerimeterTable, this.southPerimeterTable, this.westPerimeterTable, this.horizontalCenterTable, this.verticalCenterTable]
    const lowestValueInColumn6 = Math.min(...tables.map(table => table.lowestValueInColumn6))
    tables.forEach(table => table.lowestValueInColumn6ForAllTables = lowestValueInColumn6)
  }

  printDebug() {
    return this.topStartingDiagonalTable.printDebug() + 
     this.bottomStartingDiagonalTable.printDebug() + 
     this.northPerimeterTable.printDebug() + 
     this.southPerimeterTable.printDebug() + 
     this.eastPerimeterTable.printDebug() + 
     this.westPerimeterTable.printDebug() + 
     this.horizontalCenterTable.printDebug() + 
     this.verticalCenterTable.printDebug();
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
console.log(moodyReport.printDebug());
*/

const lines = [ "topStartingDiagonal", "bottomStartingDiagonal", "northPerimeter", "eastPerimeter", "southPerimeter",
  "westPerimeter", "horizontalCenter", "verticalCenter"]
window.addEventListener('DOMContentLoaded', event => {
  // FIXME: This is just for testing - so we don't have to type in the values each time.
  document.getElementById("plateHeight").value = moodySurfacePlateHeightInches
  document.getElementById("plateWidth").value = moodySurfacePlateWidthInches
  document.getElementById("reflectorFootSpacing").value = moodyReflectorFootSpacingInches

  document.getElementById('fillTestData').addEventListener("click", event => {
    lines.forEach((line, lineIndex) => {
      moodyData[lineIndex].forEach((tableEntry, index) => {
          document.getElementById(line + "Table" + (index + 1)).value = tableEntry
      });
    });
  });

  document.getElementById("createTables").addEventListener("click", event => {
    createTables()
  });
});

// Creates the tables for each line (along with its' own table graphic) and adds to the DOM.
function createTables() {
  const surfacePlate = new SurfacePlate(document.getElementById("plateHeight").value,
    document.getElementById("plateWidth").value, document.getElementById("reflectorFootSpacing").value)
  document.getElementById('plateDiagonal').value = surfacePlate.surfacePlateDiagonalInches
  document.getElementById('diagonalInset').value = surfacePlate.suggestedDiagonalInset
  document.getElementById('numHorizontalStations').value = surfacePlate.suggestedNumberOfHorizontalStations
  document.getElementById('numVerticalStations').value = surfacePlate.suggestedNumberOfVerticalStations
  document.getElementById('numDiagonalStations').value = surfacePlate.suggestedNumberOfDiagonalStations

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
  });

  // Now that the rows have been created, set the first input for autocollimator readings to 0 and readonly.
  lines.forEach(line => {
    document.getElementById(line + "Table0").value = "0"
    document.getElementById(line + "Table0").readOnly = true
  });
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

      // console.log(moodyReport.printDebug());
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
      });
    }
  }
}

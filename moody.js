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
    return this.sumOfDisplacements.map((_, i, arr) => roundTo((correctionFactor * i + (0.5 * this.sumOfDisplacements[this.numStations - 1] - this.midStationValue(this.sumOfDisplacements.slice(1)))), 2)); 
  }

  // (0,0) origin is bottom left corner of surface plate.
  get vertices() {
    if (this.lineSegment.start == Direction.Northwest) {
      // Top-Starting Diagonal
      // y = -(table_width/table_height) * x  + table_height
      // sin(theta) = y / reflector_foot_spacing
      // tan(theta) = y / x
      const x = i * Math.sin(Math.atan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches;
      const y = this.tableHeightInInches - (i * Math.sqrt(Math.pow(this.reflectorFootSpacingInches, 2) - Math.pow(Math.sin(Math.atan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches), 2));
      return this.displacementsFromBaseLineLinear.map((z, i) => [x, y, z]);
    } else {
      // Bottom starting diagonal
      // y = (table_width/table_height) * x
      const x = this.tableWidthInInches - (i *  Math.sin(Math.arctan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches);
      const y = this.tableHeightInInches - (i * Math.sqrt(Math.pow(this.reflectorFootSpacingInches, 2) - Math.pow(Math.sin(Math.atan(this.tableWidthInInches / this.tableHeightInInches)) * this.reflectorFootSpacingInches), 2));
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
  HorizontalCenterLine = new LineSegment(Direction.East, Direction.West, "Horizontal Center Line")
  VerticalCenterLine = new LineSegment(Direction.North, Direction.South, "Vertical Center Line")
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

  constructor(surfacePlate, topStartingDiagonalReadings, bottomStartingDiagonalReadings, northPerimeterReadings, eastPerimeterReadings, southPerimeterReadings, westPerimeterReadings, horizontalCenterReadings, verticalCenterReadings) {
    this.topStartingDiagonalTable = new DiagonalTable(surfacePlate.TopStartingDiagonal, topStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches);
    this.bottomStartingDiagonalTable = new DiagonalTable(surfacePlate.BottomStartingDiagonal, bottomStartingDiagonalReadings, surfacePlate.reflectorFootSpacingInches);
    this.northPerimeterTable = new PerimeterTable(surfacePlate.NorthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations, this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0], northPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    this.eastPerimeterTable = new PerimeterTable(surfacePlate.EastPerimeter, surfacePlate.suggestedNumberOfVerticalStations, this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], this.topStartingDiagonalTable.displacementsFromDatumPlane[0], eastPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    this.southPerimeterTable = new PerimeterTable(surfacePlate.SouthPerimeter, surfacePlate.suggestedNumberOfHorizontalStations, this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], southPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    this.westPerimeterTable = new PerimeterTable(surfacePlate.WestPerimeter, surfacePlate.suggestedNumberOfVerticalStations, this.topStartingDiagonalTable.displacementsFromDatumPlane[0], this.bottomStartingDiagonalTable.displacementsFromDatumPlane[0], westPerimeterReadings, surfacePlate.reflectorFootSpacingInches);
    // TODO: Are we passing the right value for firstValueOfColumn5 for {horizontal/vertical}CenterTable?
    this.horizontalCenterTable = new CenterTable(surfacePlate.HorizontalCenterLine, surfacePlate.suggestedNumberOfHorizontalStations, this.eastPerimeterTable.midStationValue(this.eastPerimeterTable.displacementsFromDatumPlane), this.westPerimeterTable.midStationValue(this.westPerimeterTable.displacementsFromDatumPlane), horizontalCenterReadings, surfacePlate.reflectorFootSpacingInches);
    this.verticalCenterTable = new CenterTable(surfacePlate.VerticalCenterLine, surfacePlate.suggestedNumberOfVerticalStations, this.northPerimeterTable.midStationValue(this.northPerimeterTable.displacementsFromDatumPlane), this.southPerimeterTable.midStationValue(this.southPerimeterTable.displacementsFromDatumPlane), verticalCenterReadings, surfacePlate.reflectorFootSpacingInches);

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
    const tables = [this.topStartingDiagonalTable, this.bottomStartingDiagonalTable, this.northPerimeterTable, this.eastPerimeterTable, this.southPerimeterTable, this.westPerimeterTable, this.horizontalCenterTable, this.verticalCenterTable]
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
const surfacePlateHeightInches = 48
const surfacePlateWidthInches = 72
const reflectorFootSpacingInches = 4
// TODO: Use a unit pair to specify reflector foot spacing and surface plate width/height and remove naming *Inches

const surfacePlate = new SurfacePlate(48, 72, reflectorFootSpacingInches)
const moodyData =  [
  [6.5, 6.0, 5.0, 5.2, 5.5, 5.6, 5.5, 5.0, 5.5, 4.8, 5.0, 5.2, 5.3, 4.9, 4.6, 4.2, 5.3, 4.9, 4.5, 3.5], // topStartingDiagonal
  [6.6, 5.4, 5.4, 5.2, 5.5, 5.7, 5.0, 5.0, 5.4, 4.5, 4.4, 4.5, 4.5, 4.8, 4.2, 4.2, 4.2, 4.8, 4.3, 3.2], // bottomStartingDiagonal
  [20.5, 19.7, 20.5, 20.3, 20.2, 19.9, 19.0, 19.5, 18.8, 18.6, 18.7, 18.6, 18.4, 18.5, 19.0, 17.9],     // northPerimeter
  [3.5, 2.1, 2.5, 2.8, 3.4, 3.2, 3.5, 4.0, 4.2, 3.5],                                                   // eastPerimeter
  [16.4, 15, 15.6, 15.5, 15.1, 15.3, 15.1, 14.6, 14, 13.5, 13.5, 13.3, 13.3, 13.4, 14, 13.9],           // southPerimeter
  [6, 4.6, 4.5, 4.7, 5.0, 4.5, 5.9, 6, 6, 4.9],                                                         // westPerimeter
  [11.7, 12.4, 12.1, 12.5, 12.0, 11.5, 11.5, 11.3, 11.3, 10.3, 10.8, 10.3, 10, 10.7, 10.4, 10.4],       // horizontalCenter
  [6.6, 6.4, 6.3, 6.5, 6.6, 6.9, 7.5, 7.4, 7.1, 7]]                                                     // verticalCenter
const moodyReport = new MoodyReport(surfacePlate, ...moodyData)

console.log(moodyReport.printDebug());

const lines = [ "topStartingDiagonal", "bottomStartingDiagonal", "northPerimeter", "eastPerimeter", "southPerimeter", "westPerimeter", "horizontalCenterLine", "verticalCenterLine"]
window.addEventListener('DOMContentLoaded', event => {

  document.getElementById('fillTestData').addEventListener("click", event => {
    lines.forEach((line, lineIndex) => {
      moodyData[lineIndex].forEach((tableEntry, index) => {
        if (index !== 0) {
          document.getElementById(line + "Table" + index).value = tableEntry
        }
      });
    });
  });

  document.getElementById("createTables").addEventListener("click", event => {
    document.getElementById("plateHeight").value = surfacePlateHeightInches
    document.getElementById("plateWidth").value = surfacePlateWidthInches
    document.getElementById("reflectorFootSpacing").value = reflectorFootSpacingInches
    document.getElementById('tableGraphic').style.visibility = "visible"
    const surfacePlatePercentHeight = 100 * (surfacePlateHeightInches / (surfacePlateWidthInches + surfacePlateHeightInches))
    const surfacePlatePercentWidth = 100 * (surfacePlateWidthInches / (surfacePlateWidthInches + surfacePlateHeightInches))
    document.getElementById('tableGraphic').setAttribute("viewBox", "0 0 " + surfacePlatePercentWidth + " " + surfacePlatePercentHeight)
    // document.getElementById('tableGraphic').setAttribute("height", surfacePlatePercentHeight);
    document.getElementById('tableGraphic').setAttribute("width", "30%")
    document.getElementById('outsideRect').setAttribute("width", surfacePlatePercentWidth)
    document.getElementById('outsideRect').setAttribute("height", surfacePlatePercentHeight)
    const surfacePlate2 = new SurfacePlate(document.getElementById("plateHeight").value,
      document.getElementById("plateWidth").value,
      document.getElementById("reflectorFootSpacing").value)
      const plateDiagonalAngle = Math.atan(surfacePlateWidthInches / surfacePlateHeightInches)
      const xInset = surfacePlate2.suggestedDiagonalInset * Math.sin(plateDiagonalAngle)
      const yInset = surfacePlate2.suggestedDiagonalInset * Math.cos(plateDiagonalAngle)
      document.getElementById('insideRect').setAttribute("x", xInset)
      document.getElementById('insideRect').setAttribute("y", yInset)
      document.getElementById('insideRect').setAttribute("width", surfacePlatePercentWidth - (2 * xInset))
      document.getElementById('insideRect').setAttribute("height", surfacePlatePercentHeight - (2 * yInset))

      document.getElementById('topStartingDiagonalLine').setAttribute("x1", xInset)
      document.getElementById('topStartingDiagonalLine').setAttribute("y1", yInset)
      document.getElementById('topStartingDiagonalLine').setAttribute("x2", surfacePlatePercentWidth - xInset)
      document.getElementById('topStartingDiagonalLine').setAttribute("y2", surfacePlatePercentHeight - yInset)

      document.getElementById('bottomStartingDiagonalLine').setAttribute("x1", xInset)
      document.getElementById('bottomStartingDiagonalLine').setAttribute("y1", surfacePlatePercentHeight - yInset)
      document.getElementById('bottomStartingDiagonalLine').setAttribute("x2", surfacePlatePercentWidth - xInset)
      document.getElementById('bottomStartingDiagonalLine').setAttribute("y2", yInset)

      document.getElementById('northPerimeterLine').setAttribute("x1", xInset)
      document.getElementById('northPerimeterLine').setAttribute("y1", yInset)
      document.getElementById('northPerimeterLine').setAttribute("x2", surfacePlatePercentWidth - xInset)
      document.getElementById('northPerimeterLine').setAttribute("y2", yInset)

      document.getElementById('eastPerimeterLine').setAttribute("x1", surfacePlatePercentWidth - xInset)
      document.getElementById('eastPerimeterLine').setAttribute("y1", yInset)
      document.getElementById('eastPerimeterLine').setAttribute("x2", surfacePlatePercentWidth - xInset)
      document.getElementById('eastPerimeterLine').setAttribute("y2", surfacePlatePercentHeight - yInset)

      document.getElementById('southPerimeterLine').setAttribute("x1", surfacePlatePercentWidth - xInset)
      document.getElementById('southPerimeterLine').setAttribute("y1", surfacePlatePercentHeight - yInset)
      document.getElementById('southPerimeterLine').setAttribute("x2", xInset)
      document.getElementById('southPerimeterLine').setAttribute("y2", surfacePlatePercentHeight - yInset)

      document.getElementById('westPerimeterLine').setAttribute("x1", xInset)
      document.getElementById('westPerimeterLine').setAttribute("y1", surfacePlatePercentHeight - yInset)
      document.getElementById('westPerimeterLine').setAttribute("x2", xInset)
      document.getElementById('westPerimeterLine').setAttribute("y2", yInset)

      document.getElementById('horizontalCenterLine').setAttribute("x1", surfacePlatePercentWidth - xInset)
      document.getElementById('horizontalCenterLine').setAttribute("y1", surfacePlatePercentHeight / 2)
      document.getElementById('horizontalCenterLine').setAttribute("x2", xInset)
      document.getElementById('horizontalCenterLine').setAttribute("y2", surfacePlatePercentHeight / 2)

      document.getElementById('verticalCenterLine').setAttribute("x1", surfacePlatePercentWidth / 2)
      document.getElementById('verticalCenterLine').setAttribute("y1", yInset)
      document.getElementById('verticalCenterLine').setAttribute("x2", surfacePlatePercentWidth / 2)
      document.getElementById('verticalCenterLine').setAttribute("y2", surfacePlatePercentHeight - yInset)

      document.getElementById('plateDiagonal').value = surfacePlate2.surfacePlateDiagonalInches
      document.getElementById('diagonalInset').value = surfacePlate2.suggestedDiagonalInset
      document.getElementById('numHorizontalStations').value = surfacePlate2.suggestedNumberOfHorizontalStations
      document.getElementById('numVerticalStations').value = surfacePlate2.suggestedNumberOfVerticalStations
      document.getElementById('numDiagonalStations').value = surfacePlate2.suggestedNumberOfDiagonalStations
      lines.forEach(line => {
        const linePropertyName = line[0].toUpperCase() + line.slice(1)
        document.getElementById(line + "Table").createCaption().textContent = surfacePlate2[linePropertyName].name + " (" + surfacePlate2[linePropertyName].displayName() + ")"
        // Delete all non-header rows from table.
        document.getElementById(line + "Table").getElementsByTagName("tbody")[0].innerHTML = document.getElementById(line + "Table").rows[0].innerHTML
        let numberOfStations
        if (line.endsWith('Diagonal')) {
          numberOfStations = surfacePlate2.suggestedNumberOfDiagonalStations
        } else if (line.startsWith('north') || line.startsWith('south') || line.startsWith('horizontal')) {
          numberOfStations = surfacePlate2.suggestedNumberOfHorizontalStations
        } else {
          numberOfStations = surfacePlate2.suggestedNumberOfVerticalStations
        }
        for (let i = 0; i <= numberOfStations; i++) {
          const row = document.getElementById(line + "Table").insertRow()
          row.insertCell().textContent = i + 1
          const readingInput = document.createElement("input")
          readingInput.id = line + "Table" + i
          row.insertCell().appendChild(readingInput)
        }
        document.getElementById(line + "Table").style.visibility = "visible";
      });
    lines.forEach((line, lineIndex) => {
      document.getElementById(line + "Table0").value = "0"
      document.getElementById(line + "Table0").readOnly = true
    });
  });
});

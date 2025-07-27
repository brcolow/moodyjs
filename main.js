import { interpolate, turboColormapData } from "./colormap.js"
import { bowyerWatson, Triangle, Vertex } from "./delaunay.js"
import { Mat4, Quat, Vector3 } from "./math.js"
import { getNumberOfStations, MoodyReport, SurfacePlate, roundTo, roundToSlow } from "./moody.js"
import WebGLDebugUtils from "./webgl-debug.js"

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
const moodyData = [
  [6.5, 6.0, 5.0, 5.2, 5.5, 5.6, 5.5, 5.0, 5.5, 4.8, 5.0, 5.2, 5.3, 4.9, 4.6, 4.2, 5.3, 4.9, 4.5, 3.5], // topStartingDiagonal
  [6.6, 5.4, 5.4, 5.2, 5.5, 5.7, 5.0, 5.0, 5.4, 4.5, 4.4, 4.5, 4.5, 4.8, 4.2, 4.2, 4.2, 4.8, 4.3, 3.2], // bottomStartingDiagonal
  [20.5, 19.7, 20.5, 20.3, 20.2, 19.9, 19.0, 19.5, 18.8, 18.6, 18.7, 18.6, 18.4, 18.5, 19.0, 17.9],     // northPerimeter
  [3.5, 2.1, 2.5, 2.8, 3.4, 3.2, 3.5, 4.0, 4.2, 3.5],                                                   // eastPerimeter
  [16.4, 15, 15.6, 15.5, 15.1, 15.3, 15.1, 14.6, 14, 13.5, 13.5, 13.3, 13.3, 13.4, 14, 13.9],           // southPerimeter
  [6, 4.6, 4.5, 4.7, 5.0, 4.5, 5.9, 6, 6, 4.9],                                                         // westPerimeter
  [11.7, 12.4, 12.1, 12.5, 12.0, 11.5, 11.5, 11.3, 11.3, 10.3, 10.8, 10.3, 10, 10.7, 10.4, 10.4],       // horizontalCenter
  [6.6, 6.4, 6.3, 6.5, 6.6, 6.9, 7.5, 7.4, 7.1, 7]]                                                     // verticalCenter

const lines = ["topStartingDiagonal", "bottomStartingDiagonal", "northPerimeter", "eastPerimeter", "southPerimeter",
  "westPerimeter", "horizontalCenter", "verticalCenter"]

window.addEventListener('DOMContentLoaded', () => {
  // FIXME: This is just for testing - so we don't have to type in the values each time.
  document.getElementById("plateHeight").value = moodySurfacePlateHeightInches
  document.getElementById("plateWidth").value = moodySurfacePlateWidthInches
  document.getElementById("reflectorFootSpacing").value = moodyReflectorFootSpacingInches

  zMultiplier = document.querySelector("#zMultiplier").value
  document.getElementById('fillTestData').addEventListener("click", () => {
    lines.forEach((line, lineIndex) => {
      moodyData[lineIndex].forEach((tableEntry, index) => {
        document.getElementById(line + "Table" + (index + 1)).value = tableEntry
      })
    })
    // Trigger table refresh.
    document.getElementsByClassName("readingInput")[0].dispatchEvent(new Event('input', { bubbles: true }))
  })

  document.getElementById('fillZeroData').addEventListener("click", () => {
    lines.forEach((line, lineIndex) => {
      moodyData[lineIndex].forEach((tableEntry, index) => {
        document.getElementById(line + "Table" + (index + 1)).value = 0.0
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
  const plateDiagonalFull = Math.sqrt(((surfacePlate.surfacePlateHeightInches * surfacePlate.surfacePlateHeightInches) +
    (surfacePlate.surfacePlateWidthInches * surfacePlate.surfacePlateWidthInches)))
  const gradeAAFlatnessReq = .04 * (plateDiagonalFull * plateDiagonalFull) + 40
  // Convert microinches to micrometers (microns)
  const microinchesToMicrons = .0254
  document.getElementById('gradeAAInches').value = roundToSlow(gradeAAFlatnessReq, 2)
  document.getElementById('gradeAInches').value = roundToSlow(gradeAAFlatnessReq * 2, 2)
  document.getElementById('gradeBInches').value = roundToSlow(gradeAAFlatnessReq * 4, 2)
  document.getElementById('gradeAAMetric').value = roundToSlow(gradeAAFlatnessReq * microinchesToMicrons, 2)
  document.getElementById('gradeAMetric').value = roundToSlow(gradeAAFlatnessReq * 2 * microinchesToMicrons, 2)
  document.getElementById('gradeBMetric').value = roundToSlow(gradeAAFlatnessReq * 4 * microinchesToMicrons, 2)
  const plateDiagonalFullMicrometers = plateDiagonalFull * 25.4
  const micronsToMicroInches = 39.37
  const isoGrade0FlatnessReq = 0.003 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 2.5
  document.getElementById('grade0Inches').value = roundToSlow(isoGrade0FlatnessReq * micronsToMicroInches, 2) // Convert from micrometers to microinches
  const isoGrade1FlatnessReq = 0.006 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 5
  document.getElementById('grade1Inches').value = roundToSlow(isoGrade1FlatnessReq * micronsToMicroInches, 2) // Convert from micrometers to microinches
  const isoGrade2FlatnessReq = 0.012 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 10
  document.getElementById('grade2Inches').value = roundToSlow(isoGrade2FlatnessReq * micronsToMicroInches, 2) // Convert from micrometers to microinches
  const isoGrade3FlatnessReq = 0.024 * (Math.ceil(plateDiagonalFullMicrometers / 100) * 100) + 20
  document.getElementById('grade3Inches').value = roundToSlow(isoGrade3FlatnessReq * micronsToMicroInches, 2) // Convert from micrometers to microinches
  document.getElementById('grade0Metric').value = roundToSlow(isoGrade0FlatnessReq, 2)
  document.getElementById('grade1Metric').value = roundToSlow(isoGrade1FlatnessReq, 2)
  document.getElementById('grade2Metric').value = roundToSlow(isoGrade2FlatnessReq, 2)
  document.getElementById('grade3Metric').value = roundToSlow(isoGrade3FlatnessReq, 2)

  const flatnessInputs = [document.getElementById('gradeAAInches'), document.getElementById('gradeAInches'), document.getElementById('gradeBInches'),
  document.getElementById('gradeAAMetric'), document.getElementById('gradeAMetric'), document.getElementById('gradeBMetric'),
  document.getElementById('grade0Inches'), document.getElementById('grade1Inches'), document.getElementById('grade2Inches'), document.getElementById('grade3Inches'),
  document.getElementById('grade0Metric'), document.getElementById('grade1Metric'), document.getElementById('grade2Metric'), document.getElementById('grade3Metric')]
  const inchMultiplier = 1 // No multiplier for inches
  const metricMultiplier = 25.4 // Convert inches to micrometers (you can adjust the unit if needed)
  document.getElementById("overallFlatnessInch").addEventListener("input", event => {
    for (const flatnessInput of flatnessInputs) {
      const isMetric = flatnessInput.id.endsWith('Metric')
      const multiplier = isMetric ? metricMultiplier : inchMultiplier // Use appropriate multiplier
      if (Number(event.target.value) <= Number(flatnessInput.value) * multiplier) {
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
      SurfacePlate[linePropertyName].name + " (" + SurfacePlate[linePropertyName].displayName() + ")"
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
      readingInput.addEventListener("input", () => {
        refreshTables(lines, surfacePlate)
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

// Creates the main SVG table graphic (with multi-colored lines) and adds it to the DOM.
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

  // TODO: Later we will probably wire this up to open the tab corresponding to the clicked on line.
  document.getElementById('topStartingDiagonalLineGroup').addEventListener('click', event => {
    const selectedLine = (() => {
      switch (event.originalTarget.tagName) {
        case 'textPath':
          return event.originalTarget.parentElement.parentElement.id.slice(0, -5)
        case 'path':
          return event.originalTarget.id
      }
    })();
  })
}

// Recalculates the values by creating a new MoodyReport and updates the table cell values accordingly.
function refreshTables(lines, surfacePlate) {
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
      document.getElementById("overallFlatnessInch").value = roundTo(overallFlatness, 2)
      document.getElementById("overallFlatnessInch").dispatchEvent(new Event('input', { 'bubbles': true }))
      document.getElementById("overallFlatnessMetric").value = roundTo(overallFlatness * 0.0254, 2)
      document.getElementById("overallFlatnessMetric").dispatchEvent(new Event('input', { 'bubbles': true }))

      initialize3DTableGraphic(moodyReport)
      document.getElementById("canvasContainer").style.display = "block"
      document.getElementById("controls").style.display = "block"

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

const keyMap = []
const boundingBoxCache = []
let startVectorMapped = null
let cumulativeZoomFactor = 1
let zMultiplier = -1
let tableVAO = null
let showLines = true
let showHeatmap = true
let lightingOn = true
let savedTableRotation = Mat4.create()
let tableRotationMatrix = Mat4.create()
let tableScaleMatrix = Mat4.create()
let tableTranslateMatrix = Mat4.create()
let tableModelMatrix = Mat4.create()
// The viewMatrix is calculated once when initializing the 3D table surface - it does not change between frames.
let viewMatrix = Mat4.create()
// The projectionMatrix is set on initialization of the 3D table surface and also when the canvas is resized.
let projectionMatrix = Mat4.create()

/**
 * Converts a canvas-relative position (mouse coordinates) to clip space coordinates 
 * normalized by the maximum dimension of the canvas's bounding rectangle.
 *
 * Clip space coordinates range from -1 to 1, with the origin at the center. 
 * This method uses uniform scaling based on the largest dimension (width or height) 
 * of the canvas's bounding rectangle (thus making it aspect ratio independent).
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to use as the reference.
 * @param {number} mouseX - The x-coordinate of the mouse position relative to the canvas.
 * @param {number} mouseY - The y-coordinate of the mouse position relative to the canvas.
 * @returns {number[]} A 2D array containing the x and y coordinates in clip space.
 */
function toUniformClipSpace(canvas, mouseX, mouseY) {
  const res = Math.max(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height) - 1
  return [
    (2 * (mouseX - canvas.getBoundingClientRect().x) - canvas.getBoundingClientRect().width - 1) / res,
    (2 * (mouseY - canvas.getBoundingClientRect().y) - canvas.getBoundingClientRect().height - 1) / res
  ]
}

/**
 * Converts a canvas-relative position (mouse coordinates) to clip space coordinates 
 * normalized by the intrinsic dimensions of the canvas element.
 *
 * Clip space coordinates range from -1 to 1, with the origin at the center. 
 * This method scales the position using the canvas's intrinsic width and height.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to use as the reference.
 * @param {number} mouseX - The x-coordinate of the mouse position relative to the canvas.
 * @param {number} mouseY - The y-coordinate of the mouse position relative to the canvas.
 * @returns {number[]} A 2D array containing the x and y coordinates in clip space.
 */
function toCanvasClipSpace(canvas, mouseX, mouseY) {
  const rect = canvas.getBoundingClientRect()
  const cssX = mouseX - rect.left
  const cssY = mouseY - rect.top

  const normalizedX = cssX / rect.width
  const normalizedY = cssY / rect.height

  return [normalizedX * 2 - 1, normalizedY * -2 + 1]
}

function mapToSphere(mouseX, mouseY, canvas) {
  const xy = toUniformClipSpace(canvas, mouseX, mouseY)
  const x = xy[0]
  const y = xy[1]
  const lengthSquared = x * x + y * y

  const radius = 3

  // Map to sphere when x^2 + y^2 <= r^2 / 2 - otherwise map to the hyperbolic function f(x,y) = (r^2 / 2) / sqrt(x^2 + y^2).
  if (2 * lengthSquared <= radius * radius) {
    return new Vector3(x, y, Math.sqrt((radius * radius) - lengthSquared))
  } else {
    return new Vector3(x, y, ((radius * radius) / 2) / Math.sqrt(lengthSquared))
  }
}

function getBoundingBox(moodyReport) {
  const vertices = moodyReport.vertices(zMultiplier).map(vertex => new Vertex(vertex[0], vertex[1], vertex[2])).flat(1)
  const minX = Math.min(...vertices.map(vertex => vertex.x))
  const maxX = Math.max(...vertices.map(vertex => vertex.x))
  const minY = Math.min(...vertices.map(vertex => vertex.y))
  const maxY = Math.max(...vertices.map(vertex => vertex.y))
  const minZ = Math.min(...vertices.map(vertex => vertex.z))
  const maxZ = Math.max(...vertices.map(vertex => vertex.z))
  return { "minX": minX, "maxX": maxX, "minY": minY, "maxY": maxY, "minZ": minZ, "maxZ": maxZ }
}

function initialize3DTableGraphic(moodyReport) {
  const canvas = document.getElementById("glcanvas")
  const gl = canvas.getContext("webgl2")
  // const gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))
  if (gl === null) {
    showWebGLFailedError()
    return
  }
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  document.querySelector("#zMultiplier").addEventListener("input", event => {
    zMultiplier = event.target.value
    if (!(zMultiplier in boundingBoxCache)) {
      boundingBoxCache[zMultiplier] = getBoundingBox(moodyReport)
    }
    createAndBindTableVAO(moodyReport, gl, programInfo)
  })

  document.getElementById("showLines").addEventListener("change", event => showLines = event.target.checked)
  document.getElementById("showHeatmap").addEventListener("change", event => showHeatmap = event.target.checked)
  document.getElementById("lightingOn").addEventListener("change", event => lightingOn = event.target.checked)
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource)

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "vertexPosition"),
      vertexNormal: gl.getAttribLocation(shaderProgram, "vertexNormal"),
      vertexColor: gl.getAttribLocation(shaderProgram, "vertexColor"),
      textureCoord: gl.getAttribLocation(shaderProgram, "vertexTextureCoord"),
      vertexType: gl.getAttribLocation(shaderProgram, "vertexType"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "projectionMatrix"),
      modelMatrix: gl.getUniformLocation(shaderProgram, "modelMatrix"),
      viewMatrix: gl.getUniformLocation(shaderProgram, "viewMatrix"),
      normalMatrix: gl.getUniformLocation(shaderProgram, "normalMatrix"),
      lightPos: gl.getUniformLocation(shaderProgram, "lightPos"),
      lightPower: gl.getUniformLocation(shaderProgram, "lightPower"),
      sampler: gl.getUniformLocation(shaderProgram, "sampler"),
      showLines: gl.getUniformLocation(shaderProgram, "showLines"),
      showHeatmap: gl.getUniformLocation(shaderProgram, "showHeatmap"),
      lightingOn: gl.getUniformLocation(shaderProgram, "lightingOn"),
    },
  }
  const buffers = createAndBindTableVAO(moodyReport, gl, programInfo)

  const fieldOfView = (45 * Math.PI) / 180 // radians
  const aspect = canvas.width / canvas.height
  const zNear = 0.1
  const zFar = 1000.0
  projectionMatrix.perspective(fieldOfView, aspect, zNear, zFar)

  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect
      const canvas = document.getElementById("glcanvas")
      let sizeChanged = false
      if (width > document.getElementById("canvasContainer").style.minWidth) {
        canvas.width = width
        sizeChanged = true
      }
      if (height > document.getElementById("canvasContainer").style.minHeight) {
        canvas.height = height
        sizeChanged = true
      }

      if (sizeChanged) {
        const fieldOfView = (45 * Math.PI) / 180 // radians
        const aspect = canvas.width / canvas.height
        const zNear = 0.1
        const zFar = 1000.0
        projectionMatrix.perspective(fieldOfView, aspect, zNear, zFar)
      }
    }
  })

  resizeObserver.observe(document.getElementById("canvasContainer"))

  canvas.onmousedown = event => {
    startVectorMapped = mapToSphere(event.clientX, event.clientY, canvas)
  }

  document.onmouseup = () => {
    startVectorMapped = null
    savedTableRotation = tableRotationMatrix
  }

  document.onmousemove = event => {
    // http://hjemmesider.diku.dk/~kash/papers/DSAGM2002_henriksen.pdf
    // https://graphicsinterface.org/wp-content/uploads/gi1992-18.pdf

    if (startVectorMapped) {
      // Map mouse displacement onto virtual hemi-sphere/hyperbola.
      const currentVectorMapped = mapToSphere(event.clientX, event.clientY, canvas)

      // Determine rotation axis.
      const axis = Vector3.clone(startVectorMapped).cross(currentVectorMapped)
      let rotationQuat = Quat.identity()

      if (axis.magnitude > 0.000001) {
        // FIXME: The strange order of this may be related to how toMatrix4 is currently not producing correct values.
        // See tests/quat.spec.js toMatrix4 tests.
        rotationQuat = new Quat(Vector3.clone(startVectorMapped).dot(currentVectorMapped), axis[0], -axis[1], 0)
      }

      tableRotationMatrix = Mat4.create()
      tableRotationMatrix.multiply(savedTableRotation)
      // We want rotation to be centered on the center of the table.
      tableRotationMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2,
      (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2,
      (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      tableRotationMatrix.multiply(rotationQuat.toMatrix4())
      tableRotationMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2),
      -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2),
      -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }
  }

  canvas.onwheel = event => {
    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    const zoomFactor = 1 + direction * 0.1
    if (direction === 1 && cumulativeZoomFactor > 10) {
      return
    }
    if (direction === -1 && cumulativeZoomFactor < 0.16) {
      return
    }

    if (event.ctrlKey) {
      // Do center-based zoom.
      viewMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2,
      (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2,
      (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      viewMatrix.scale([zoomFactor, zoomFactor, zoomFactor])
      viewMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2),
      -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2),
      -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
      return
    }

    // Do mouse position based zoom.

    // Implementation: Figure out the 3D coordinates of the table surface (if it intersects) from ray coming from mouse cursor
    // before zoom and map that to (x, y, z) coordinate. Then, apply the zoom transform to it and see how much it will translate
    // that point (where the mouse cursor is) by (which should be the only unmoved point). Then translate the entire table by
    // that amount which should keep the point under the cursor unchanged.

    // Starting from clip space (i.e. normalized device coordinates) of the mouse position go to
    // the world position by multiplying by the inverse of P*V*M matrices which is M-1 * V-1 * P-1.
    let mouseLocationClipSpace = toCanvasClipSpace(canvas, event.clientX, event.clientY)
    // The mouse ray will start at zNear plane (-1 in NDC coords) and end at the zFar plane (1 in NDC coords).
    let rayStartClipSpace = new Vector3(mouseLocationClipSpace[0], mouseLocationClipSpace[1], -1)
    let rayEndClipSpace = new Vector3(mouseLocationClipSpace[0], mouseLocationClipSpace[1], 1)

    let rayStart = Vector3.create()
    let rayEnd = Vector3.create()
    // TODO: Not sure if we want modelMatrix to be part of the inverse transform for this...since we are trying to go to "world space".
    let inverseTransform = Mat4.clone(tableModelMatrix).invert().multiply(Mat4.clone(viewMatrix).invert()).multiply(Mat4.clone(projectionMatrix).invert())
    // let inverseTransform = Mat4.clone(viewMatrix).invert().multiply(Mat4.clone(projectionMatrix).invert())

    rayStart = Vector3.transformMat4(rayStart, rayStartClipSpace, inverseTransform)
    rayEnd = Vector3.transformMat4(rayEnd, rayEndClipSpace, inverseTransform)

    let intersection = {}
    // Now that we have the ray, check to see which (if any) triangles of the table surface it intersects (and where on that triangle).
    // TODO: We may also want to support mouse position zooming when the cursor is off the table, and we could do that by testing intersection
    // with the plane z = boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2.
    for (let i = 0; i < buffers.triangleVertices.length; i += 9) {
      let v0 = new Vector3(buffers.triangleVertices[i], buffers.triangleVertices[i + 1], buffers.triangleVertices[i + 2])
      let v1 = new Vector3(buffers.triangleVertices[i + 3], buffers.triangleVertices[i + 4], buffers.triangleVertices[i + 5])
      let v2 = new Vector3(buffers.triangleVertices[i + 6], buffers.triangleVertices[i + 7], buffers.triangleVertices[i + 8])
      let result = rayTriangleIntersect(rayStart, rayEnd, v0, v1, v2)
      if (result != null) {
        intersection = { triangleIndex: i / 9, triangle: [v0, v1, v2], intersectionPoint: result.intersectionPoint }
        break
      }
    }

    if (Object.keys(intersection).length !== 0) {
      // We are on top of the table surface so we can indeed zoom in.
      cumulativeZoomFactor *= zoomFactor

      // See how much our point of intersection would move if we applied the zoom scaling to that point.
      let scale = Mat4.create()
      scale = scale.scale([zoomFactor, zoomFactor, zoomFactor])
      const intersectionPointAfterZoom = Vector3.clone(intersection.intersectionPoint).transformMat4(scale)
      const difference = intersectionPointAfterZoom.sub(intersection.intersectionPoint)
      // Move the whole table by how much the point of intersection moved so that point stays in place.
      // TODO: Figure out if we want to also translate the z-axis value.
      viewMatrix.translate([-difference[0], -difference[1], 0])
      viewMatrix.scale([zoomFactor, zoomFactor, zoomFactor])
    }
  }

  function showWebGLFailedError() {
    console.log("Unable to initialize WebGL. Your browser or machine may not support it.")
    const ctx = canvas.getContext("2d")

    ctx.font = "30px Arial"
    ctx.fillStyle = "red"
    ctx.textAlign = "center"
    ctx.fillText("Unable to initialize WebGL!", canvas.width / 2, canvas.height / 2)

    const helpText = "Click here for help"
    const fontSize = 16
    const textY = canvas.height / 2 + 20

    ctx.font = `${fontSize}px Arial`
    ctx.fillStyle = "blue"
    ctx.textAlign = "center"
    ctx.fillText(helpText, canvas.width / 2, textY)

    const textMetrics = ctx.measureText(helpText)
    const textWidth = textMetrics.width
    const textX = canvas.width / 2 - textWidth / 2

    // Draw underline
    ctx.beginPath()
    ctx.moveTo(textX, textY + 5)
    ctx.lineTo(textX + textWidth, textY + 5)
    ctx.strokeStyle = "blue"
    ctx.lineWidth = 1
    ctx.stroke()

    // Bounding box for the "link" area
    const linkArea = {
      x: textX,
      y: textY - fontSize,
      width: textWidth,
      height: fontSize + 10
    }

    // Click handler to emulate a link
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const linkTop = textY - fontSize // rough top of text
      const linkBottom = textY + 8 // bottom edge of underline
      const linkLeft = textX
      const linkRight = textX + textWidth

      if (mouseX >= linkArea.x &&
        mouseX <= linkArea.x + linkArea.width &&
        mouseY >= linkArea.y &&
        mouseY <= linkArea.y + linkArea.height) {
        window.open(
          "https://superuser.com/questions/836832/how-do-i-enable-webgl-in-my-browser",
          "_blank"
        )
      }

      // Cursor change on hover
      canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        if (mouseX >= linkArea.x &&
          mouseX <= linkArea.x + linkArea.width &&
          mouseY >= linkArea.y &&
          mouseY <= linkArea.y + linkArea.height) {
          canvas.style.cursor = "pointer"
        } else {
          canvas.style.cursor = "default"
        }
      })
    })
  }

  // Uses the Möller–Trumbore intersection algorithm to see if the given ray (made up of starting Vector3 rayStart
  // and ending Vector3 rayEnd) intersects the given triangle (made up of vertices v0, v1, and v2) and if so, where.
  function rayTriangleIntersect(rayStart, rayEnd, v0, v1, v2) {
    const direction = Vector3.clone(rayEnd).sub(rayStart).norm()
    const edge1 = Vector3.clone(v1).sub(v0)
    const edge2 = Vector3.clone(v2).sub(v0)

    const pVec = Vector3.clone(direction).cross(edge2)
    // If determinant is near zero, ray lies in plane of triangle
    const det = Vector3.clone(edge1).dot(pVec)
    if (det > -0.000001 && det < 0.000001) {
      return null
    }
    const invDet = 1.0 / det

    // Calculate distance from vertex to ray origin
    const tVec = Vector3.clone(rayStart).sub(v0)

    const u = Vector3.clone(tVec).dot(pVec) * invDet
    if (u < 0.0 || u > 1.0) {
      return null
    }

    const qVec = Vector3.clone(tVec).cross(edge1)
    const v = Vector3.clone(direction).dot(qVec) * invDet
    if (v < 0.0 || u + v > 1.0) {
      return null
    }

    const t = Vector3.clone(edge2).dot(qVec) * invDet
    // Check if the intersection point is within the ray's bounds
    const rayLength = Vector3.clone(rayStart).sub(rayEnd).magnitude
    if (t < 0 || t > rayLength) {
      return null // Intersection is behind the ray origin or beyond the ray's end
    }

    return {
      t: t,
      u: u,
      v: v,
      intersectionPoint: Vector3.clone(rayStart).add(Vector3.clone(direction).scale(t)),
    }
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
      translateMatrix.translate([0.0, 0.0, 1.0])
    }
    if (keyMap['s'] === true) {
      translateMatrix.translate([0.0, 0.0, -1.0])
    }
    if (keyMap['a'] === true) {
      translateMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2,
      (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2,
      (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      translateMatrix.rotate(0.01, [0.0, 0.0, -1.0])
      translateMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2),
      -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2),
      -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }
    if (keyMap['d'] === true) {
      translateMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2,
      (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2,
      (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      translateMatrix.rotate(0.01, [0.0, 0.0, 1.0])
      translateMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2),
      -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2),
      -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }

    tableTranslateMatrix.multiply(translateMatrix)

    if (keyMap['r'] === true) {
      viewMatrix = Mat4.create()
      tableRotationMatrix = Mat4.create()
      tableScaleMatrix = Mat4.create()
      tableTranslateMatrix = Mat4.create()
      savedTableRotation = Mat4.create()
      viewMatrix.translate([-(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2,
      -(boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2,
      -(boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) * 8])
    }
  }

  const texture = loadTexture(gl, "granite_2048x2048_compressed.png")
  // Flip image pixels into the bottom-to-top order that WebGL expects.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  function render(now) {
    updateFps(now)

    drawTableSurface(moodyReport, gl, programInfo, buffers, texture)
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

  function updateFps(now) {
    now *= 0.001
    const deltaTime = now - then
    then = now
    const fps = 1 / deltaTime
    fpsElem.textContent = fps.toFixed(1)

    totalFPS += fps - (frameTimes[frameCursor] || 0)
    frameTimes[frameCursor++] = fps
    numFrames = Math.max(numFrames, frameCursor)
    frameCursor %= maxFrames
    const averageFPS = totalFPS / numFrames
    avgElem.textContent = averageFPS.toFixed(1)
  }

  let then = 0
  const frameTimes = []
  let frameCursor = 0
  let numFrames = 0
  const maxFrames = 20
  let totalFPS = 0
  const fpsElem = document.querySelector("#fps")
  const avgElem = document.querySelector("#avg")

  boundingBoxCache[zMultiplier] = getBoundingBox(moodyReport)

  viewMatrix.translate([-(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2,
  -(boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2,
  -(boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) * 8])
  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

function createAndBindTableVAO(moodyReport, gl, programInfo) {
  tableVAO = gl.createVertexArray()
  gl.bindVertexArray(tableVAO)
  const buffers = getBuffers(gl, moodyReport, zMultiplier)
  setPositionAttribute(gl, buffers, programInfo)
  setNormalAttribute(gl, buffers, programInfo)
  setColorAttribute(gl, buffers, programInfo)
  setTextureAttribute(gl, buffers, programInfo)
  setTypeAttribute(gl, buffers, programInfo)
  return buffers
}

// Creates a 3D surface of the linear plate heights (calculated as Column #8 of the line tables).
function drawTableSurface(moodyReport, gl, programInfo, buffers, texture) {
  // We must set the model matrix to identity here because we are using relative (incremental) transforms.
  // We need to make it so that all of our event handlers only mess with currentTransformMatrix, and then that
  // will be applied to the model matrix.
  tableModelMatrix = Mat4.create()
  tableModelMatrix.multiply(tableScaleMatrix)
  tableModelMatrix.multiply(tableTranslateMatrix)
  tableModelMatrix.multiply(tableRotationMatrix)
  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.clearDepth(1.0)
  gl.enable(gl.DEPTH_TEST)
  gl.depthFunc(gl.LEQUAL)

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  const canvas = document.getElementById("glcanvas")

  gl.viewport(0, 0, canvas.width, canvas.height)

  gl.bindVertexArray(tableVAO)
  gl.useProgram(programInfo.program)

  const normalMatrix = Mat4.create()
  Mat4.invert(normalMatrix, Mat4.multiply(normalMatrix, viewMatrix, tableModelMatrix))
  normalMatrix.transpose()

  const lightPos = [document.getElementById("lightPosX").value, document.getElementById("lightPosY").value, document.getElementById("lightPosZ").value]
  const lightPower = document.getElementById("lightPower").value

  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix)
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, tableModelMatrix)
  gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix)
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix)
  gl.uniform3fv(programInfo.uniformLocations.lightPos, lightPos)
  gl.uniform1f(programInfo.uniformLocations.lightPower, lightPower)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(programInfo.uniformLocations.sampler, 0)
  gl.uniform1i(programInfo.uniformLocations.showLines, showLines)
  gl.uniform1i(programInfo.uniformLocations.showHeatmap, showHeatmap)
  gl.uniform1i(programInfo.uniformLocations.lightingOn, lightingOn)

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

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  offset += vertexCount / 3
  vertexCount = buffers.tableThicknessVertices.length
  gl.drawArrays(gl.TRIANGLES, offset, vertexCount)

  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

const vsSource = `#version 300 es
in vec4 vertexPosition;
in vec3 vertexNormal;
in vec4 vertexColor;
in vec2 vertexTextureCoord;
in float vertexType;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
out lowp vec4 color;
out highp vec2 textureCoord;
out highp vec3 normalInterp;
out highp vec3 vertPos;
out highp float vVertexType;

void main() {
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
  color = vertexColor;
  textureCoord = vertexTextureCoord;
  vVertexType = vertexType;

  normalInterp = vec3(normalMatrix * vec4(vertexNormal, 0.0));
  vec4 vertPos4 = viewMatrix * modelMatrix * vertexPosition;
  vertPos = vec3(vertPos4) / vertPos4.w;
}
`

const fsSource = `#version 300 es
precision mediump float;
in lowp vec4 color;
in vec3 normalInterp;
in vec3 vertPos;
in highp vec2 textureCoord;
in highp float vVertexType;
const highp vec3 lightColor = vec3(1.0, 1.0, 1.0);
const highp vec3 ambientColor = vec3(0.4, 0.4, 0.4);
const highp vec3 diffuseColor = vec3(0.2, 0.2, 0.2);
const highp vec3 specColor = vec3(1.0, 1.0, 1.0);
const highp float shininess = 8.0;
const highp float screenGamma = 2.2; // Assume the monitor is calibrated to the sRGB color space
uniform vec3 lightPos;
uniform float lightPower;
uniform sampler2D sampler;
uniform bool showLines;
uniform bool showHeatmap;
uniform bool lightingOn;
out vec4 outputColor;

void main() {
  if (vVertexType == 0.0) {
    // This vertex belongs to one of the Union jack Moody lines.
    if (showLines) {
      outputColor = color;
    } else {
      discard;
    }
  } else {
    // This vertex belongs to the table mesh.
    vec3 normal = normalize(normalInterp);
    vec3 lightDir = lightPos - vertPos;
    float distance = length(lightDir);

    distance = distance * distance;
    lightDir = normalize(lightDir);

    float lambertian = max(dot(lightDir, normal), 0.0);
    float specular = 0.0;

    if (lambertian > 0.0) {
      vec3 viewDir = normalize(-vertPos);
      vec3 halfDir = normalize(lightDir + viewDir);
      float specAngle = max(dot(halfDir, normal), 0.0);
      specular = pow(specAngle, shininess);
    }

    vec3 colorLinear = ambientColor +
                        (diffuseColor * lambertian * lightColor * lightPower / distance) +
                        (specColor * specular * lightColor * lightPower / distance);
    // apply gamma correction (assume ambientColor, diffuseColor and specColor
    // have been linearized, i.e. have no gamma correction in them)
    vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0 / screenGamma));
    if (showHeatmap) {
      if (lightingOn) {
        outputColor = vec4(color.rgb * colorGammaCorrected, color.a);
      } else {
        outputColor = color;
      }
    } else {
      // No heatmap - use the granite texture.
      if (lightingOn) {
        outputColor = texture(sampler, textureCoord) * vec4(colorGammaCorrected, 1.0);
      } else {
        outputColor = texture(sampler, textureCoord);
      }
    }
  }
}
`

function getBuffers(gl, moodyReport, zMultiplier) {
  const buffers = getNonColorBuffers(gl, moodyReport, zMultiplier)
  const lineColorBuffer = getColorBuffer(gl, moodyReport, buffers.triangleVertices, buffers.tableThicknessVertices)

  const areEqual = (x, y, z, w, v) => x === y && y === z && z === w && w === v
  console.assert(areEqual(buffers.positions.length / 3, buffers.normals.length / 3, buffers.textureCoordinates.length / 2, buffers.types.length, lineColorBuffer.colors.length / 4),
    `All buffers must be of the same size (per vertex) but were not. Position buffer: ${buffers.positions.length / 3},
    Normal buffer: ${buffers.normals.length / 3}, Texture buffer: ${buffers.textureCoordinates.length / 2}, Type buffer: ${buffers.types.length},
    Color buffer: ${lineColorBuffer.colors.length / 4}`)

  return {
    positionBuffer: buffers.positionBuffer,
    normalBuffer: buffers.normalBuffer,
    triangleVertices: buffers.triangleVertices,
    textureBuffer: buffers.textureBuffer,
    typeBuffer: buffers.typeBuffer,
    lineColors: lineColorBuffer.colorBuffer,
    tableThicknessVertices: buffers.tableThicknessVertices
  }
}

function getNonColorBuffers(gl, moodyReport, zMultiplier) {
  const tableSurfaceVertices = moodyReport.vertices(zMultiplier).map(vertex => new Vertex(vertex[0], vertex[1], vertex[2]))
  const triangulation = bowyerWatson(tableSurfaceVertices.flat(1))
  const triangulatedVertices = triangulation.map(triangle => [
    [triangle.v0.x, triangle.v0.y, triangle.v0.z],
    [triangle.v1.x, triangle.v1.y, triangle.v1.z],
    [triangle.v2.x, triangle.v2.y, triangle.v2.z]]).flat(1)

  if (!(zMultiplier in boundingBoxCache)) {
    boundingBoxCache[zMultiplier] = getBoundingBox(moodyReport)
  }
  const topEdgeVertices = tableSurfaceVertices.filter(v => v.y === boundingBoxCache[zMultiplier].maxY).filter((v, index, arr) => arr.findIndex(other => other.x === v.x) === index).sort((v0, v1) => v0.x - v1.x)
  const rightEdgeVertices = tableSurfaceVertices.filter(v => v.x === boundingBoxCache[zMultiplier].maxX).filter((v, index, arr) => arr.findIndex(other => other.y === v.y) === index).sort((v0, v1) => v0.y - v1.y)
  const bottomEdgeVertices = tableSurfaceVertices.filter(v => v.y === boundingBoxCache[zMultiplier].minY).filter((v, index, arr) => arr.findIndex(other => other.x === v.x) === index).sort((v0, v1) => v0.x - v1.x)
  const leftEdgeVertices = tableSurfaceVertices.filter(v => v.x === boundingBoxCache[zMultiplier].minX).filter((v, index, arr) => arr.findIndex(other => other.y === v.y) === index).sort((v0, v1) => v0.y - v1.y)

  const minX = Math.min(...moodyReport.vertices(zMultiplier).map(vertex => vertex[0]))
  const maxX = Math.max(...moodyReport.vertices(zMultiplier).map(vertex => vertex[0]))
  const minY = Math.min(...moodyReport.vertices(zMultiplier).map(vertex => vertex[1]))
  const maxY = Math.max(...moodyReport.vertices(zMultiplier).map(vertex => vertex[1]))

  // We should be able to get rid of this once we fix the Moody lines being cut off.
  bottomEdgeVertices.unshift(new Vertex(minX, minY, bottomEdgeVertices[0].z))
  leftEdgeVertices.unshift(new Vertex(minX, minY, leftEdgeVertices[0].z))

  const surfacePlateWidth = boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX
  const surfacePlateHeight = boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY
  const surfacePlateThickness = surfacePlateWidth / 14
  const surfacePlateBottomDepth = boundingBoxCache[zMultiplier].minZ - surfacePlateThickness

  const tableCorners = {
    "northWest": moodyReport.topStartingDiagonalTable.vertices(zMultiplier)[0].flat(1),
    "northEast": moodyReport.bottomStartingDiagonalTable.vertices(zMultiplier)[0].flat(1),
    "southEast": moodyReport.topStartingDiagonalTable.vertices(zMultiplier)[moodyReport.topStartingDiagonalTable.vertices().length - 1].flat(1),
    "southWest": moodyReport.bottomStartingDiagonalTable.vertices(zMultiplier)[moodyReport.bottomStartingDiagonalTable.vertices().length - 1].flat(1)
  }

  const tableThicknessVertices = []
  const sides = [topEdgeVertices, rightEdgeVertices, leftEdgeVertices, bottomEdgeVertices]

  sides.forEach(side => {
    for (let i = 0; i < side.length - 1; i++) {
      let v = side[i]
      tableThicknessVertices.push([v.x, v.y, v.z],
        [v.x, v.y, surfacePlateBottomDepth],
        [side[i + 1].x, side[i + 1].y, side[i + 1].z],
        [side[i + 1].x, side[i + 1].y, side[i + 1].z],
        [side[i + 1].x, side[i + 1].y, surfacePlateBottomDepth],
        [v.x, v.y, surfacePlateBottomDepth])
    }
  })
  const tableBottomVertices = [
    [maxX, minY, surfacePlateBottomDepth],
    [minX, minY, surfacePlateBottomDepth],
    [minX, maxY, surfacePlateBottomDepth],
    [maxX, minY, surfacePlateBottomDepth],
    [maxX, maxY, surfacePlateBottomDepth],
    [minX, maxY, surfacePlateBottomDepth]
  ]
  tableBottomVertices.forEach(v => tableThicknessVertices.unshift(v))

  // FIXME: We want the Union jack lines to always be on top of the surface but it can dip underneath it at extreme points. Why though?
  const positions = new Float32Array(
    moodyReport.vertices(zMultiplier).map(v => [v[0], v[1], v[2] + 0.1]).flat(1) // "Union jack" colored lines.
      .concat(triangulatedVertices.flat(1))                                      // Table surface.
      .concat(tableThicknessVertices.flat(1))                                    // Sides/bottom of table.
  )

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  // Calculate and create normal buffer.
  const lineNormals = moodyReport.vertices(zMultiplier).map(() => [0.0, 0.0, 0.0]).flat(1)
  // Each triangle has 3 vertices with the same surface normal.
  const tableSurfaceNormals = triangulation.map(triangle => {
    const length = triangle.surfaceNormal().magnitude
    return [
      triangle.surfaceNormal().x / length, triangle.surfaceNormal().y / length, triangle.surfaceNormal().z / length,
      triangle.surfaceNormal().x / length, triangle.surfaceNormal().y / length, triangle.surfaceNormal().z / length,
      triangle.surfaceNormal().x / length, triangle.surfaceNormal().y / length, triangle.surfaceNormal().z / length
    ]
  }).flat(1)
  const tableThicknessNormals = []
  for (let i = 0; i < tableThicknessVertices.flat(1).length; i += 9) {
    const v0Arr = tableThicknessVertices.flat(1).slice(i, i + 3)
    const v1Arr = tableThicknessVertices.flat(1).slice(i + 3, i + 6)
    const v2Arr = tableThicknessVertices.flat(1).slice(i + 6, i + 9)
    const v0 = new Vertex(v0Arr[0], v0Arr[1], v0Arr[2])
    const v1 = new Vertex(v1Arr[0], v1Arr[1], v1Arr[2])
    const v2 = new Vertex(v2Arr[0], v2Arr[1], v2Arr[2])
    // FIXME: Instead of this nonsense we could change the order that we add the vertices for the table sides.
    let tri
    if (i / 9 % 2 === 0) {
      tri = new Triangle(v1, v0, v2)
    } else {
      tri = new Triangle(v0, v1, v2)
    }
    const length = tri.surfaceNormal().magnitude
    tableThicknessNormals.push(
      tri.surfaceNormal().x / length, tri.surfaceNormal().y / length, tri.surfaceNormal().z / length,
      tri.surfaceNormal().x / length, tri.surfaceNormal().y / length, tri.surfaceNormal().z / length,
      tri.surfaceNormal().x / length, tri.surfaceNormal().y / length, tri.surfaceNormal().z / length,
    )
  }

  const normals = new Float32Array(lineNormals.concat(tableSurfaceNormals).concat(tableThicknessNormals))
  const normalBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW)

  // Calculate and create texture buffer.
  const lineTextureCoords = moodyReport.vertices(zMultiplier).map(() => [0.0, 1.0]).flat(1)
  const tableSurfaceRatio = (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX)
  //  Map [minX, maxX] => [0, 1] and [minY, maxY] => [0, 1]
  // (val - A) * (b - a) / (B - A) + a
  const numRepeatsX = 1
  const numRepeatsY = numRepeatsX * tableSurfaceRatio

  const triangleTextureCoords = triangulation.map((triangle) => [
    ((triangle.v0.x - boundingBoxCache[zMultiplier].minX) * numRepeatsX) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX),
    ((triangle.v0.y - boundingBoxCache[zMultiplier].minY) * numRepeatsY) / (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY),
    ((triangle.v1.x - boundingBoxCache[zMultiplier].minX) * numRepeatsX) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX),
    ((triangle.v1.y - boundingBoxCache[zMultiplier].minY) * numRepeatsY) / (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY),
    ((triangle.v2.x - boundingBoxCache[zMultiplier].minX) * numRepeatsX) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX),
    ((triangle.v2.y - boundingBoxCache[zMultiplier].minY) * numRepeatsY) / (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY),
  ]).flat(1)

  const textureCoordinates = new Float32Array(lineTextureCoords.concat(triangleTextureCoords).concat(new Array((tableThicknessVertices.flat(1).length / 3) * 2).fill(0.0)))
  const textureBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, textureCoordinates, gl.STATIC_DRAW)

  const types = new Float32Array(
    moodyReport.vertices(zMultiplier).map(() => [0.0]).flat(1)                       // "Union jack" colored lines have type "0.0"
      .concat(triangulation.map(() => [1.0, 1.0, 1.0]).flat(1))                      // Table surface vertices have type "1.0"
      .concat(new Array(tableThicknessVertices.flat(1).length / 3).fill(1.0)))       // Table sides/bottom have type "1.0"

  const typeBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, typeBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, types, gl.STATIC_DRAW)

  return {
    positionBuffer: positionBuffer, positions: positions, normalBuffer: normalBuffer, normals: normals,
    textureBuffer: textureBuffer, textureCoordinates: textureCoordinates, typeBuffer: typeBuffer, types: types,
    triangleVertices: triangulatedVertices.flat(1),
    tableThicknessVertices: tableThicknessVertices
  }
}

function getColorBuffer(gl, moodyReport, triangleVertices, tableThicknessVertices) {
  const triangleZValues = triangleVertices.filter((v, i) => (i + 1) % 3 == 0)
  const minZ = Math.min(...triangleZValues)
  const maxZ = Math.max(...triangleZValues)
  // In case all values are the same minZ = maxZ (i.e. it is a totally flat plate with zero deviation) so we must avoid division by zero - just set all values to 0.0.
  const normalizedTriangleZValues = minZ === maxZ ? triangleZValues.map(() => 0.0) : triangleZValues.map(value => (value - minZ) / (maxZ - minZ))
  const colorMappedZValues = normalizedTriangleZValues.map(value => interpolate(turboColormapData, value))
  const colors = new Array(moodyReport.topStartingDiagonalTable.numStations).fill([0.9568627450980393, 0.2627450980392157, 0.21176470588235294, 1.0]).flat(1)
    .concat(new Array(moodyReport.bottomStartingDiagonalTable.numStations).fill([1.0, 0.9254901960784314, 0.2313725490196078, 1.0]).flat(1))
    .concat(new Array(moodyReport.northPerimeterTable.numStations).fill([0.2980392156862745, 0.6862745098039216, 0.3137254901960784, 1.0]).flat(1))
    .concat(new Array(moodyReport.eastPerimeterTable.numStations).fill([1.0, 0.4980392156862745, 0.3137254901960784, 1.0]).flat(1))
    .concat(new Array(moodyReport.southPerimeterTable.numStations).fill([0.12941176470588237, 0.5882352941176471, 0.9529411764705882, 1.0]).flat(1))
    .concat(new Array(moodyReport.westPerimeterTable.numStations).fill([1.0, 0.5019607843137255, 0.6745098039215687, 1.0]).flat(1))
    .concat(new Array(moodyReport.horizontalCenterTable.numStations).fill([0.0, 0.749019607843137, 0.8470588235294118, 1.0]).flat(1))
    .concat(new Array(moodyReport.verticalCenterTable.numStations).fill([0.607843137254902, 0.1568627450980392, 0.6862745098039216, 1.0]).flat(1))
    .concat(colorMappedZValues.flat(1)) // Add color mapped colors for the triangles z-value.
    .concat(tableThicknessVertices.slice(0, tableThicknessVertices.flat(1).length / 3).map(value => [0.5, 0.5, 0.5, 0.75]).flat(1)) // Add colors (gray) for table sides/bottom.

  const colorBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)

  return { colorBuffer: colorBuffer, colors: colors }
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

function setNormalAttribute(gl, buffers, programInfo) {
  const numComponents = 3
  const type = gl.FLOAT
  const normalize = false
  const stride = 0
  const offset = 0
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalBuffer)
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexNormal,
    numComponents,
    type,
    normalize,
    stride,
    offset,
  )
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal)
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

function setTextureAttribute(gl, buffers, programInfo) {
  const num = 2
  const type = gl.FLOAT
  const normalize = false
  const stride = 0
  const offset = 0
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureBuffer)
  gl.vertexAttribPointer(
    programInfo.attribLocations.textureCoord,
    num,
    type,
    normalize,
    stride,
    offset,
  )
  gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord)
}

function setTypeAttribute(gl, buffers, programInfo) {
  const numComponents = 1
  const type = gl.FLOAT
  const normalize = false
  const stride = 0
  const offset = 0
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.typeBuffer)
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexType,
    numComponents,
    type,
    normalize,
    stride,
    offset)
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexType)
}

// Initialize texture and load its image.
function loadTexture(gl, url) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  const level = 0
  const internalFormat = gl.RGBA
  const width = 1
  const height = 1
  const border = 0
  const srcFormat = gl.RGBA
  const srcType = gl.UNSIGNED_BYTE
  const pixel = new Uint8Array([0, 0, 255, 255]) // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel)

  const image = new Image()
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image)

    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      gl.generateMipmap(gl.TEXTURE_2D)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    }
  }
  image.src = url

  return texture
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0
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

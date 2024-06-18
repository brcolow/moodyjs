import { interpolate, turboColormapData } from "./colormap.js"
import { bowyerWatson, Vector3, Vertex } from "./delaunay.js"
import { Mat4 } from "./math.js"
import { getNumberOfStations, MoodyReport, SurfacePlate, roundTo } from "./moody.js"
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
const moodyData =  [
  [6.5, 6.0, 5.0, 5.2, 5.5, 5.6, 5.5, 5.0, 5.5, 4.8, 5.0, 5.2, 5.3, 4.9, 4.6, 4.2, 5.3, 4.9, 4.5, 3.5], // topStartingDiagonal
  [6.6, 5.4, 5.4, 5.2, 5.5, 5.7, 5.0, 5.0, 5.4, 4.5, 4.4, 4.5, 4.5, 4.8, 4.2, 4.2, 4.2, 4.8, 4.3, 3.2], // bottomStartingDiagonal
  [20.5, 19.7, 20.5, 20.3, 20.2, 19.9, 19.0, 19.5, 18.8, 18.6, 18.7, 18.6, 18.4, 18.5, 19.0, 17.9],     // northPerimeter
  [3.5, 2.1, 2.5, 2.8, 3.4, 3.2, 3.5, 4.0, 4.2, 3.5],                                                   // eastPerimeter
  [16.4, 15, 15.6, 15.5, 15.1, 15.3, 15.1, 14.6, 14, 13.5, 13.5, 13.3, 13.3, 13.4, 14, 13.9],           // southPerimeter
  [6, 4.6, 4.5, 4.7, 5.0, 4.5, 5.9, 6, 6, 4.9],                                                         // westPerimeter
  [11.7, 12.4, 12.1, 12.5, 12.0, 11.5, 11.5, 11.3, 11.3, 10.3, 10.8, 10.3, 10, 10.7, 10.4, 10.4],       // horizontalCenter
  [6.6, 6.4, 6.3, 6.5, 6.6, 6.9, 7.5, 7.4, 7.1, 7]]                                                     // verticalCenter

const lines = [ "topStartingDiagonal", "bottomStartingDiagonal", "northPerimeter", "eastPerimeter", "southPerimeter",
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
      document.getElementById("overallFlatness").value = overallFlatness
      document.getElementById("overallFlatness").dispatchEvent(new Event('input', { 'bubbles': true }))

      let tableModelMatrix = Mat4.create()
      initialize3DTableGraphic(moodyReport, tableModelMatrix)

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
let lastMappedPosition = null
let cumulativeZoomFactor = 1
let zMultiplier = -1
let buffers = null
let showLines = true
let showHeatmap = true
let lightingOn = true

function mapToSphere(mouseX, mouseY, canvas) {
  // Let radius = 1, so radius * radius = 1.
  const res = Math.min(canvas.width, canvas.height) - 1
  const x = (2 * mouseX - canvas.width - 1) / res
  const y = (2 * mouseY - canvas.height - 1) / res
  const length = Math.sqrt(x * x + y * y)
  // Map to sphere when x^2 + y^2 <= r^2 / 2 - otherwise map to the hyperbolic function f(x,y) = (r^2 / 2) / sqrt(x^2 + y^2).
  if (2 * length <= 1) {
    return new Vector3(x, y, Math.sqrt(1 - length * length)).norm()
  } else {
    return new Vector3(x, y, Math.atan(length) / Math.PI * 0.5).norm()
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

function initialize3DTableGraphic(moodyReport, tableModelMatrix) {
  const canvas = document.getElementById("glcanvas")
  // const gl = canvas.getContext("webgl2")
  const gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl2"))
  if (gl === null) {
    console.log("Unable to initialize WebGL. Your browser or machine may not support it.")
    const ctx = canvas.getContext("2d")

    ctx.font = "30px Arial"
    ctx.fillStyle = "red"
    ctx.textAlign = "center"
    ctx.fillText("Unable to initialize WebGL!", canvas.width / 2, canvas.height / 2)
    return
  }

  document.querySelector("#zMultiplier").addEventListener("input", event => {
    zMultiplier = event.target.value
    if (!(zMultiplier in boundingBoxCache)) {
      boundingBoxCache[zMultiplier] = getBoundingBox(moodyReport)
    }
    buffers = getBuffers(gl, moodyReport, zMultiplier)
  })

  document.getElementById("showLines").addEventListener("change", event => showLines = event.target.checked)
  document.getElementById("showHeatmap").addEventListener("change", event => showHeatmap = event.target.checked)
  document.getElementById("lightingOn").addEventListener("change", event => lightingOn = event.target.checked)

  canvas.onmousedown = event => {
    lastMappedPosition = mapToSphere(event.clientX, event.clientY, canvas)
  }

  document.onmouseup = () => { lastMappedPosition = null }

  document.onmousemove = event => {
    // Rotation is still weird...it seems like z-axis rotations somehow creep in. I wonder if maybe the table surface is not actually
    // aligned with the 3 coordinate axes like we think? Need to draw the axes and check this.
    // Look at:
    // https://stackoverflow.com/questions/37903979/set-an-objects-absolute-rotation-around-the-world-axis
    // https://gamedev.stackexchange.com/questions/136174/im-rotating-an-object-on-two-axes-so-why-does-it-keep-twisting-around-the-thir

    if (lastMappedPosition) {
      // Map mouse displacement onto virtual hemi-sphere/hyperbola.
      const mapped = mapToSphere(event.clientX, event.clientY, canvas)

      const threshold = 0.05 // Adjust threshold for desired sensitivity.
      if (Math.abs(mapped.x - lastMappedPosition.x) <= threshold && Math.abs(mapped.y - lastMappedPosition.y) <= threshold) {
        return
      }

      const direction = new Vector3(mapped.x - lastMappedPosition.x, mapped.y - lastMappedPosition.y, 0)
      // Determine rotation axis.
      const axis = lastMappedPosition.cross(mapped)
      // Determine rotation angle.
      const angle = Math.sign(direction.dot(lastMappedPosition)) * calculateRotationAngle(mapped, lastMappedPosition)

      const newRotationMatrix = Mat4.create()
      
      // Axis is a unit vector from the origin (bottom-left corner of surface plate) in the direction the mouse travelled.
      // We need it to be a unit vector from the center of the surface plate instead.
      newRotationMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2, 
        (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2, 
        (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      newRotationMatrix.rotate(angle, [axis.x, axis.y, 0])
      newRotationMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2), 
        -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2), 
        -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
      tableModelMatrix.multiply(newRotationMatrix)
      lastMappedPosition = mapped
    }
  }

  function calculateRotationAngle(v1, v2) {
    // Normalize vectors for robustness
    const normalizedV1 = v1.norm()
    const normalizedV2 = v2.norm()
  
    // Calculate cosine of the angle between vectors
    const cosTheta = normalizedV1.dot(normalizedV2)
  
    // Handle potential rounding errors for near-zero cosine values
    const theta = Math.acos(Math.min(Math.abs(cosTheta), 1))
  
    return theta
  }

  canvas.onwheel = event => {
    event.preventDefault()
    const direction = event.deltaY < 0 ? 1 : -1
    const zoomFactor = 1 + direction * 0.1
    if (cumulativeZoomFactor < 0.16 || cumulativeZoomFactor > 10) {
      // Max zoom level reached, don't zoom any more.
      return
    }
    cumulativeZoomFactor *= zoomFactor
    // TODO: Keep zoom centered at mouse cursor.
    const scaleMatrix = Mat4.create()
    scaleMatrix.scale([zoomFactor, zoomFactor, zoomFactor])
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
    if (keyMap['z'] === true) {
      translateMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2, 
        (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2, 
        (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      translateMatrix.rotate(0.01, [0.0, -1.0, 0.0])
      translateMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2), 
        -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2), 
        -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }
    if (keyMap['x'] === true) {
      translateMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2, 
        (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2, 
        (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      translateMatrix.rotate(0.01, [0.0, 1.0, 0.0])
      translateMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2), 
        -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2), 
        -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }
    if (keyMap['c'] === true) {
      translateMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2, 
        (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2, 
        (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      translateMatrix.rotate(0.01, [-1.0, 0.0, 0.0])
      translateMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2), 
        -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2), 
        -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }
    if (keyMap['v'] === true) {
      translateMatrix.translate([(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2, 
        (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2, 
        (boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2])
      translateMatrix.rotate(0.01, [1.0, 0.0, 0.0])
      translateMatrix.translate([-((boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2), 
        -((boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2), 
        -((boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) / 2)])
    }
    if (keyMap['b'] === true) {
      // Resets rotation.
      tableModelMatrix = Mat4.create()
    }
    tableModelMatrix.multiply(translateMatrix)
  }

  const texture = loadTexture(gl, "granite_2048x2048_compressed.png")
  // Flip image pixels into the bottom-to-top order that WebGL expects.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

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
  buffers = getBuffers(gl, moodyReport, zMultiplier)

  function render() {
    boundingBoxCache[zMultiplier] = getBoundingBox(moodyReport)
    drawTableSurface(moodyReport, gl, programInfo, buffers, tableModelMatrix, texture)
    requestAnimationFrame(render)
  }
  requestAnimationFrame(render)
}

// Creates a 3D surface of the linear plate heights (calculated as Column #8 of the line tables).
function drawTableSurface(moodyReport, gl, programInfo, buffers, tableModelMatrix, texture) {
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

  const viewMatrix = Mat4.create()
  viewMatrix.translate([-(boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX) / 2, 
    -(boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / 2, 
    -(boundingBoxCache[zMultiplier].maxZ - boundingBoxCache[zMultiplier].minZ) * 8])

  setPositionAttribute(gl, buffers, programInfo)
  setNormalAttribute(gl, buffers, programInfo)
  setColorAttribute(gl, buffers, programInfo)
  setTextureAttribute(gl, buffers, programInfo)
  setTypeAttribute(gl, buffers, programInfo)

  gl.useProgram(programInfo.program)

  const normalMatrix = Mat4.create()
  Mat4.invert(normalMatrix, Mat4.multiply(normalMatrix, viewMatrix, tableModelMatrix))
  Mat4.transpose(normalMatrix, normalMatrix)

  let lightPos = [document.getElementById("lightPosX").value, document.getElementById("lightPosY").value, document.getElementById("lightPosZ").value]
  let lightPower = document.getElementById("lightPower").value

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

    gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, Mat4.create())
    offset += vertexCount / 3
    vertexCount = 6
    gl.drawArrays(gl.LINE_STRIP, offset, vertexCount)
  }
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
                           diffuseColor * lambertian * lightColor * lightPower / distance +
                           specColor * specular * lightColor * lightPower / distance;
        // apply gamma correction (assume ambientColor, diffuseColor and specColor
        // have been linearized, i.e. have no gamma correction in them)
        vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0 / screenGamma));
        if (!showHeatmap) {
          if (lightingOn) {
            outputColor = texture(sampler, textureCoord) * vec4(colorGammaCorrected, 1.0);
          } else {
            outputColor = texture(sampler, textureCoord);
          }
        } else {
          if (lightingOn) {
            // No heatmap - show the table with a granite texture.
            outputColor = vec4(color.rgb * colorGammaCorrected, 1.0);
          } else {
            outputColor = color;
          }
        }
      }
    }
`

function getBuffers(gl, moodyReport, zMultiplier) {
  const positionBuffer = getPositionBuffer(gl, moodyReport, zMultiplier)
  const lineColorBuffer = getColorBuffer(gl, moodyReport, positionBuffer.triangleVertices)

  return {
    positionBuffer: positionBuffer.positionBuffer,
    normalBuffer: positionBuffer.normalBuffer,
    triangleVertices: positionBuffer.triangleVertices,
    textureBuffer: positionBuffer.textureBuffer,
    typeBuffer: positionBuffer.typeBuffer,
    lineColors: lineColorBuffer,
  }
}

function getPositionBuffer(gl, moodyReport, zMultiplier) {
  const vertices = moodyReport.vertices(zMultiplier).map(vertex => new Vertex(vertex[0], vertex[1], vertex[2])).flat(1)

  const triangulation = bowyerWatson(vertices)

  const triangulatedVertices = triangulation.map(triangle => [
    triangle.v0.x, triangle.v0.y, triangle.v0.z,
    triangle.v1.x, triangle.v1.y, triangle.v1.z,
    triangle.v2.x, triangle.v2.y, triangle.v2.z]).flat(1)

  const axisSize = 20

  // FIXME: We want the line to always be on top of the surface but it can dip underneath it at extreme points. Adding 0.1 to z-coordinate is not good enough.
  // We need to calculate the slope from point x -> y and use it to find amount to add so line is always on top.
  const positions = new Float32Array(
    moodyReport.vertices(zMultiplier).map(v => [v[0], v[1], v[2] + 0.1]).flat(1) // "Union jack" colored lines.
    .concat(triangulatedVertices)
    .concat(0, 0, 0,	axisSize, 0, 0,
			      0, 0, 0,	0, axisSize, 0,
			      0, 0, 0,	0, 0, axisSize)
  )

  console.log("Position buffer size: " + positions.length / 3)
  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  // Calculate and create normal buffer.
  const lineNormals = moodyReport.vertices(zMultiplier).map(v => [0.0, 0.0, 0.0]).flat(1)
  // Each triangle has 3 vertices with the same surface normal.
  const triangleNormals = triangulation.map(triangle => {
    const length = Math.sqrt(triangle.surfaceNormal().x * triangle.surfaceNormal().x +
      triangle.surfaceNormal().y * triangle.surfaceNormal().y +
      triangle.surfaceNormal().z * triangle.surfaceNormal().z)
    return [
    triangle.surfaceNormal().x / length, triangle.surfaceNormal().y / length, triangle.surfaceNormal().z / length,
    triangle.surfaceNormal().x / length, triangle.surfaceNormal().y / length, triangle.surfaceNormal().z / length,
    triangle.surfaceNormal().x / length, triangle.surfaceNormal().y / length, triangle.surfaceNormal().z / length]
    }).flat(1)
  const normals = new Float32Array(lineNormals.concat(triangleNormals).concat(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))
  console.log("Normals buffer size: " + normals.length / 3)
  const normalBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW)

  // Calculate and create texture buffer.
  const lineTextureCoords = moodyReport.vertices(zMultiplier).map(v => [0.0, 1.0]).flat(1)

  if (!(zMultiplier in boundingBoxCache)) {
    boundingBoxCache[zMultiplier] = getBoundingBox(moodyReport)
  }
  const tableSurfaceRatio = (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX)
  const numRepeatsX = 1
  const numRepeatsY = numRepeatsX * tableSurfaceRatio
  //  Map [minX, maxX] => [0, 1] and [minY, maxY] => [0, 1]
  // (val - A) * (b - a) / (B - A) + a
  const triangleTextureCoords = triangulation.map((triangle) => [
    ((triangle.v0.x - boundingBoxCache[zMultiplier].maxX) * (numRepeatsX + 1)) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX), ((triangle.v0.y - boundingBoxCache[zMultiplier].maxY) * (numRepeatsY + 1)) / (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY),
    ((triangle.v1.x - boundingBoxCache[zMultiplier].maxX) * (numRepeatsX + 1)) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].maxX), ((triangle.v1.y - boundingBoxCache[zMultiplier].maxY) * (numRepeatsY + 1)) / (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY),
    ((triangle.v2.x - boundingBoxCache[zMultiplier].maxX) * (numRepeatsX + 1)) / (boundingBoxCache[zMultiplier].maxX - boundingBoxCache[zMultiplier].minX), ((triangle.v2.y - boundingBoxCache[zMultiplier].maxY) * (numRepeatsY + 1)) / (boundingBoxCache[zMultiplier].maxY - boundingBoxCache[zMultiplier].minY),]
  ).flat(1)

  const textureCoordinates = new Float32Array(lineTextureCoords.concat(triangleTextureCoords).concat(0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0))
  console.log("Texture buffer size: " + textureCoordinates.length / 2)
  const textureBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, textureCoordinates, gl.STATIC_DRAW)

  const types = new Float32Array(
    moodyReport.vertices(zMultiplier).map(v => [0.0]).flat(1) // "Union jack" colored lines have type "0.0"
    .concat(triangulation.map(_ => [1.0, 1.0, 1.0]).flat(1))  // Table vertices have type "1.0"
    .concat(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)) // Axes vertices have type "0.0"
  console.log("Type buffer size: " + types.length)
  const typeBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, typeBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, types, gl.STATIC_DRAW)

  return { positionBuffer: positionBuffer, normalBuffer: normalBuffer, textureBuffer: textureBuffer, typeBuffer: typeBuffer, triangleVertices: triangulatedVertices }
}

function getColorBuffer(gl, moodyReport, triangleVertices) {
  const triangleZValues = triangleVertices.filter((v, i) => (i + 1) % 3 == 0)
  const minZ = Math.min(...triangleZValues)
  const maxZ = Math.max(...triangleZValues)
  const normalizedTriangleZValues = triangleZValues.map(value => (value - minZ) / (maxZ - minZ))
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
    .concat(1, 0, 0, 1, 	1, 0.6, 0, 1,
			      0, 1, 0, 1, 	0.6, 1, 0, 1,
			      0, 0, 1, 1, 	0, 0.6, 1, 1) // Add colors for axes lines.

  console.log("Color buffer size: " + colors.length / 4)
  const colorBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)

  return colorBuffer
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

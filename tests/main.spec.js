import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { Mat4, Vector3 } from '../math'
import { getNumberOfStations, MoodyReport, SurfacePlate } from '../moody'
import { bowyerWatson } from '../delaunay'
import { interpolate, turboColormapData } from '../colormap'

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')

// Run the real event handlers with an in-memory canvas and WebGL context.
function createScene(settings = {}, dimensions = [48, 72, 4], useMoodyData = false) {
  const elements = new Map()
  const frames = []
  const uniforms = new Map()
  const gl = new Proxy({
    canvas: { width: 800, height: 600 },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_, name) => name,
    uniform1i: (name, value) => uniforms.set(name, value),
    uniform1f: (name, value) => uniforms.set(name, value),
    uniform2f: (name, x, y) => uniforms.set(name, [x, y]),
    uniform3fv: (name, value) => uniforms.set(name, Array.from(value))
  }, { get: (object, key) => key in object ? object[key] : () => {} })
  const element = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: ({ zMultiplier: '50000', lightAzimuth: '135', lightElevation: '35', lightStrength: '0.6', surfaceView: 'surface' })[id] || '0',
        checked: !['rotateLight', 'showContours'].includes(id),
        width: 800, height: 600, style: {}, listeners: {},
        setAttribute(name, value) { this[name] = value },
        addEventListener(type, callback) { this.listeners[type] = callback },
        getContext: () => gl,
        getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 600 })
      })
    }
    return elements.get(id)
  }
  for (const [id, values] of Object.entries(settings)) {
    Object.assign(element(id), values)
  }
  const document = { getElementById: element, querySelector: selector => element(selector.slice(1)) }
  const api = runInNewContext(source.replace(/^import .*$/gm, '') + `
    ;({ initialize3DTableGraphic, reset3DTableView, getNonColorBuffers, getColorBuffer, getBoundingBox, getHeightScale, getGraphGrid, moodyData,
      get model() { return tableModelMatrix }, get view() { return viewMatrix },
      get projection() { return projectionMatrix }, get zoom() { return cumulativeZoomFactor },
      get height() { return zMultiplier } })`, {
    console, Mat4, Vector3, bowyerWatson, interpolate, turboColormapData,
    document, window: { addEventListener() {} }, Float32Array, Uint8Array,
    ResizeObserver: class { observe() {} }, Image: class {}, requestAnimationFrame: callback => frames.push(callback)
  })
  const plate = new SurfacePlate(...dimensions)
  const lines = ['topStartingDiagonal', 'bottomStartingDiagonal', 'northPerimeter', 'eastPerimeter',
    'southPerimeter', 'westPerimeter', 'horizontalCenter', 'verticalCenter']
  const report = new MoodyReport(plate, ...(useMoodyData ? api.moodyData : lines.map(line => Array(getNumberOfStations(line, plate)).fill(0))))
  api.initialize3DTableGraphic(report)
  const frame = (time = 16) => frames.shift()(time)
  frame()
  const canvas = element('glcanvas')
  return {
    api, canvas, gl, report, uniforms, frame, element,
    drag(x0, y0, x1, y1) {
      canvas.onmousedown({ clientX: x0, clientY: y0, button: 0 })
      document.onmousemove({ clientX: x1, clientY: y1 })
      document.onmouseup()
      frame()
    },
    project(point) {
      return Vector3.clone(point).transformMat4(Mat4.clone(api.projection).multiply(api.view).multiply(api.model))
    }
  }
}

describe('3D table controls', () => {
  it('should keep the table center fixed during successive drags', () => {
    const scene = createScene()
    const center = new Vector3(36, 24, 0)
    const before = scene.project(center)
    scene.drag(400, 300, 480, 570)
    scene.drag(400, 300, 720, 360)
    scene.canvas.onkeydown({ key: 'd', preventDefault() {} })
    scene.canvas.onkeyup({ key: 'd' })
    scene.frame()
    scene.drag(400, 300, 650, 400)
    expect(scene.project(center).sub(before).magnitude).toBeLessThan(0.00001)
  })

  it('should apply successive drags in the same screen axes', () => {
    const scene = createScene()
    scene.drag(400, 300, 480, 570)
    const vertical = Mat4.clone(scene.api.model)
    scene.api.reset3DTableView()
    scene.drag(400, 300, 720, 360)
    const horizontal = Mat4.clone(scene.api.model)
    scene.api.reset3DTableView()
    scene.drag(400, 300, 480, 570)
    scene.drag(400, 300, 720, 360)
    const expected = horizontal.multiply(vertical)
    scene.api.model.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 4))
  })

  it.each([[80, 80], [400, 300], [720, 450]])('should rotate a vertical drag at (%i, %i) only about the horizontal screen axis', (x, y) => {
    const scene = createScene()
    const point = new Vector3(46, 24, 0)
    const before = scene.project(point)
    scene.drag(x, y, x, y + 120)
    expect(scene.project(point).sub(before).magnitude).toBeLessThan(0.00001)
    expect(scene.api.model[6]).toBeGreaterThan(0)
  })

  it.each([[80, 80], [400, 300], [720, 450]])('should rotate a horizontal drag at (%i, %i) only about the vertical screen axis', (x, y) => {
    const scene = createScene()
    const point = new Vector3(36, 34, 0)
    const before = scene.project(point)
    scene.drag(x, y, x + 120, y)
    expect(scene.project(point).sub(before).magnitude).toBeLessThan(0.00001)
    expect(scene.api.model[2]).toBeLessThan(0)
  })

  it('should give the same rotation for the same drag anywhere on the canvas', () => {
    const scene = createScene()
    scene.drag(400, 300, 480, 420)
    const centerDrag = Mat4.clone(scene.api.model)
    scene.api.reset3DTableView()
    scene.drag(650, 150, 730, 270)
    scene.api.model.forEach((value, index) => expect(value).toBeCloseTo(centerDrag[index], 5))
  })

  it('should handle a drag far beyond the canvas', () => {
    const scene = createScene()
    scene.drag(0, 300, 2600, 300)
    expect(Array.from(scene.api.model).every(Number.isFinite)).toBe(true)
  })

  it.each([[50, 30, 0], [3, 24, 0]])('should keep the point (%i, %i, %i) under the cursor fixed when zooming a rotated table', (x, y, z) => {
    const scene = createScene()
    scene.drag(400, 300, 720, 360)
    scene.drag(400, 300, 480, 570)
    const point = new Vector3(x, y, z)
    const before = scene.project(point)
    scene.canvas.onwheel({
      preventDefault() {}, deltaY: -1, ctrlKey: false,
      clientX: (before.x + 1) * 400, clientY: (1 - before.y) * 300
    })
    expect(scene.api.zoom).toBe(1.1)
    expect(scene.project(point).sub(before).magnitude).toBeLessThan(0.00001)
  })

  it('should enforce both zoom limits and preserve the center during Ctrl-wheel zoom', () => {
    const scene = createScene()
    scene.canvas.onkeydown({ key: 'ArrowRight', preventDefault() {} })
    scene.canvas.onkeyup({ key: 'ArrowRight' })
    scene.drag(400, 300, 650, 380)
    const center = new Vector3(36, 24, 0)
    const before = scene.project(center)
    for (let i = 0; i < 50; i++) {
      scene.canvas.onwheel({ preventDefault() {}, deltaY: -1, ctrlKey: true })
    }
    expect(scene.api.zoom).toBe(10)
    expect(scene.api.view[0]).toBeCloseTo(10, 4)
    expect(scene.project(center).sub(before).magnitude).toBeLessThan(0.00001)
    for (let i = 0; i < 100; i++) {
      scene.canvas.onwheel({ preventDefault() {}, deltaY: 1, ctrlKey: true })
    }
    expect(scene.api.zoom).toBe(0.16)
    expect(scene.api.view[0]).toBeCloseTo(0.16, 5)
    expect(scene.project(center).sub(before).magnitude).toBeLessThan(0.00001)
  })

  it('should use display settings selected before the first report', () => {
    const scene = createScene({
      zMultiplier: { value: '100000' }, showLines: { checked: false },
      showHeatmap: { checked: false }, lightingOn: { checked: false }
    })
    expect(scene.api.height).toBe('100000')
    for (const name of ['showLines', 'showHeatmap', 'lightingOn']) {
      expect(scene.uniforms.get(name)).toBe(false)
    }
  })

  it('should allow Tab and browser shortcuts to leave the canvas', () => {
    const scene = createScene()
    let prevented = false
    const preventDefault = () => prevented = true
    scene.canvas.onkeydown({ key: 'Tab', preventDefault })
    scene.canvas.onkeydown({ key: 'w', ctrlKey: true, preventDefault })
    expect(prevented).toBe(false)
    scene.canvas.onkeydown({ key: 'ArrowUp', preventDefault })
    expect(prevented).toBe(true)
    scene.canvas.onblur()
    scene.canvas.onkeydown({ key: 'ArrowRight', preventDefault })
    scene.frame()
    expect(scene.api.model[13]).toBe(-1)
  })

  it('should build a flat surface with finite normals for zero readings', () => {
    const scene = createScene()
    const buffers = scene.api.getNonColorBuffers(scene.gl, scene.report, 50000)
    expect(Array.from(buffers.normals).every(Number.isFinite)).toBe(true)
    for (let i = 2; i < buffers.triangleVertices.length; i += 3) {
      expect(buffers.triangleVertices[i]).toBe(0)
    }
  })

  it('should keep actual heights and contour intervals unchanged by height exaggeration', () => {
    const scene = createScene({}, [48, 72, 4], true)
    const initial = scene.api.getHeightScale(scene.api.getBoundingBox(scene.report), scene.api.height)
    expect(initial.max).toBeCloseTo(178.41, 2)
    expect(initial.step).toBe(50)
    for (const multiplier of ['10000', '100000']) {
      scene.element('zMultiplier').value = multiplier
      scene.element('zMultiplier').listeners.input({ target: { value: multiplier } })
      const scale = scene.api.getHeightScale(scene.api.getBoundingBox(scene.report), multiplier)
      expect(scale.min).toBeCloseTo(initial.min, 8)
      expect(scale.max).toBeCloseTo(initial.max, 8)
      expect(scale.step).toBe(initial.step)
      expect(scene.element('heightLegendLabels').innerHTML).toContain('178.41 µin (4.53 µm)')
    }
  })

  it('should probe the rendered surface in actual units after changing its height multiplier', () => {
    const scene = createScene({}, [48, 72, 4], true)
    const vertices = scene.api.getNonColorBuffers(scene.gl, scene.report, 50000).triangleVertices
    const centers = []
    for (let i = 0; i < vertices.length; i += 9) {
      centers.push(new Vector3((vertices[i] + vertices[i + 3] + vertices[i + 6]) / 3,
        (vertices[i + 1] + vertices[i + 4] + vertices[i + 7]) / 3,
        (vertices[i + 2] + vertices[i + 5] + vertices[i + 8]) / 3))
    }
    centers.sort((a, b) => Math.hypot(a.x - 36, a.y - 24) - Math.hypot(b.x - 36, b.y - 24))
    const point = centers[0]
    for (const multiplier of [50000, 100000]) {
      scene.element('zMultiplier').listeners.input({ target: { value: String(multiplier) } })
      scene.frame()
      const projected = scene.project(new Vector3(point.x, point.y, point.z * multiplier / 50000))
      scene.canvas.onmousemove({ clientX: (projected.x + 1) * 400, clientY: (1 - projected.y) * 300 })
      scene.canvas.onfocus()
      scene.frame()
      expect(scene.element('heightProbe').textContent).toContain(`${(point.z * 20).toFixed(2)} µin`)
      expect(scene.element('heightProbe').textContent).toContain(`X: ${point.x.toFixed(2)} in, Y: ${point.y.toFixed(2)} in`)
      expect(parseFloat(scene.element('heightLegendMarker').style.left)).toBeCloseTo(point.z / scene.uniforms.get('heightRange')[1] * multiplier / 50000 * 100, 3)
      expect(scene.element('heightProbeMarker').hidden).toBe(false)
    }
    scene.canvas.onmouseleave()
    expect(scene.element('heightProbeMarker').hidden).toBe(true)
    expect(scene.element('heightLegendMarker').hidden).toBe(true)
  })

  it('should rotate a unit light direction only while animation and lighting are enabled', () => {
    const scene = createScene()
    scene.frame(32)
    expect(Number(scene.element('lightAzimuth').value)).toBe(135)
    scene.element('rotateLight').checked = true
    scene.frame(48)
    expect(Number(scene.element('lightAzimuth').value)).toBeCloseTo(135.192, 6)
    expect(Math.hypot(...scene.uniforms.get('lightDirection'))).toBeCloseTo(1, 8)
    expect(scene.uniforms.get('lightStrength')).toBe(0.6)
    const scale = scene.element('heightLegendLabels').innerHTML
    scene.element('lightingOn').listeners.change({ target: { checked: false } })
    scene.frame(64)
    expect(Number(scene.element('lightAzimuth').value)).toBeCloseTo(135.192, 6)
    expect(scene.element('heightLegendLabels').innerHTML).toBe(scale)
    scene.element('lightAzimuth').listeners.input()
    expect(scene.element('rotateLight').checked).toBe(false)
  })

  it('should restore the surface camera and contour setting after inspecting the graph', () => {
    const scene = createScene()
    scene.drag(400, 300, 560, 370)
    scene.canvas.onwheel({ preventDefault() {}, deltaY: -1, ctrlKey: true })
    scene.frame()
    const model = Mat4.clone(scene.api.model)
    const view = Mat4.clone(scene.api.view)
    scene.element('surfaceView').listeners.change({ target: { value: 'contour' } })
    scene.frame()
    expect(scene.api.projection[15]).toBe(1)
    expect(scene.api.projection[11]).toBe(0)
    expect(scene.uniforms.get('showContours')).toBe(true)
    expect(scene.uniforms.get('showLines')).toBe(false)
    expect(scene.element('graphLabels').innerHTML).toContain('Height (µin)')
    scene.drag(400, 300, 640, 400)
    scene.canvas.onkeydown({ key: 'ArrowRight', preventDefault() {} })
    scene.canvas.onkeyup({ key: 'ArrowRight' })
    scene.element('surfaceView').listeners.change({ target: { value: 'surface' } })
    scene.frame()
    expect(scene.api.model).toEqual(model)
    expect(scene.api.view).toEqual(view)
    expect(scene.api.zoom).toBe(1.1)
    expect(scene.api.projection[11]).toBe(-1)
    expect(scene.uniforms.get('showContours')).toBe(false)
    expect(scene.uniforms.get('showLines')).toBe(true)
    expect(scene.element('graphLabels').innerHTML).toBe('')
  })

  it('should create a finite graph and a zero-height probe for flat data', () => {
    const scene = createScene({ surfaceView: { value: 'contour' } })
    const bounds = scene.api.getBoundingBox(scene.report)
    const scale = scene.api.getHeightScale(bounds, scene.api.height)
    expect(scale).toEqual({ min: 0, max: 0, step: 1, top: 1 })
    expect(scene.api.getGraphGrid(bounds, scene.api.height).every(Number.isFinite)).toBe(true)
    expect(Array.from(scene.api.projection).every(Number.isFinite)).toBe(true)
    scene.canvas.onfocus()
    scene.frame()
    expect(scene.element('heightProbe').textContent).toContain('0.00 µin (0.00 µm)')
    expect(scene.element('heightLegendMarker').style.left).toBe('0%')
    expect(scene.element('heightLegend').style.backgroundImage).toBe('none')
    expect(scene.element('heightLegendLabels').innerHTML).toBe('<span>0.00 µin (0.00 µm)</span>')
    expect(scene.uniforms.get('showContours')).toBe(true)
  })

  it.each([
    ['vertical', [10, 0, 0], 650, 270], ['horizontal', [0, 10, 0], 770, 150]
  ])('should keep a %s drag on the isometric graph aligned with the screen', (_, direction, x, y) => {
    const scene = createScene({ surfaceView: { value: 'contour' } })
    const point = new Vector3(36, 24, 0).transformMat4(scene.api.view)
      .add(direction).transformMat4(Mat4.clone(scene.api.view).invert())
    const before = scene.project(point)
    scene.drag(650, 150, x, y)
    expect(scene.project(point).sub(before).magnitude).toBeLessThan(0.00001)
  })

  it.each([
    ['ArrowUp', 'y', 1], ['ArrowDown', 'y', -1], ['ArrowRight', 'x', 1], ['ArrowLeft', 'x', -1]
  ])('should pan the isometric graph in the screen direction of %s after rotation and zoom', (key, axis, direction) => {
    const scene = createScene({ surfaceView: { value: 'contour' } })
    scene.drag(400, 300, 560, 370)
    scene.canvas.onkeydown({ key: 'a', preventDefault() {} })
    scene.canvas.onkeyup({ key: 'a' })
    scene.canvas.onwheel({ preventDefault() {}, deltaY: -1, ctrlKey: true })
    scene.frame()
    const point = new Vector3(36, 24, 0)
    const before = scene.project(point)
    scene.canvas.onkeydown({ key, preventDefault() {} })
    scene.canvas.onkeyup({ key })
    scene.frame()
    const movement = scene.project(point).sub(before)
    expect(movement[axis] * direction).toBeGreaterThan(0)
    expect(movement[axis === 'x' ? 'y' : 'x']).toBeCloseTo(0, 5)
    expect(movement.z).toBeCloseTo(0, 5)
  })

  it.each([[48, 72, 4], [36, 60, 3.5]])('should keep the %ix%i preview within the measured area with %fin spacing', (height, width, spacing) => {
    const scene = createScene({}, [height, width, spacing])
    const buffers = scene.api.getNonColorBuffers(scene.gl, scene.report, 50000)
    const bounds = scene.api.getBoundingBox(scene.report)
    const bodyX = buffers.tableThicknessVertices.map(vertex => vertex[0])
    const bodyY = buffers.tableThicknessVertices.map(vertex => vertex[1])
    expect(Math.min(...bodyX)).toBeCloseTo(bounds.minX, 5)
    expect(Math.max(...bodyX)).toBeCloseTo(bounds.maxX, 5)
    expect(Math.min(...bodyY)).toBeCloseTo(bounds.minY, 5)
    expect(Math.max(...bodyY)).toBeCloseTo(bounds.maxY, 5)
    expect(bounds.minX).toBeGreaterThan(0)
    expect(bounds.minY).toBeGreaterThan(0)
    expect(bounds.maxX).toBeLessThan(width)
    expect(bounds.maxY).toBeLessThan(height)
    for (let i = 0; i < buffers.triangleVertices.length; i += 3) {
      expect(buffers.triangleVertices[i]).toBeGreaterThan(0)
      expect(buffers.triangleVertices[i]).toBeLessThan(width)
      expect(buffers.triangleVertices[i + 1]).toBeGreaterThan(0)
      expect(buffers.triangleVertices[i + 1]).toBeLessThan(height)
    }
  })

  it('should use translucent gray for the sides and bottom', () => {
    const scene = createScene()
    const buffers = scene.api.getNonColorBuffers(scene.gl, scene.report, 50000)
    const colors = scene.api.getColorBuffer(scene.gl, scene.report, buffers.triangleVertices, buffers.tableThicknessVertices).colors
    const bodyStart = scene.report.vertices().length + buffers.triangleVertices.length / 3
    expect(colors.length / 4).toBe(buffers.positions.length / 3)
    for (let i = bodyStart; i < buffers.types.length; i++) {
      expect(buffers.types[i]).toBe(2)
      expect(colors.slice(i * 4, i * 4 + 4)).toEqual([0.5, 0.5, 0.5, 0.75])
    }
  })

  it.each([
    ['northPerimeter', 1, 'maxY'], ['eastPerimeter', 0, 'maxX'],
    ['southPerimeter', 1, 'minY'], ['westPerimeter', 0, 'minX']
  ])('should continue the %s heights into both the surface edge and gray wall', (line, axis, bound) => {
    const scene = createScene({}, [48, 72, 4], true)
    const buffers = scene.api.getNonColorBuffers(scene.gl, scene.report, 50000)
    const bounds = scene.api.getBoundingBox(scene.report)
    const surfaceVertices = []
    for (let i = 0; i < buffers.triangleVertices.length; i += 3) {
      surfaceVertices.push(buffers.triangleVertices.slice(i, i + 3))
    }
    for (const reading of scene.report[line + 'Table'].vertices(50000)) {
      const edge = Array.from(reading)
      edge[axis] = bounds[bound]
      const matches = vertex => vertex.every((value, index) => Math.abs(value - edge[index]) < 0.00001)
      expect(surfaceVertices.some(matches)).toBe(true)
      expect(buffers.tableThicknessVertices.some(matches)).toBe(true)
    }
  })

  it('should give the body consistent outward normals', () => {
    const scene = createScene()
    const buffers = scene.api.getNonColorBuffers(scene.gl, scene.report, 50000)
    const { minX, maxX, minY, maxY } = scene.api.getBoundingBox(scene.report)
    const bodyStart = scene.report.vertices().length * 3 + buffers.triangleVertices.length
    for (let i = 0; i < buffers.tableThicknessVertices.length; i += 3) {
      const vertices = buffers.tableThicknessVertices.slice(i, i + 3)
      const normal = Array.from(buffers.normals.slice(bodyStart + i * 3, bodyStart + i * 3 + 3))
      let expected
      if (vertices.every(v => v[2] < 0)) expected = [0, 0, -1]
      else if (vertices.every(v => Math.abs(v[0] - minX) < 0.00001)) expected = [-1, 0, 0]
      else if (vertices.every(v => Math.abs(v[0] - maxX) < 0.00001)) expected = [1, 0, 0]
      else if (vertices.every(v => Math.abs(v[1] - minY) < 0.00001)) expected = [0, -1, 0]
      else if (vertices.every(v => Math.abs(v[1] - maxY) < 0.00001)) expected = [0, 1, 0]
      expect(expected).toBeDefined()
      expect(new Vector3(normal).sub(expected).magnitude).toBeLessThan(0.00001)
    }
  })
})

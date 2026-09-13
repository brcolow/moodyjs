import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { Mat4, Vector3 } from '../math'
import { getNumberOfStations, MoodyReport, SurfacePlate } from '../moody'
import { bowyerWatson } from '../delaunay'
import { interpolate, turboColormapData } from '../colormap'

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')

// Run the real event handlers with an in-memory canvas and WebGL context.
function createScene(settings = {}, dimensions = [48, 72, 4]) {
  const elements = new Map()
  const frames = []
  const uniforms = new Map()
  const gl = new Proxy({
    canvas: { width: 800, height: 600 },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_, name) => name,
    uniform1i: (name, value) => uniforms.set(name, value)
  }, { get: (object, key) => key in object ? object[key] : () => {} })
  const element = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: id === 'zMultiplier' ? '50000' : '0', checked: true,
        width: 800, height: 600, style: {}, listeners: {},
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
    ;({ initialize3DTableGraphic, reset3DTableView, getNonColorBuffers, getColorBuffer, getBoundingBox,
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
  const report = new MoodyReport(plate, ...lines.map(line => Array(getNumberOfStations(line, plate)).fill(0)))
  api.initialize3DTableGraphic(report)
  const frame = () => frames.shift()(16)
  frame()
  const canvas = element('glcanvas')
  return {
    api, canvas, gl, report, uniforms, frame,
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

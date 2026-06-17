import { Vector3 } from "./math.js"

// Delaunay Triangulation originally from: https://github.com/msavela/delaunay/

class Triangle {
  constructor(v0, v1, v2) {
    this.v0 = v0
    this.v1 = v1
    this.v2 = v2

    // These are used by the triangulation hot path. Keeping them as numbers
    // avoids repeated Vector3 allocation and avoids Math.sqrt during tests.
    this.cx = 0
    this.cy = 0
    this.radiusSq = 0

    // Lazily created compatibility fields for callers that use triangle.center,
    // triangle.radius, triangle.edgeVec0, or triangle.edgeVec1.
    this._center = null
    this._radius = null
    this._edgeVec0 = null
    this._edgeVec1 = null

    this.calcCircumcircle()
  }

  get center() {
    if (this._center === null) {
      this._center = new Vector3(this.cx, this.cy, 0)
    }
    return this._center
  }

  set center(value) {
    this._center = value
    this.cx = value.x
    this.cy = value.y
  }

  get radius() {
    if (this._radius === null) {
      this._radius = Math.sqrt(this.radiusSq)
    }
    return this._radius
  }

  set radius(value) {
    this._radius = value
    this.radiusSq = value * value
  }

  get edgeVec0() {
    if (this._edgeVec0 === null) {
      this._edgeVec0 = new Vector3(
        this.v1.x - this.v0.x,
        this.v1.y - this.v0.y,
        this.v1.z - this.v0.z
      )
    }
    return this._edgeVec0
  }

  get edgeVec1() {
    if (this._edgeVec1 === null) {
      this._edgeVec1 = new Vector3(
        this.v2.x - this.v0.x,
        this.v2.y - this.v0.y,
        this.v2.z - this.v0.z
      )
    }
    return this._edgeVec1
  }

  calcCircumcircle() {
    // Reference: http://www.faqs.org/faqs/graphics/algorithms-faq/
    // Subject 1.04: How do I generate a circle through three points?
    const v0 = this.v0
    const v1 = this.v1
    const v2 = this.v2

    const A = v1.x - v0.x
    const B = v1.y - v0.y
    const C = v2.x - v0.x
    const D = v2.y - v0.y

    const E = A * (v0.x + v1.x) + B * (v0.y + v1.y)
    const F = C * (v0.x + v2.x) + D * (v0.y + v2.y)

    const G = 2.0 * (A * (v2.y - v1.y) - B * (v2.x - v1.x))

    let cx
    let cy
    let radiusSq

    if (G === 0) {
      // Collinear points: Use the midpoint of extremes as center.
      const minx = Math.min(v0.x, v1.x, v2.x)
      const maxx = Math.max(v0.x, v1.x, v2.x)
      const miny = Math.min(v0.y, v1.y, v2.y)
      const maxy = Math.max(v0.y, v1.y, v2.y)

      cx = (minx + maxx) * 0.5
      cy = (miny + maxy) * 0.5

      const dx = cx - minx
      const dy = cy - miny
      radiusSq = dx * dx + dy * dy
    } else {
      // Calculate the circumcircle.
      cx = (D * E - B * F) / G
      cy = (A * F - C * E) / G

      const dx = cx - v0.x
      const dy = cy - v0.y
      radiusSq = dx * dx + dy * dy
    }

    this.cx = cx
    this.cy = cy
    this.radiusSq = radiusSq

    // Derived values are invalidated whenever the circumcircle is recalculated.
    this._center = null
    this._radius = null
  }

  inCircumcircle(v) {
    const dx = this.cx - v.x
    const dy = this.cy - v.y
    return dx * dx + dy * dy <= this.radiusSq
  }

  surfaceNormal() {
    const normalVector = Vector3.create()
    return Vector3.cross(normalVector, this.edgeVec1, this.edgeVec0)
  }
}

/**
 * Computes a large "super triangle" that fully encloses all given vertices.
 *
 * The super triangle is constructed to be significantly larger than the bounding box
 * of the input vertices, ensuring it fully contains all points.
 *
 * The super triangle vertices are placed as follows:
 * - One vertex far to the left and below.
 * - One vertex far above the center.
 * - One vertex far to the right and below.
 *
 * This triangle is later used as the starting point for Bowyer-Watson triangulation
 * and will be discarded after all vertices are inserted.
 *
 * @param {Vector3[]} vertices - Array of input vertices to be triangulated.
 * @returns {Triangle} A large enclosing Triangle instance.
 */
function getSuperTriangle(vertices) {
  let minX = vertices[0].x
  let minY = vertices[0].y
  let maxX = vertices[0].x
  let maxY = vertices[0].y

  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i]

    if (v.x < minX) minX = v.x
    if (v.y < minY) minY = v.y
    if (v.x > maxX) maxX = v.x
    if (v.y > maxY) maxY = v.y
  }

  const midX = (minX + maxX) * 0.5
  const midY = (minY + maxY) * 0.5
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const d = span * 16

  const v0 = new Vector3(midX - d, midY - d, 0)
  const v1 = new Vector3(midX, midY + d, 0)
  const v2 = new Vector3(midX + d, midY - d, 0)

  return new Triangle(v0, v1, v2)
}

/**
 * Removes duplicate x/y vertices before triangulation.
 *
 * Duplicate points can create zero-area triangles and unnecessary work. The first
 * vertex with each x/y coordinate pair is retained.
 *
 * @param {Vector3[]} vertices - Array of input vertices.
 * @returns {Vector3[]} Vertices with duplicate x/y coordinates removed.
 */
function uniqueVerticesByXY(vertices) {
  const result = []
  const seen = new Set()

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]
    const key = `${v.x},${v.y}`

    if (!seen.has(key)) {
      seen.add(key)
      result.push(v)
    }
  }

  return result
}

/**
 * Assigns a stable numeric id to every vertex used by the triangulation.
 *
 * Edge keys are then built from these ids instead of from coordinate strings,
 * reducing allocation and avoiding repeated float-to-string conversion in the hot path.
 *
 * @param {Vector3[]} vertices - Deduplicated input vertices.
 * @param {Triangle} superTriangle - The enclosing super triangle.
 * @returns {{ idOf: WeakMap<Vector3, number>, stride: number }} Vertex ids and key stride.
 */
function makeVertexIds(vertices, superTriangle) {
  const idOf = new WeakMap()
  let nextId = 0

  for (let i = 0; i < vertices.length; i++) {
    idOf.set(vertices[i], nextId++)
  }

  idOf.set(superTriangle.v0, nextId++)
  idOf.set(superTriangle.v1, nextId++)
  idOf.set(superTriangle.v2, nextId++)

  return {
    idOf,
    stride: nextId,
  }
}

/**
 * Returns a consistent numeric key for an edge regardless of vertex order.
 *
 * @param {Vector3} a - First edge vertex.
 * @param {Vector3} b - Second edge vertex.
 * @param {WeakMap<Vector3, number>} idOf - Vertex id map.
 * @param {number} stride - Key stride, larger than any vertex id.
 * @returns {number} A numeric key for the edge.
 */
function edgeKeyById(a, b, idOf, stride) {
  let ai = idOf.get(a)
  let bi = idOf.get(b)

  if (ai > bi) {
    const t = ai
    ai = bi
    bi = t
  }

  return ai * stride + bi
}

/**
 * Counts edges from triangles removed during a vertex insertion.
 *
 * Edges that occur exactly once form the boundary of the hole. Edges that occur
 * twice are internal to the removed triangle set and should not be re-triangulated.
 *
 * @param {Map<number, { v0: Vector3, v1: Vector3, count: number }>} boundaryEdges - Edge count map.
 * @param {Vector3} a - First edge vertex.
 * @param {Vector3} b - Second edge vertex.
 * @param {WeakMap<Vector3, number>} idOf - Vertex id map.
 * @param {number} stride - Key stride, larger than any vertex id.
 */
function addBoundaryEdge(boundaryEdges, a, b, idOf, stride) {
  const key = edgeKeyById(a, b, idOf, stride)
  const entry = boundaryEdges.get(key)

  if (entry) {
    entry.count += 1
  } else {
    boundaryEdges.set(key, {
      v0: a,
      v1: b,
      count: 1,
    })
  }
}

function addVertex(vertex, openTriangles, closedTriangles, idOf, stride, boundaryEdges) {
  // Reuse the same Map for every insertion to reduce allocation churn.
  boundaryEdges.clear()

  let write = 0
  const x = vertex.x
  const y = vertex.y

  // Collect edges from triangles whose circumcircles contain the vertex.
  for (let i = 0; i < openTriangles.length; i++) {
    const triangle = openTriangles[i]

    const dx = x - triangle.cx
    const dxSq = dx * dx

    if (dx > 0 && dxSq > triangle.radiusSq) {
      // Vertices are processed left-to-right. Once a triangle's circumcircle is
      // entirely left of the current vertex, no later vertex can invalidate it.
      closedTriangles.push(triangle)
      continue
    }

    const dy = y - triangle.cy

    if (dxSq + dy * dy <= triangle.radiusSq) {
      addBoundaryEdge(boundaryEdges, triangle.v0, triangle.v1, idOf, stride)
      addBoundaryEdge(boundaryEdges, triangle.v1, triangle.v2, idOf, stride)
      addBoundaryEdge(boundaryEdges, triangle.v2, triangle.v0, idOf, stride)
    } else {
      openTriangles[write++] = triangle
    }
  }

  openTriangles.length = write

  // Add new triangles formed by the unique boundary edges and the vertex.
  for (const edge of boundaryEdges.values()) {
    if (edge.count === 1) {
      openTriangles.push(new Triangle(edge.v0, edge.v1, vertex))
    }
  }
}

function usesSuperTriangleVertex(triangle, st) {
  return triangle.v0 === st.v0 || triangle.v0 === st.v1 || triangle.v0 === st.v2 ||
    triangle.v1 === st.v0 || triangle.v1 === st.v1 || triangle.v1 === st.v2 ||
    triangle.v2 === st.v0 || triangle.v2 === st.v1 || triangle.v2 === st.v2
}

function pushNonSuperTriangles(source, st, target) {
  for (let i = 0; i < source.length; i++) {
    const triangle = source[i]

    if (!usesSuperTriangleVertex(triangle, st)) {
      target.push(triangle)
    }
  }
}

/**
 * Performs Delaunay triangulation on a set of vertices using the Bowyer-Watson algorithm.
 *
 * The algorithm:
 * - Removes duplicate x/y vertices.
 * - Sorts vertices from left to right.
 * - Starts with a large 'super triangle' encompassing all points.
 * - Inserts vertices one by one.
 * - Removes triangles whose circumcircles contain the inserted vertex.
 * - Moves triangles that can no longer be invalidated into a closed list.
 * - Re-triangulates the resulting hole with new triangles.
 * - After all vertices are added, removes any triangles connected to the super triangle.
 *
 * @param {Vector3[]} vertices - Array of vertices to triangulate.
 * @returns {Triangle[]} Array of resulting Delaunay triangles.
 */
function bowyerWatson(vertices) {
  const points = uniqueVerticesByXY(vertices)

  if (points.length < 3) {
    return []
  }

  // Create bounding 'super' triangle.
  const st = getSuperTriangle(points)
  const { idOf, stride } = makeVertexIds(points, st)

  const sortedPoints = points.slice().sort((a, b) => {
    return a.x - b.x || a.y - b.y
  })

  // Initialize triangles while adding bounding triangle.
  const openTriangles = [st]
  const closedTriangles = []
  const boundaryEdges = new Map()

  // Triangulate each vertex.
  for (let i = 0; i < sortedPoints.length; i++) {
    addVertex(sortedPoints[i], openTriangles, closedTriangles, idOf, stride, boundaryEdges)
  }

  // Remove triangles that share edges with super triangle.
  const triangles = []
  pushNonSuperTriangles(closedTriangles, st, triangles)
  pushNonSuperTriangles(openTriangles, st, triangles)

  return triangles
}

/**
 * Assigns ids to triangle vertices for Voronoi edge lookup.
 *
 * Unlike the triangulation path, this uses x/y coordinate equality so voronoi()
 * still works with triangles that were not produced by bowyerWatson() but share
 * equivalent vertex coordinates.
 *
 * @param {Triangle[]} triangles - Array of Delaunay triangles.
 * @returns {{ idOf: WeakMap<Vector3, number>, stride: number }} Vertex ids and key stride.
 */
function makeTriangleVertexIds(triangles) {
  const idOf = new WeakMap()
  const idsByXY = new Map()
  let nextId = 0

  for (let i = 0; i < triangles.length; i++) {
    const triangle = triangles[i]

    nextId = assignTriangleVertexId(triangle.v0, idOf, idsByXY, nextId)
    nextId = assignTriangleVertexId(triangle.v1, idOf, idsByXY, nextId)
    nextId = assignTriangleVertexId(triangle.v2, idOf, idsByXY, nextId)
  }

  return {
    idOf,
    stride: nextId,
  }
}

function assignTriangleVertexId(vertex, idOf, idsByXY, nextId) {
  if (idOf.has(vertex)) {
    return nextId
  }

  const key = `${vertex.x},${vertex.y}`
  let id = idsByXY.get(key)

  if (id === undefined) {
    id = nextId
    idsByXY.set(key, nextId)
    nextId += 1
  }

  idOf.set(vertex, id)
  return nextId
}

function addVoronoiAdjacency(edgeToTriangles, a, b, triangle, idOf, stride) {
  const key = edgeKeyById(a, b, idOf, stride)
  const current = edgeToTriangles.get(key)

  if (current === undefined) {
    edgeToTriangles.set(key, triangle)
  } else if (Array.isArray(current)) {
    current.push(triangle)
  } else {
    edgeToTriangles.set(key, [current, triangle])
  }
}

/**
 * Computes the Voronoi diagram from a Delaunay triangulation.
 *
 * Each Voronoi vertex corresponds to the circumcenter of a Delaunay triangle.
 * Each Voronoi edge connects circumcenters of adjacent triangles.
 *
 * @param {Triangle[]} triangles - Array of Delaunay triangles.
 * @returns {Object} An object containing:
 *    - vertices: Vector3[] (the Voronoi vertices),
 *    - edges: Array<[Vector3, Vector3]> (the Voronoi edges as pairs of circumcenters).
 */
function voronoi(triangles) {
  const voronoiVertices = new Array(triangles.length)
  const voronoiEdges = []

  // Build adjacency map: for each edge, map to the triangles that share it.
  const { idOf, stride } = makeTriangleVertexIds(triangles)
  const edgeToTriangles = new Map()

  for (let i = 0; i < triangles.length; i++) {
    const triangle = triangles[i]

    voronoiVertices[i] = triangle.center

    addVoronoiAdjacency(edgeToTriangles, triangle.v0, triangle.v1, triangle, idOf, stride)
    addVoronoiAdjacency(edgeToTriangles, triangle.v1, triangle.v2, triangle, idOf, stride)
    addVoronoiAdjacency(edgeToTriangles, triangle.v2, triangle.v0, triangle, idOf, stride)
  }

  // For each edge shared by exactly two triangles, create a Voronoi edge.
  for (const tris of edgeToTriangles.values()) {
    if (Array.isArray(tris) && tris.length === 2) {
      voronoiEdges.push([tris[0].center, tris[1].center])
    }
  }

  return {
    vertices: voronoiVertices,
    edges: voronoiEdges,
  }
}

export { bowyerWatson, Triangle, voronoi }
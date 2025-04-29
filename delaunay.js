import { Vector3 } from "./math.js"

// Delaunay Triangulation originally from: https://github.com/msavela/delaunay/
class Vertex {
  constructor(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  }

  equals(vertex) {
    return this.x === vertex.x && this.y == vertex.y && this.z == vertex.z
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
    this.edgeVec0 = new Vector3(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z)
    this.edgeVec1 = new Vector3(v2.x - v0.x, v2.y - v0.y, v2.z - v0.z)
    this.calcCircumcircle()
  }

  calcCircumcircle() {
    // Reference: http://www.faqs.org/faqs/graphics/algorithms-faq/
    // Subject 1.04: How do I generate a circle through three points?
    const [v0, v1, v2] = [this.v0, this.v1, this.v2]
    const A = v1.x - v0.x
    const B = v1.y - v0.y
    const C = v2.x - v0.x
    const D = v2.y - v0.y

    const E = A * (v0.x + v1.x) + B * (v0.y + v1.y)
    const F = C * (v0.x + v2.x) + D * (v0.y + v2.y)

    const G = 2.0 * (A * (v2.y - v1.y) - B * (v2.x - v1.x))

    if (G === 0) {
      // Collinear points: Use the midpoint of extremes as center.
      const [minx, maxx] = [Math.min(v0.x, v1.x, v2.x), Math.max(v0.x, v1.x, v2.x)]
      const [miny, maxy] = [Math.min(v0.y, v1.y, v2.y), Math.max(v0.y, v1.y, v2.y)]
      const centerX = (minx + maxx) / 2
      const centerY = (miny + maxy) / 2

      this.center = new Vertex(centerX, centerY, 0)
      this.radius = Math.sqrt((centerX - minx) ** 2 + (centerY - miny) ** 2)
    } else {
      // Calculate the circumcircle.
      const cx = (D * E - B * F) / G
      const cy = (A * F - C * E) / G

      this.center = new Vertex(cx, cy, 0)
      this.radius = Math.hypot(cx - v0.x, cy - v0.y)
    }
  }

  inCircumcircle(v) {
    const dx = this.center.x - v.x
    const dy = this.center.y - v.y
    return Math.sqrt(dx * dx + dy * dy) <= this.radius
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
 * - One vertex far to the left and above.
 * - One vertex far to the right and above.
 * 
 * This triangle is later used as the starting point for Bowyer-Watson triangulation
 * and will be discarded after all vertices are inserted.
 * 
 * @param {Vertex[]} vertices - Array of input vertices to be triangulated.
 * @returns {Triangle} A large enclosing Triangle instance.
 */
function getSuperTriangle(vertices) {
  const { minX, minY, maxX, maxY } = vertices.reduce((acc, { x, y }) => ({
    minX: Math.min(acc.minX, x),
    minY: Math.min(acc.minY, y),
    maxX: Math.max(acc.maxX, x),
    maxY: Math.max(acc.maxY, y),
  }), {
    minX: vertices[0].x,
    minY: vertices[0].y,
    maxX: vertices[0].x,
    maxY: vertices[0].y,
  })

  const dx = (maxX - minX) * 10
  const dy = (maxY - minY) * 10

  const v0 = new Vertex(minX - dx, minY - dy * 3, 0)
  const v1 = new Vertex(minX - dx, maxY + dy, 0)
  const v2 = new Vertex(maxX + dx * 3, maxY + dy, 0)

  return new Triangle(v0, v1, v2)
}

function addVertex(vertex, triangles) {
  // Collect edges from triangles whose circumcircles contain the vertex.
  const edges = []
  triangles = triangles.filter(triangle => {
    if (triangle.inCircumcircle(vertex)) {
      edges.push(
        new Edge(triangle.v0, triangle.v1),
        new Edge(triangle.v1, triangle.v2),
        new Edge(triangle.v2, triangle.v0)
      )
      return false
    }
    return true
  })

  // Create unique edges.
  const uniqueEdgesList = strictlyUniqueEdges(edges)

  // Add new triangles formed by the unique edges and the vertex.
  const newTriangles = uniqueEdgesList.map(edge => new Triangle(edge.v0, edge.v1, vertex))

  // Return the updated triangles.
  return [...triangles, ...newTriangles]
}

/**
 * Returns an array of edges that are strictly unique.
 * 
 * This faster version uses a Map to count edges based on a sorted key,
 * avoiding O(n^2) comparisons.
 * 
 * @param {Edge[]} edges - Array of Edge instances.
 * @returns {Edge[]} Array of edges that appear exactly once.
 */
function strictlyUniqueEdges(edges) {
  const edgeCount = new Map()

  edges.forEach(edge => {
    const key = edgeKey(edge)
    const entry = edgeCount.get(key)
    if (entry) {
      entry.count += 1
    } else {
      edgeCount.set(key, { edge: edge, count: 1 })
    }
  })

  // Collect only the edges that occurred exactly once
  const uniqueEdges = []
  for (const { edge, count } of edgeCount.values()) {
    if (count === 1) {
      uniqueEdges.push(edge)
    }
  }

  return uniqueEdges
}

/**
 * Performs Delaunay triangulation on a set of vertices using the Bowyer-Watson algorithm.
 * 
 * The algorithm:
 * - Starts with a large 'super triangle' encompassing all points.
 * - Inserts vertices one by one.
 * - Removes triangles whose circumcircles contain the inserted vertex.
 * - Re-triangulates the resulting hole with new triangles.
 * - After all vertices are added, removes any triangles connected to the super triangle.
 * 
 * @param {Vertex[]} vertices - Array of vertices to triangulate.
 * @returns {Triangle[]} Array of resulting Delaunay triangles.
 */
function bowyerWatson(vertices) {
  // Create bounding 'super' triangle.
  const st = getSuperTriangle(vertices)
  // Initialize triangles while adding bounding triangle.
  let triangles = [st]

  // Triangulate each vertex.
  vertices.forEach(vertex => {
    triangles = addVertex(vertex, triangles)
  })

  // Remove triangles that share edges with super triangle.
  triangles = triangles.filter(triangle => {
    return !(triangle.v0 == st.v0 || triangle.v0 == st.v1 || triangle.v0 == st.v2 ||
      triangle.v1 == st.v0 || triangle.v1 == st.v1 || triangle.v1 == st.v2 ||
      triangle.v2 == st.v0 || triangle.v2 == st.v1 || triangle.v2 == st.v2)
  })

  return triangles
}

/**
 * Computes the Voronoi diagram from a Delaunay triangulation.
 * 
 * Each Voronoi vertex corresponds to the circumcenter of a Delaunay triangle.
 * Each Voronoi edge connects circumcenters of adjacent triangles.
 * 
 * @param {Triangle[]} triangles - Array of Delaunay triangles.
 * @returns {Object} An object containing:
 *    - vertices: Vertex[] (the Voronoi vertices),
 *    - edges: Array<[Vertex, Vertex]> (the Voronoi edges as pairs of circumcenters).
 */
function voronoi(triangles) {
  const voronoiVertices = triangles.map(tri => tri.center)
  const voronoiEdges = []

  // Build adjacency map: for each edge, map to the triangles that share it
  const edgeToTriangles = new Map()

  triangles.forEach(triangle => {
    const edges = [
      new Edge(triangle.v0, triangle.v1),
      new Edge(triangle.v1, triangle.v2),
      new Edge(triangle.v2, triangle.v0)
    ]

    edges.forEach(edge => {
      let key = edgeKey(edge)
      if (!edgeToTriangles.has(key)) {
        edgeToTriangles.set(key, [])
      }
      edgeToTriangles.get(key).push(triangle)
    })
  })

  // For each edge shared by exactly two triangles, create a Voronoi edge
  for (const [key, tris] of edgeToTriangles.entries()) {
    if (tris.length === 2) {
      const [t1, t2] = tris
      voronoiEdges.push([t1.center, t2.center])
    }
  }

  return { vertices: voronoiVertices, edges: voronoiEdges }
}

/**
 * Returns a consistent key for an Edge regardless of vertex order.
 * 
 * @param {Edge} edge 
 * @returns {string} A string key for the edge.
 */
function edgeKey(edge) {
  const [a, b] = [edge.v0, edge.v1]
  if (a.x < b.x || (a.x === b.x && a.y < b.y)) {
    return `${a.x},${a.y}_${b.x},${b.y}`
  } else {
    return `${b.x},${b.y}_${a.x},${a.y}`
  }
}

export { bowyerWatson, Triangle, Vertex, voronoi }

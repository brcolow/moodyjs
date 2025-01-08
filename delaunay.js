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
  const uniqueEdgesList = uniqueEdges(edges)

  // Add new triangles formed by the unique edges and the vertex.
  const newTriangles = uniqueEdgesList.map(edge => new Triangle(edge.v0, edge.v1, vertex))

  // Return the updated triangles.
  return [...triangles, ...newTriangles]
}

function uniqueEdges(edges) {
  return edges.filter((edge, i) =>
    !edges.some((otherEdge, j) => i !== j && edge.equals(otherEdge))
  )
}

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

export { bowyerWatson, Triangle, Vertex }

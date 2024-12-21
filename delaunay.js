import { Vector3 } from "./math.js"
  
// Delaunay Triangulation from: https://github.com/msavela/delaunay/
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
    const A = this.v1.x - this.v0.x
    const B = this.v1.y - this.v0.y
    const C = this.v2.x - this.v0.x
    const D = this.v2.y - this.v0.y

    const E = A * (this.v0.x + this.v1.x) + B * (this.v0.y + this.v1.y)
    const F = C * (this.v0.x + this.v2.x) + D * (this.v0.y + this.v2.y)
 
    const G = 2.0 * (A * (this.v2.y - this.v1.y) - B * (this.v2.x - this.v1.x))

    if (G == 0) {
      // Collinear points (no circle through them exists) so: get extremes and use midpoint as center.
      const minx = Math.min(this.v0.x, this.v1.x, this.v2.x)
      const miny = Math.min(this.v0.y, this.v1.y, this.v2.y)
      const maxx = Math.max(this.v0.x, this.v1.x, this.v2.x)
      const maxy = Math.max(this.v0.y, this.v1.y, this.v2.y)

      this.center = new Vertex((minx + maxx) / 2, (miny + maxy) / 2, 0)

      const dx = this.center.x - minx
      const dy = this.center.y - miny
      this.radius = Math.sqrt(dx * dx + dy * dy);
    } else {
      const cx = (D * E - B * F) / G
      const cy = (A * F - C * E) / G

      this.center = new Vertex(cx, cy, 0)

      const dx = this.center.x - this.v0.x
      const dy = this.center.y - this.v0.y
      this.radius = Math.sqrt(dx * dx + dy * dy);
    }
  }

  inCircumcircle(v) {
    const dx = this.center.x - v.x
    const dy = this.center.y - v.y
    return Math.sqrt(dx * dx + dy * dy) <= this.radius
  }

  surfaceNormal() {
    return this.edgeVec1.cross(this.edgeVec0)
  }
}

function getSuperTriangle(vertices) {
  // Initialize with first vertex.
  let minX = vertices[0].x
  let minY = vertices[0].y
  let maxX = vertices[0].x
  let maxY = vertices[0].y

  // Loop through remaining vertices to find min/max.
  for (let i = 1; i < vertices.length; i++) {
    const vertex = vertices[i]
    minX = Math.min(minX, vertex.x)
    minY = Math.min(minY, vertex.y)
    maxX = Math.max(maxX, vertex.x)
    maxY = Math.max(maxY, vertex.y)
  }

  const dx = (maxX - minX) * 10
  const dy = (maxY - minY) * 10

  const v0 = new Vertex(minX - dx, minY - dy * 3, 0)
  const v1 = new Vertex(minX - dx, maxY + dy, 0)
  const v2 = new Vertex(maxX + dx * 3, maxY + dy, 0)

  return new Triangle(v0, v1, v2)
}

function addVertex(vertex, triangles) {
  let edges = []

  // Remove triangles with circumcircles containing the vertex.
  triangles = triangles.filter(triangle => {
    if (triangle.inCircumcircle(vertex)) {
      edges.push(new Edge(triangle.v0, triangle.v1))
      edges.push(new Edge(triangle.v1, triangle.v2))
      edges.push(new Edge(triangle.v2, triangle.v0))
      return false
    }
    return true
  })

  // Get unique edges.
  edges = uniqueEdges(edges)

  // Create new triangles from the unique edges and new vertex.
  edges.forEach(edge => {
    triangles.push(new Triangle(edge.v0, edge.v1, vertex))
  })

  return triangles
}

function uniqueEdges(edges) {
  const uniqueEdges = []
  for (let i = 0; i < edges.length; ++i) {
    let isUnique = true

    // See if edge is unique.
    for (let j = 0; j < edges.length; ++j) {
      if (i != j && edges[i].equals(edges[j])) {
        isUnique = false
        break
      }
    }

    // Edge is unique, add to unique edges array.
    isUnique && uniqueEdges.push(edges[i])
  }

  return uniqueEdges
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

export { bowyerWatson, Vertex }

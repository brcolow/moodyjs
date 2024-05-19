class Vector3 {
    constructor(x, y, z) {
      this.x = x
      this.y = y
      this.z = z
    }
  
    cross(v) {
      return new Vector3(
        this.y * v.z - this.z * v.y,
        this.z * v.x - this.x * v.z,
        this.x * v.y - this.y * v.x)
    }
  
    minus(v) {
      return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z)
    } 

    dot(v) {
      return this.x * v.x + this.y * v.y + this.z * v.z
    }
  
    norm() {
      const length = this.length()
      return new Vector3(this.x / length, this.y / length, this.z / length)
    }

    scale(a) {
      return this.x * a + this.y * a + this.z * a
    }

    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
    }
}
  
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
  
      let dx, dy
  
      // Collinear points, get extremes and use midpoint as center
      if (Math.round(Math.abs(G)) == 0) {
        const minx = Math.min(this.v0.x, this.v1.x, this.v2.x)
        const miny = Math.min(this.v0.y, this.v1.y, this.v2.y)
        const maxx = Math.max(this.v0.x, this.v1.x, this.v2.x)
        const maxy = Math.max(this.v0.y, this.v1.y, this.v2.y)
  
        this.center = new Vertex((minx + maxx) / 2, (miny + maxy) / 2, 0)
  
        dx = this.center.x - minx
        dy = this.center.y - miny
      } else {
        const cx = (D * E - B * F) / G
        const cy = (A * F - C * E) / G
  
        this.center = new Vertex(cx, cy, 0)
  
        dx = this.center.x - this.v0.x
        dy = this.center.y - this.v0.y
      }
      this.radius = Math.sqrt(dx * dx + dy * dy)
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
    let minx = Infinity
    let miny = Infinity
  
    let maxx = -Infinity
    let maxy = -Infinity
    vertices.forEach(vertex => {
      minx = Math.min(minx, vertex.x)
      miny = Math.min(minx, vertex.y)
      maxx = Math.max(maxx, vertex.x)
      maxy = Math.max(maxx, vertex.y)
    })
  
    const dx = (maxx - minx) * 10
    const dy = (maxy - miny) * 10
  
    const v0 = new Vertex(minx - dx, miny - dy * 3, 0)
    const v1 = new Vertex(minx - dx, maxy + dy, 0)
    const v2 = new Vertex(maxx + dx * 3, maxy + dy, 0)
  
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
    let st = getSuperTriangle(vertices)
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

export { bowyerWatson, Vector3, Vertex }

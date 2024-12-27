// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV
const EPSILON = 0.000001

class Vector2 extends Float32Array {
  constructor(...values) {
    switch(values.length) {
      case 2: {
        const v = values[0]
        if (typeof v === 'number') {
          super([v, values[1]])
        } else {
          super(v, values[1], 2)
        }
        break;
      }
      case 1: {
        const v = values[0]
        if (typeof v === 'number') {
          super([v, v])
        } else {
          super(v, 0, 2)
        }
        break
      }
      default:
        super(2)
        break
    }
  }

  get x() { return this[0]; }
  get y() { return this[1]; }
}

class Vector3 extends Float32Array {
  constructor(...values) {
    switch(values.length) {
      case 3:
        super(values)
        break
      case 2:
        super(values[0], values[1], 3)
        break
      case 1: {
        const v = values[0]
        if (typeof v === 'number') {
          super([v, v, v])
        } else {
          super(v, 0, 3)
        }
        break
      }
      default:
        super(3)
        break
    }
  }

  equals(b) {
    return Vector3.equals(this, this, b)
  }

  static equals(a, b) {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const b0 = b[0]
    const b1 = b[1]
    const b2 = b[2]
    return (
      Math.abs(a0 - b0) <= EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
      Math.abs(a1 - b1) <= EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
      Math.abs(a2 - b2) <= EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)))
  }

  get x() { return this[0] }
  get y() { return this[1] }
  get z() { return this[2] }

  cross(v) {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x)
  }

  static cross(out, a, b) {
    const ax = a[0],
      ay = a[1],
      az = a[2]
    const bx = b[0],
      by = b[1],
      bz = b[2]

    out[0] = ay * bz - az * by
    out[1] = az * bx - ax * bz
    out[2] = ax * by - ay * bx
    return out
  }

  add(b) {
    return Vector3.add(this, this, b)
  }

  static add(out, a, b) {
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]
    out[2] = a[2] + b[2]
    return out
  }

  dot(b) {
    return Vector3.dot(this, this, b)
  }

  static dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  }

  static norm(out, a) {
    const x = a[0]
    const y = a[1]
    const z = a[2]
    let len = x * x + y * y + z * z
    if (len > 0) {
      len = 1 / Math.sqrt(len)
    }
    out[0] = a[0] * len
    out[1] = a[1] * len
    out[2] = a[2] * len
    return out
  }

  norm() {
    return Vector3.norm(this, this)
  }

  static scale(out, a, scale) {
    out[0] = a[0] * scale
    out[1] = a[1] * scale
    out[2] = a[2] * scale
    return out
  }

  scale(a, scale) {
    return Vector3.scale(this, a, scale)
  }

  static magnitude(a) {
    const x = a[0]
    const y = a[1]
    const z = a[2]
    return Math.sqrt(x * x + y * y + z * z)
  }

  get magnitude() {
    return Vector3.magnitude(this)
  }
}

const IDENTITY_4X4 = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])

class Mat4 extends Float32Array {
  constructor(...values) {
    switch (values.length) {
      case 16:
        super(values)
        break
      default:
        super(IDENTITY_4X4)
        break
    }
  }

  // Creates a new identity 4x4 Matrix.
  static create() {
    return new Mat4()
  }

  scale(v) {
    return Mat4.scale(this, this, v)
  }

  static scale(out, a, v) {
    const x = v[0]
    const y = v[1]

    out[0] = x * a[0]
    out[1] = x * a[1]
    out[2] = x * a[2]

    out[3] = y * a[3]
    out[4] = y * a[4]
    out[5] = y * a[5]

    out[6] = a[6]
    out[7] = a[7]
    out[8] = a[8]
    return out
  }

  multiply(b) {
    return Mat4.multiply(this, this, b)
  }

  static multiply(out, a, b) {
    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]
    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]
    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]
    const a30 = a[12]
    const a31 = a[13]
    const a32 = a[14]
    const a33 = a[15]

    // Cache only the current line of the second matrix
    let b0 = b[0]
    let b1 = b[1]
    let b2 = b[2]
    let b3 = b[3]
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[4]
    b1 = b[5]
    b2 = b[6]
    b3 = b[7]
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[8]
    b1 = b[9]
    b2 = b[10]
    b3 = b[11]
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33

    b0 = b[12]
    b1 = b[13]
    b2 = b[14]
    b3 = b[15]
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
    return out
  }

  invert() {
    return Mat4.invert(this, this)
  }

  static invert(out, a) {
    const a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3]
    const a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7]
    const a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11]
    const a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15]

    const b00 = a00 * a11 - a01 * a10
    const b01 = a00 * a12 - a02 * a10
    const b02 = a00 * a13 - a03 * a10
    const b03 = a01 * a12 - a02 * a11
    const b04 = a01 * a13 - a03 * a11
    const b05 = a02 * a13 - a03 * a12
    const b06 = a20 * a31 - a21 * a30
    const b07 = a20 * a32 - a22 * a30
    const b08 = a20 * a33 - a23 * a30
    const b09 = a21 * a32 - a22 * a31
    const b10 = a21 * a33 - a23 * a31
    const b11 = a22 * a33 - a23 * a32

    // Calculate the determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06

    if (!det) {
      return null
    }
    det = 1.0 / det

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det

    return out
  }

  transpose() {
    return Mat4.transpose(this, this)
  }

  static transpose(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
      const a01 = a[1],
        a02 = a[2],
        a03 = a[3]
      const a12 = a[6],
        a13 = a[7]
      const a23 = a[11]

      out[1] = a[4]
      out[2] = a[8]
      out[3] = a[12]
      out[4] = a01
      out[6] = a[9]
      out[7] = a[13]
      out[8] = a02
      out[9] = a12
      out[11] = a[14]
      out[12] = a03
      out[13] = a13
      out[14] = a23
    } else {
      out[0] = a[0]
      out[1] = a[4]
      out[2] = a[8]
      out[3] = a[12]
      out[4] = a[1]
      out[5] = a[5]
      out[6] = a[9]
      out[7] = a[13]
      out[8] = a[2]
      out[9] = a[6]
      out[10] = a[10]
      out[11] = a[14]
      out[12] = a[3]
      out[13] = a[7]
      out[14] = a[11]
      out[15] = a[15]
    }

    return out
  }

  // WebGL/OpenGL compat (z range [-1, 1])
  perspective(fovy, aspect, near, far) {
    return Mat4.perspective(this, fovy, aspect, near, far)
  }

  // WebGL/OpenGL compat (z range [-1, 1])
  static perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2)
    out[0] = f / aspect
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 0
    out[5] = f
    out[6] = 0
    out[7] = 0
    out[8] = 0
    out[9] = 0
    out[11] = -1
    out[12] = 0
    out[13] = 0
    out[15] = 0
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far)
      out[10] = (far + near) * nf
      out[14] = 2 * far * near * nf
    } else {
      out[10] = -1
      out[14] = -2 * near
    }
    return out
  }

  rotate(rad, axis) {
    return Mat4.rotate(this, this, rad, axis)
  }

  static rotate(out, a, rad, axis) {
    let x = axis[0]
    let y = axis[1]
    let z = axis[2]
    let len = Math.sqrt(x * x + y * y + z * z)

    if (len < EPSILON) {
      return null
    }

    len = 1 / len
    x *= len
    y *= len
    z *= len

    const s = Math.sin(rad)
    const c = Math.cos(rad)
    const t = 1 - c

    const a00 = a[0]
    const a01 = a[1]
    const a02 = a[2]
    const a03 = a[3]
    const a10 = a[4]
    const a11 = a[5]
    const a12 = a[6]
    const a13 = a[7]
    const a20 = a[8]
    const a21 = a[9]
    const a22 = a[10]
    const a23 = a[11]

    // Construct the elements of the rotation matrix
    const b00 = x * x * t + c
    const b01 = y * x * t + z * s
    const b02 = z * x * t - y * s
    const b10 = x * y * t - z * s
    const b11 = y * y * t + c
    const b12 = z * y * t + x * s
    const b20 = x * z * t + y * s
    const b21 = y * z * t - x * s
    const b22 = z * z * t + c

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02
    out[1] = a01 * b00 + a11 * b01 + a21 * b02
    out[2] = a02 * b00 + a12 * b01 + a22 * b02
    out[3] = a03 * b00 + a13 * b01 + a23 * b02
    out[4] = a00 * b10 + a10 * b11 + a20 * b12
    out[5] = a01 * b10 + a11 * b11 + a21 * b12
    out[6] = a02 * b10 + a12 * b11 + a22 * b12
    out[7] = a03 * b10 + a13 * b11 + a23 * b12
    out[8] = a00 * b20 + a10 * b21 + a20 * b22
    out[9] = a01 * b20 + a11 * b21 + a21 * b22
    out[10] = a02 * b20 + a12 * b21 + a22 * b22
    out[11] = a03 * b20 + a13 * b21 + a23 * b22

    if (a !== out) {
      // If the source and destination differ, copy the unchanged last row
      out[12] = a[12]
      out[13] = a[13]
      out[14] = a[14]
      out[15] = a[15]
    }
    return out
  }

  translate(v) {
    return Mat4.translate(this, this, v)
  }

  static translate(out, a, v) {
    const x = v[0]
    const y = v[1]
    const z = v[2]

    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12]
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13]
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14]
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15]
    } else {
      const a00 = a[0]
      const a01 = a[1]
      const a02 = a[2]
      const a03 = a[3]
      const a10 = a[4]
      const a11 = a[5]
      const a12 = a[6]
      const a13 = a[7]
      const a20 = a[8]
      const a21 = a[9]
      const a22 = a[10]
      const a23 = a[11]

      out[0] = a00
      out[1] = a01
      out[2] = a02
      out[3] = a03
      out[4] = a10
      out[5] = a11
      out[6] = a12
      out[7] = a13
      out[8] = a20
      out[9] = a21
      out[10] = a22
      out[11] = a23

      out[12] = a00 * x + a10 * y + a20 * z + a[12]
      out[13] = a01 * x + a11 * y + a21 * z + a[13]
      out[14] = a02 * x + a12 * y + a22 * z + a[14]
      out[15] = a03 * x + a13 * y + a23 * z + a[15]
    }

    return out
  }
}

// https://github.com/toji/gl-matrix/blob/glmatrix-next/src/quat.ts

class Quat extends Float32Array {
  constructor(...values) {
    switch(values.length) {
      case 4:
        super(values)
        break
      case 2:
        super(values[0], values[1], 4)
        break
      case 1: {
        const v = values[0]
        if (typeof v === 'number') {
          super([v, v, v, v])
        } else {
          super(v, 0, 4)
        }
        break
      }
      default:
        super(4)
        this[3] = 1
        break
    }
  }

  static create() {
    return new Quat()
  }

  static identity() {
    return new Quat(1, 0, 0, 0)
  }

  multiply(b) {
    return Quat.multiply(this, this, b)
  }

  static multiply(out, a, b) {
    const ax = a[0]
    const ay = a[1]
    const az = a[2]
    const aw = a[3]
    const bx = b[0]
    const by = b[1]
    const bz = b[2]
    const bw = b[3]

    out[0] = ax * bw + aw * bx + ay * bz - az * by
    out[1] = ay * bw + aw * by + az * bx - ax * bz
    out[2] = az * bw + aw * bz + ax * by - ay * bx
    out[3] = aw * bw - ax * bx - ay * by - az * bz
    return out
  }

  static normalize(out, a) {
    const il = 1 / Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3])
    out[0] = a[0] * il
    out[1] = a[1] * il
    out[2] = a[2] * il
    out[3] = a[3] * il
  }

  toMatrix4() {
    const invSqrt = 1 / Math.sqrt(this[0] * this[0] + this[1] * this[1] + this[2] * this[2] + this[3] * this[3])
    const w = this[0] * invSqrt
    const x = this[1] * invSqrt
    const y = this[2] * invSqrt
    const z = this[3] * invSqrt

    const wx = w * x, wy = w * y, wz = w * z;
    const xx = x * x, xy = x * y, xz = x * z;
    const yy = y * y, yz = y * z, zz = z * z;

    return new Mat4(
      1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 0,
      2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 0,
      2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy), 0,
      0, 0, 0, 1)
  }

  yUnitVec3 = new Float32Array([0, 1, 0])
  xUnitVec3 = new Float32Array([1, 0, 0])
  tmpVec3 = new Float32Array(3)
}

export { Mat4, Quat, Vector3 }

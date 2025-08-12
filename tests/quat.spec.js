// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV

import { expect, describe, it, beforeEach } from 'vitest'
import { Mat4, Quat, Vector3 } from '../math'
import "./test-utils"

describe("Quat", () => {
  describe("constructor", () => {
    it("should return Quat(0, 0, 0, 1) if called with no arguments", () => {
      expect(new Quat()).toBeVec(0, 0, 0, 1)
    })

    it("should return Quat(x, y, z, w) if called with (x, y, z, w)", () => {
      expect(new Quat(1, 2, 3, 4)).toBeVec(1, 2, 3, 4)
      expect(new Quat(-3, 4.4, -5.6, 7.8)).toBeVec(-3, 4.4, -5.6, 7.8)
    })

    it("should return Quat(x, x, x, x) if called with (x)", () => {
      expect(new Quat(1)).toBeVec(1, 1, 1, 1)
      expect(new Quat(-2.3)).toBeVec(-2.3, -2.3, -2.3, -2.3)
    })

    it("should return Quat(x, y, z, w) if called with ([x, y, z, w])", () => {
      expect(new Quat([1, 2, 3, 4])).toBeVec(1, 2, 3, 4)
      expect(new Quat([-3, 4.4, -5.6, 7.8])).toBeVec(-3, 4.4, -5.6, 7.8)
    })

    it("should return Quat(x, y, z, w) if called with (Quat(x, y, z, w))", () => {
      let v = new Quat(3.4, 5.6, 7.8, 9)
      expect(new Quat(v)).toBeVec(v)
    })

    it("should return Quat(x, y, z, w) if called with (Float32Array([x, y, z, w]))", () => {
      let arr = new Float32Array([1.2, 3.4, 5.6, 7.8])
      expect(new Quat(arr)).toBeVec(arr)
    })
  })

  describe("static", () => {
    let out, quatA, quatB, result, vec

    const id = new Quat(0, 0, 0, 1)
    const deg90 = Math.PI / 2

    beforeEach(() => {
      quatA = new Quat(1, 2, 3, 4)
      quatB = new Quat(5, 6, 7, 8)
      out = new Quat(0, 0, 0, 0)
      vec = [1, 1, -1]
    })

    describe("create", () => {
      beforeEach(() => { result = Quat.create() })
      it("should return a 4 element array initialized to an identity quaternion", () => { expect(result).toBeVec(0, 0, 0, 1) })
    })

    describe("identity", () => {
      beforeEach(() => { result = Quat.identity(out) })
      it("should place values into out", () => { expect(result).toBeVec(0, 0, 0, 1) })
      it("should return out", () => { expect(result).toBe(out) })
    })

    describe("multiply", () => {
      describe("with a separate output quaternion", () => {
        beforeEach(() => { result = Quat.multiply(out, quatA, quatB) })

        it("should place values into out", () => { expect(out).toBeVec(24, 48, 48, -6) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify quatA", () => { expect(quatA).toBeVec(1, 2, 3, 4) })
        it("should not modify quatB", () => { expect(quatB).toBeVec(5, 6, 7, 8) })
      })

      describe("when quatA is the output quaternion", () => {
        beforeEach(() => { result = Quat.multiply(quatA, quatA, quatB) })

        it("should place values into quatA", () => { expect(quatA).toBeVec(24, 48, 48, -6) })
        it("should return quatA", () => { expect(result).toBe(quatA) })
        it("should not modify quatB", () => { expect(quatB).toBeVec(5, 6, 7, 8) })
      })

      describe("when quatB is the output quaternion", () => {
        beforeEach(() => { result = Quat.multiply(quatB, quatA, quatB) })

        it("should place values into quatB", () => { expect(quatB).toBeVec(24, 48, 48, -6) })
        it("should return quatB", () => { expect(result).toBe(quatB) })
        it("should not modify quatA", () => { expect(quatA).toBeVec(1, 2, 3, 4) })
      })
    })

    describe("normalize", () => {
      beforeEach(() => { quatA = [5, 0, 0, 0] })

      describe("with a separate output quaternion", () => {
        beforeEach(() => { result = Quat.normalize(out, quatA) })

        it("should place values into out", () => { expect(out).toBeVec(1, 0, 0, 0) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify quatA", () => { expect(quatA).toBeVec(5, 0, 0, 0) })
      })

      describe("when quatA is the output quaternion", () => {
        beforeEach(() => { result = Quat.normalize(quatA, quatA) })

        it("should place values into quatA", () => { expect(quatA).toBeVec(1, 0, 0, 0) })
        it("should return quatA", () => { expect(result).toBe(quatA) })
      })
    })
    describe("slerp", () => {
      describe("the normal case", () => {
        beforeEach(() => {
          result = Quat.slerp(out, [0, 0, 0, 1], [0, 1, 0, 0], 0.5)
        })

        it("should return out", () => { expect(result).toBe(out) })
        it("should calculate proper quat", () => {
          expect(result).toBeVec(0, 0.707106, 0, 0.707106)
        })
      })

      describe("where a == b", () => {
        beforeEach(() => {
          result = Quat.slerp(out, [0, 0, 0, 1], [0, 0, 0, 1], 0.5)
        })

        it("should return out", () => { expect(result).toBe(out) })
        it("should calculate proper quat", () => {
          expect(result).toBeVec(0, 0, 0, 1)
        })
      })

      describe("where theta == 180deg", () => {

        beforeEach(() => {
          // We don't implement Quat.rotateX so copy it here for this test.
          let rotateX = (out, a, rad) => {
            rad *= 0.5

            const ax = a[0]
            const ay = a[1]
            const az = a[2]
            const aw = a[3]
            const bx = Math.sin(rad)
            const bw = Math.cos(rad)

            out[0] = ax * bw + aw * bx
            out[1] = ay * bw + az * bx
            out[2] = az * bw - ay * bx
            out[3] = aw * bw - ax * bx
            return out
          }
          rotateX(quatA, [1, 0, 0, 0], Math.PI) // 180 deg
          result = Quat.slerp(out, [1, 0, 0, 0], quatA, 1)
        })

        it("should calculate proper quat", () => {
          expect(result).toBeVec(0, 0, 0, -1)
        })
      })

      describe("where a == -b", () => {
        beforeEach(() => {
          result = Quat.slerp(out, [1, 0, 0, 0], [-1, 0, 0, 0], 0.5)
        })

        it("should return out", () => { expect(result).toBe(out) })
        it("should calculate proper quat", () => {
          expect(result).toBeVec(1, 0, 0, 0)
        })
      })
    })
  })

  /**
   * @description These tests assume a right-handed coordinate system.
   * The rotations are defined as a clockwise rotation when looking
   * down the axis of rotation toward the origin.
   */
  describe("toMatrix4", () => {
    let quatA

    beforeEach(() => {
      quatA = Quat.create(0, 0, 0, 1)
    })

    it("should create a correct rotation matrix for a quaternion representing no rotation", () => {
      const matrix = quatA.toMatrix4()
      expect(matrix).toBeVec(
        -1, 0, 0, 0,
        0, -1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      )
    })

    it("should create an identity matrix for a quaternion representing no rotation", () => {
      // Identity quaternion
      quatA = Quat.create(1, 0, 0, 0)
      const matrix = quatA.toMatrix4()
      // Expected identity matrix
      expect(matrix).toBeVec(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      )
    })

    it("should create a correct rotation matrix for a quaternion representing a rotation around X-axis", () => {
      // Correct quaternion for a 90-degree rotation around the X-axis (w, x, y, z)
      quatA = Quat.create(Math.sqrt(0.5), Math.sqrt(0.5), 0, 0)
      const matrix = quatA.toMatrix4()
      // Expected matrix for a 90-degree clockwise rotation around X-axis
      expect(matrix).toBeVec(
        1, 0, 0, 0,
        0, 0, 1, 0,
        0, -1, 0, 0,
        0, 0, 0, 1
      )
    })

    it("should create a correct rotation matrix for a quaternion representing a rotation around Y-axis", () => {
      // Correct quaternion for a 90-degree rotation around the Y-axis (w, x, y, z)
      quatA = Quat.create(Math.sqrt(0.5), 0, Math.sqrt(0.5), 0)
      const matrix = quatA.toMatrix4()
      // Expected matrix for a 90-degree clockwise rotation around Y-axis
      expect(matrix).toBeVec(
        0, 0, -1, 0,
        0, 1, 0, 0,
        1, 0, 0, 0,
        0, 0, 0, 1
      )
    })

    it("should create a correct rotation matrix for a quaternion representing a rotation around Z-axis", () => {
      // Correct quaternion for a 90-degree rotation around the Z-axis (w, x, y, z)
      quatA = Quat.create(Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
      const matrix = quatA.toMatrix4()
      // Expected matrix for a 90-degree clockwise rotation around Z-axis
      expect(matrix).toBeVec(
        0, 1, 0, 0,
        -1, 0, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      )
    })

    it("should create a correct rotation matrix for a 180-degree rotation around X-axis", () => {
      // Quaternion for a 180-degree rotation around X-axis
      quatA = Quat.create(0, 1, 0, 0)
      const matrix = quatA.toMatrix4()
      // Expected matrix for a 180-degree rotation around X-axis
      expect(matrix).toBeVec(
        1, 0, 0, 0,
        0, -1, 0, 0,
        0, 0, -1, 0,
        0, 0, 0, 1
      )
    })
  })
})
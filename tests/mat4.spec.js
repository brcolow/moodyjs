// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV

import { expect, describe, it, beforeEach } from 'vitest'
import { Mat4, Vector3 } from '../math'
import "./test-utils"

describe("Mat4", () => {
  let out, matA, matB, identity, result

  describe("constructor", () => {
    it("should return an identity Mat4 if called with no arguments", () => {
      expect(new Mat4()).toBeVec(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1)
    })

    it("should return Mat4(m0, m1, ...m15) if called with (m0, m1, ...m15)", () => {
      expect(new Mat4(
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16)).toBeVec(
          1, 2, 3, 4,
          5, 6, 7, 8,
          9, 10, 11, 12,
          13, 14, 15, 16)
    })

    it("should return Mat4(x, x, x) if called with (x)", () => {
      expect(new Mat4(1)).toBeVec(
        1, 1, 1, 1,
        1, 1, 1, 1,
        1, 1, 1, 1,
        1, 1, 1, 1)
    })

    it("should return Mat4(m0, m1, ...m15) if called with ([m0, m1, ...m15])", () => {
      expect(new Mat4([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16])).toBeVec(
          1, 2, 3, 4,
          5, 6, 7, 8,
          9, 10, 11, 12,
          13, 14, 15, 16)
    })

    it("should return Mat4(m0, m1, ...m15) if called with (Mat4(m0, m1, ...m15))", () => {
      let v = new Mat4(
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16)
      expect(new Mat4(v)).toBeVec(v)
    })

    it("should return Mat4(m0, m1, ...m15) if called with (Float32Array([m0, m1, ...m15]))", () => {
      let arr = new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16])
      expect(new Mat4(arr)).toBeVec(arr)
    })
  })

  describe("static", () => {

    beforeEach(() => {
      // Attempting to portray a semi-realistic transform matrix
      matA = new Float32Array([1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        1, 2, 3, 1])

      matB = new Float32Array([1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        4, 5, 6, 1])

      out = new Float32Array([0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0])

      identity = new Float32Array([1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1])
    })
    describe("create", () => {
      beforeEach(() => { result = Mat4.create() })
      it("should return a 16 element array initialized to a 4x4 identity matrix", () => { expect(result).toBeVec(identity) })
    })


    describe("scale", () => {
      describe("with a separate output matrix", () => {
        beforeEach(() => { result = Mat4.scale(out, matA, [4, 5, 6]) })

        it("should place values into out", () => {
          expect(out).toBeVec(
            4, 0, 0, 0,
            0, 5, 0, 0,
            0, 0, 6, 0,
            1, 2, 3, 1
          )
        })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
      })

      describe("when matA is the output matrix", () => {
        beforeEach(() => { result = Mat4.scale(matA, matA, [4, 5, 6]) })

        it("should place values into matA", () => {
          expect(matA).toBeVec(
            4, 0, 0, 0,
            0, 5, 0, 0,
            0, 0, 6, 0,
            1, 2, 3, 1
          )
        })
        it("should return matA", () => { expect(result).toBe(matA) })
      })
    })

    describe("multiply", () => {
      describe("with a separate output matrix", () => {
        beforeEach(() => { result = Mat4.multiply(out, matA, matB) })

        it("should place values into out", () => {
          expect(out).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            5, 7, 9, 1
          )
        })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
        it("should not modify matB", () => {
          expect(matB).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            4, 5, 6, 1
          )
        })
      })

      describe("when matA is the output matrix", () => {
        beforeEach(() => { result = Mat4.multiply(matA, matA, matB) })

        it("should place values into matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            5, 7, 9, 1
          )
        })
        it("should return matA", () => { expect(result).toBe(matA) })
        it("should not modify matB", () => {
          expect(matB).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            4, 5, 6, 1
          )
        })
      })

      describe("when matB is the output matrix", () => {
        beforeEach(() => { result = Mat4.multiply(matB, matA, matB) })

        it("should place values into matB", () => {
          expect(matB).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            5, 7, 9, 1
          )
        })
        it("should return matB", () => { expect(result).toBe(matB) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
      })
    })

    describe("invert", () => {
      describe("with a separate output matrix", () => {
        beforeEach(() => { result = Mat4.invert(out, matA) })

        it("should place values into out", () => {
          expect(out).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            -1, -2, -3, 1
          )
        })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
      })

      describe("when matA is the output matrix", () => {
        beforeEach(() => { result = Mat4.invert(matA, matA) })

        it("should place values into matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            -1, -2, -3, 1
          )
        })
        it("should return matA", () => { expect(result).toBe(matA) })
      })
    })

    describe("transpose", () => {
      describe("with a separate output matrix", () => {
        beforeEach(() => { result = Mat4.transpose(out, matA) })

        it("should place values into out", () => {
          expect(out).toBeVec(
            1, 0, 0, 1,
            0, 1, 0, 2,
            0, 0, 1, 3,
            0, 0, 0, 1
          )
        })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
      })

      describe("when matA is the output matrix", () => {
        beforeEach(() => { result = Mat4.transpose(matA, matA) })

        it("should place values into matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 1,
            0, 1, 0, 2,
            0, 0, 1, 3,
            0, 0, 0, 1
          )
        })
        it("should return matA", () => { expect(result).toBe(matA) })
      })
    })

    describe("perspective", () => {
      it("should have an alias called 'perspective'", () => { expect(Mat4.perspective).toEqual(Mat4.perspective) })

      let fovy = Math.PI * 0.5
      beforeEach(() => { result = Mat4.perspective(out, fovy, 1, 0, 1) })
      it("should place values into out", () => {
        expect(result).toBeVec(
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, -1, -1,
          0, 0, 0, 0
        )
      })
      it("should return out", () => { expect(result).toBe(out) })

      describe("with nonzero near, 45deg fovy, and realistic aspect ratio", () => {
        beforeEach(() => { result = Mat4.perspective(out, 45 * Math.PI / 180.0, 640 / 480, 0.1, 200) })
        it("should calculate correct matrix", () => {
          expect(result).toBeVec(
            1.81066, 0, 0, 0,
            0, 2.414213, 0, 0,
            0, 0, -1.001, -1,
            0, 0, -0.2001, 0
          )
        })
      })

      describe("with no far plane, 45deg fovy, and realistic aspect ratio", () => {
        beforeEach(() => { result = Mat4.perspective(out, 45 * Math.PI / 180.0, 640 / 480, 0.1) })
        it("should calculate correct matrix", () => {
          expect(result).toBeVec(
            1.81066, 0, 0, 0,
            0, 2.414213, 0, 0,
            0, 0, -1, -1,
            0, 0, -0.2, 0
          )
        })
      })

      describe("with infinite far plane, 45deg fovy, and realistic aspect ratio", () => {
        beforeEach(() => { result = Mat4.perspective(out, 45 * Math.PI / 180.0, 640 / 480, 0.1, Infinity) })
        it("should calculate correct matrix", () => {
          expect(result).toBeVec(
            1.81066, 0, 0, 0,
            0, 2.414213, 0, 0,
            0, 0, -1, -1,
            0, 0, -0.2, 0
          )
        })
      })
    })

    describe("rotate", () => {
      let rad = Math.PI * 0.5
      let axis = [1, 0, 0]

      describe("with a separate output matrix", () => {
        beforeEach(() => { result = Mat4.rotate(out, matA, rad, axis) })

        it("should place values into out", () => {
          expect(out).toBeVec(
            1, 0, 0, 0,
            0, Math.cos(rad), Math.sin(rad), 0,
            0, -Math.sin(rad), Math.cos(rad), 0,
            1, 2, 3, 1
          )
        })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
      })

      describe("when matA is the output matrix", () => {
        beforeEach(() => { result = Mat4.rotate(matA, matA, rad, axis) })

        it("should place values into matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, Math.cos(rad), Math.sin(rad), 0,
            0, -Math.sin(rad), Math.cos(rad), 0,
            1, 2, 3, 1
          )
        })
        it("should return matA", () => { expect(result).toBe(matA) })
      })
    })

    describe("translate", () => {
      describe("with a separate output matrix", () => {
        beforeEach(() => { result = Mat4.translate(out, matA, [4, 5, 6]) })

        it("should place values into out", () => {
          expect(out).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            5, 7, 9, 1
          )
        })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1, 2, 3, 1
          )
        })
      })

      describe("when matA is the output matrix", () => {
        beforeEach(() => { result = Mat4.translate(matA, matA, [4, 5, 6]) })

        it("should place values into matA", () => {
          expect(matA).toBeVec(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            5, 7, 9, 1
          )
        })
        it("should return matA", () => { expect(result).toBe(matA) })
      })
    })
  })
})
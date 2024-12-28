// From glMatrix v4.
// https://github.com/toji/gl-matrix/tree/glmatrix-next
// Copyright 2022 Brandon Jones, Colin MacKenzie IV

import { expect, describe, it, beforeEach } from 'vitest'
import { Vector3 } from '../math'
import "./test-utils"

describe("Vector3", () => {
  let out
  let vecA
  let vecB
  let result

  describe("constructor", () => {
    it("should return Vector3(0, 0, 0) if called with no arguments", () => {
      expect(new Vector3()).toBeVec(0, 0, 0)
    })

    it("should return Vector3(x, y, z) if called with (x, y, z)", () => {
      expect(new Vector3(1, 2, 3)).toBeVec(1, 2, 3)
      expect(new Vector3(-3, 4.4, -5.6)).toBeVec(-3, 4.4, -5.6)
    })

    it("should return Vector3(x, x, x) if called with (x)", () => {
      expect(new Vector3(1)).toBeVec(1, 1, 1)
      expect(new Vector3(-2.3)).toBeVec(-2.3, -2.3, -2.3)
    })

    it("should return Vector3(x, y, z) if called with ([x, y, z])", () => {
      expect(new Vector3([1, 2, 3])).toBeVec(1, 2, 3)
      expect(new Vector3([-3, 4.4, -5.6])).toBeVec(-3, 4.4, -5.6)
    })

    it("should return Vector3(x, y, z) if called with (Vec3(x, y, z))", () => {
      let v = new Vector3(3.4, 5.6, 7.8)
      expect(new Vector3(v)).toBeVec(v)
    })

    it("should return Vector3(x, y, z) if called with (Float32Array([x, y, z]))", () => {
      let arr = new Float32Array([1.2, 3.4, 5.6])
      expect(new Vector3(arr)).toBeVec(arr)
    })
  })

  describe("static", () => {
    beforeEach(() => {
      vecA = new Vector3(1, 2, 3)
      vecB = new Vector3(4, 5, 6)
      out = new Vector3(0, 0, 0)
    })

    describe("create", () => {
      beforeEach(() => { result = Vector3.create() })
      it("should return a 3 element array initialized to 0s", () => { expect(result).toBeVec(0, 0, 0) })
    })

    describe("add", () => {
      describe("with a separate output vector", () => {
        beforeEach(() => { result = Vector3.add(out, vecA, vecB) })

        it("should place values into out", () => { expect(out).toBeVec(5, 7, 9) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify vecA", () => { expect(vecA).toBeVec(1, 2, 3) })
        it("should not modify vecB", () => { expect(vecB).toBeVec(4, 5, 6) })
      })

      describe("when vecA is the output vector", () => {
        beforeEach(() => { result = Vector3.add(vecA, vecA, vecB) })

        it("should place values into vecA", () => { expect(vecA).toBeVec(5, 7, 9) })
        it("should return vecA", () => { expect(result).toBe(vecA) })
        it("should not modify vecB", () => { expect(vecB).toBeVec(4, 5, 6) })
      })

      describe("when vecB is the output vector", () => {
        beforeEach(() => { result = Vector3.add(vecB, vecA, vecB) })

        it("should place values into vecB", () => { expect(vecB).toBeVec(5, 7, 9) })
        it("should return vecB", () => { expect(result).toBe(vecB) })
        it("should not modify vecA", () => { expect(vecA).toBeVec(1, 2, 3) })
      })
    })
    describe("magnitude", () => {
      it("should return the length", () => { expect(Vector3.magnitude(vecA)).toBeCloseTo(3.741657) })
    })

    describe("norm", () => {
      beforeEach(() => { vecA = [5, 0, 0] })

      describe("with a separate output vector", () => {
        beforeEach(() => { result = Vector3.norm(out, vecA) })

        it("should place values into out", () => { expect(out).toBeVec(1, 0, 0) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify vecA", () => { expect(vecA).toBeVec(5, 0, 0) })
      })

      describe("when vecA is the output vector", () => {
        beforeEach(() => { result = Vector3.norm(vecA, vecA) })

        it("should place values into vecA", () => { expect(vecA).toBeVec(1, 0, 0) })
        it("should return vecA", () => { expect(result).toBe(vecA) })
      })
    })

    describe("dot", () => {
      let value
      beforeEach(() => { value = Vector3.dot(vecA, vecB) })

      it("should return the dot product", () => { expect(value).toEqual(32) })
      it("should not modify vecA", () => { expect(vecA).toBeVec(1, 2, 3) })
      it("should not modify vecB", () => { expect(vecB).toBeVec(4, 5, 6) })
    })

    describe("cross", () => {
      describe("with a separate output vector", () => {
        beforeEach(() => { result = Vector3.cross(out, vecA, vecB) })

        it("should place values into out", () => { expect(out).toBeVec(-3, 6, -3) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify vecA", () => { expect(vecA).toBeVec(1, 2, 3) })
        it("should not modify vecB", () => { expect(vecB).toBeVec(4, 5, 6) })
      })

      describe("when vecA is the output vector", () => {
        beforeEach(() => { result = Vector3.cross(vecA, vecA, vecB) })

        it("should place values into vecA", () => { expect(vecA).toBeVec(-3, 6, -3) })
        it("should return vecA", () => { expect(result).toBe(vecA) })
        it("should not modify vecB", () => { expect(vecB).toBeVec(4, 5, 6) })
      })

      describe("when vecB is the output vector", () => {
        beforeEach(() => { result = Vector3.cross(vecB, vecA, vecB) })

        it("should place values into vecB", () => { expect(vecB).toBeVec(-3, 6, -3) })
        it("should return vecB", () => { expect(result).toBe(vecB) })
        it("should not modify vecA", () => { expect(vecA).toBeVec(1, 2, 3) })
      })
    })

    describe("scale", () => {
      describe("with a separate output vector", () => {
        beforeEach(() => { result = Vector3.scale(out, vecA, 2) })

        it("should place values into out", () => { expect(out).toBeVec(2, 4, 6) })
        it("should return out", () => { expect(result).toBe(out) })
        it("should not modify vecA", () => { expect(vecA).toBeVec(1, 2, 3) })
      });

      describe("when vecA is the output vector", () => {
        beforeEach(() => { result = Vector3.scale(vecA, vecA, 2) })

        it("should place values into vecA", () => { expect(vecA).toBeVec(2, 4, 6) })
        it("should return vecA", () => { expect(result).toBe(vecA) })
      })
    })

    describe("equals", () => {
      let vecC, vecD, r0, r1, r2
      beforeEach(() => {
        vecA = [0, 1, 2]
        vecB = [0, 1, 2]
        vecC = [1, 2, 3]
        vecD = [1e-16, 1, 2]
        r0 = Vector3.equals(vecA, vecB)
        r1 = Vector3.equals(vecA, vecC)
        r2 = Vector3.equals(vecA, vecD)
      })
      it("should return true for identical vectors", () => { expect(r0).toBe(true) })
      it("should return false for different vectors", () => { expect(r1).toBe(false) })
      it("should return true for close but not identical vectors", () => { expect(r2).toBe(true) })
      it("should not modify vecA", () => { expect(vecA).toBeVec(0, 1, 2) })
      it("should not modify vecB", () => { expect(vecB).toBeVec(0, 1, 2) })
    })
  })
})

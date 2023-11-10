# moodyjs

An implementation of the "Moody Method" for surface plate flatness.

[Try It](https://brcolow.github.io/moodyjs/)

![Screenshot](/screenshot.png?raw=true "Screenshot")

## Overall Flatness Grades

Two different grading standards for the overall measured flatness of a surface plate are defined by ISO and ASME. Both
standards provide a list of standard table sizes and their associated flatness tolerances for the different grades as
well as an equation for calculating the flatness tolerance when the size is ±5% outside the range of a standard
size. The ISO equation is linear, whereas the ASME equation is a second degree polynomial (both are a function of
the plate's diagonal length). An important difference between the two standards is that the equation provided by
the ISO standard matches the values in the standard sizes table. This is not the case for the ASME standard.

### ASME (B89.3.7-2013)

ASME B89.3.7-2013:

4.3.4 Flatness Tolerance (Entire Work Surface)

All points of the work surface shall be contained between two parallel planes. For sizes not listed in Table 1 (more
specifically, for sizes that are outside +-5% of the sizes listed in Table 1) the "AA" grade flatness tolerance can be
calculated by the following second degree polynomial (D = diagonal of the plate):

Overall flatness tolerance (µm) = 1.6D² + 1
Overall flatness tolerance (µinch)  = D² / 25 + 40

The tolerance for grades "A" and "B" are calculated by multiplying the "AA" tolerance grade by 2 and 4 respectively:

tolerance(A) = tolerance(AA) * 2
tolerance(B) = tolerance(AA) * 4

The specification states that the calculated flatness tolerance for grade "AA" is rounded up to the nearest
0.5 micrometer or 25 µinch increments. However, this makes the calculated values even farther off than the tabulated
values.

The table values do not match the calculated values. For example: 

For a 12" x 12" standard size surface plate the table lists an overall flatness tolerance of 50 µinch:

((sqrt(12² + 12²))² / 25) + 40 = ((12² + 12²) / 25) + 40 = 51.52

Rounded up to nearest 25 µinch increment = 75

This doesn't match (the calculated value is 1.52 µinches more than the table value). The rounding makes matters worse.

For a 18" x 24" standard size surface plate the table lists an overall flatness tolerance of 80 µinch:

40 + ((sqrt(18² + 24²))² / 25) = 76

Rounded up to nearest 25 µinch increment  = 100

This doesn't match (the calculated value is 4 µinches less than the table value). The rounding again makes matters worse.

Here is a table that shows the difference between the tabulated and calculated values for ASME (and a comparison between
ISO grade 0 and ASME grade "AA"):

| Plate Length | Plate Width | Diagonal    | Diagonal (µm) | AA Overall Flatness Calc (µinch) | AA Overall Flatness Table (µinch) | Diff(Calc - Table) | ISO Equation Grade 0 (µm) | ISO Grade 0 (µinch) | A Overall Flatness Calc (µinch) | B Overall Flatness Calc (µinch) | A Overall Flatness Table (µinch) | B Overall Flatness Table (µinch) |
|--------------|-------------|-------------|---------------|----------------------------------|-----------------------------------|--------------------|---------------------------|---------------------|---------------------------------|---------------------------------|----------------------------------|----------------------------------|
| 12           | 12          | 16.97056275 | 431.0522938   | 51.52                            | 50                                | 1.52               | 4                         | 157.480315          | 103.04                          | 206.08                          | 100                              | 200                              |
| 12           | 18          | 21.63330765 | 549.4860144   | 58.72                            | 50                                | 8.72               | 4.3                       | 169.2913386         | 117.44                          | 234.88                          | 100                              | 200                              |
| 18           | 18          | 25.45584412 | 646.5784407   | 65.92                            | 50                                | 15.92              | 4.6                       | 181.1023622         | 131.84                          | 263.68                          | 100                              | 200                              |
| 18           | 24          | 30          | 762           | 76                               | 80                                | -4                 | 4.9                       | 192.9133858         | 152                             | 304                             | 160                              | 320                              |
| 24           | 24          | 33.9411255  | 862.1045876   | 86.08                            | 80                                | 6.08               | 5.2                       | 204.7244094         | 172.16                          | 344.32                          | 160                              | 320                              |
| 24           | 36          | 43.26661531 | 1098.972029   | 114.88                           | 100                               | 14.88              | 5.8                       | 228.3464567         | 229.76                          | 459.52                          | 200                              | 400                              |
| 24           | 48          | 53.66563146 | 1363.107039   | 155.2                            | 150                               | 5.2                | 6.7                       | 263.7795276         | 310.4                           | 620.8                           | 300                              | 600                              |
| 30           | 48          | 56.60388679 | 1437.738725   | 168.16                           | 180                               | -11.84             | 7                         | 275.5905512         | 336.32                          | 672.64                          | 360                              | 720                              |
| 36           | 36          | 50.91168825 | 1293.156881   | 143.68                           | 150                               | -6.32              | 6.4                       | 251.9685039         | 287.36                          | 574.72                          | 300                              | 600                              |
| 36           | 48          | 60          | 1524          | 184                              | 200                               | -16                | 7.3                       | 287.4015748         | 368                             | 736                             | 400                              | 800                              |
| 36           | 60          | 69.97142274 | 1777.274138   | 235.84                           | 250                               | -14.16             | 7.9                       | 311.023622          | 471.68                          | 943.36                          | 500                              | 1000                             |
| 36           | 72          | 80.49844719 | 2044.660559   | 299.2                            | 300                               | -0.8               | 8.8                       | 346.4566929         | 598.4                           | 1196.8                          | 600                              | 1200                             |
| 48           | 48          | 67.88225099 | 1724.209175   | 224.32                           | 200                               | 24.32              | 7.9                       | 311.023622          | 448.64                          | 897.28                          | 400                              | 800                              |
| 48           | 60          | 76.83749085 | 1951.672268   | 276.16                           | 300                               | -23.84             | 8.5                       | 334.6456693         | 552.32                          | 1104.64                         | 600                              | 1200                             |
| 48           | 72          | 86.53323061 | 2197.944058   | 339.52                           | 350                               | -10.48             | 9.1                       | 358.2677165         | 679.04                          | 1358.08                         | 700                              | 1400                             |
| 48           | 96          | 107.3312629 | 2726.214078   | 500.8                            | 500                               | 0.8                | 10.9                      | 429.1338583         | 1001.6                          | 2003.2                          | 1000                             | 2000                             |
| 48           | 120         | 129.2439554 | 3282.796466   | 708.16                           | 700                               | 8.16               | 12.4                      | 488.1889764         | 1416.32                         | 2832.64                         | 1400                             | 2800                             |
| 60           | 120         | 134.1640786 | 3407.767598   | 760                              | 750                               | 10                 | 13                        | 511.8110236         | 1520                            | 3040                            | 1500                             | 3000                             |
| 72           | 96          | 120         | 3048          | 616                              | 600                               | 16                 | 11.8                      | 464.5669291         | 1232                            | 2464                            | 1200                             | 2400                             |
| 72           | 144         | 160.9968944 | 4089.321117   | 1076.8                           | 1100                              | -23.2              | 14.8                      | 582.6771654         | 2153.6                          | 4307.2                          | 2200                             | 4400                             |

We believe that the table values should be changed to match the calculated values from the second degree polynomial and
that the advice on rounding up to the nearest 25 µinches for calculated values should be abandoned.

### ISO 8512-2



## TODO

* Add a way to show a semi-transparent plane that corresponds to grade "AA", "A", and "B" flatness. tolerance(AA) =  (40 + diagonal squared/25) x .000001″, A = tolerance(AA) * 2, B=tolerance(AA) * 4
* Show a scale for the z-axis height values.
* Add a thickness for the table slab (add manufacturer's label).
* Allow for "importing" a number set (maybe from a CSV file or a textarea with a simple format).

## Thanks To

[Bruce Allen](https://github.com/ballen4705) - Published a very useful paper that corrects some mistakes from Moody's original magazine article and provides some useful citations.

import { describe, it, expect } from "vitest";
import {
  expandProductConsumption,
  groupProductLines,
  groupDeclarationLines,
} from "./product-lines";
import type { SheetLine } from "@/modules/shifts";
const allocations = [
  { id: "b", product_id: "p", quantity: 0.2 },
  { id: "a", product_id: "p", quantity: 0.1 },
  { id: "c", product_id: "q", quantity: 2 },
];
describe("cantități pe produs", () => {
  it("adună sursele și distribuie consumul exact, determinist", () => {
    const result = expandProductConsumption(allocations, [
      { product_id: "p", consumed: "0.3" },
      { product_id: "q", consumed: "1" },
    ]);
    expect(result).toEqual([
      { allocation_id: "a", consumed: "0.1", returned: "0" },
      { allocation_id: "b", consumed: "0.2", returned: "0" },
      { allocation_id: "c", consumed: "1", returned: "0" },
    ]);
    expect(
      expandProductConsumption([...allocations].reverse(), [
        { product_id: "q", consumed: "1" },
        { product_id: "p", consumed: "0.3" },
      ]),
    ).toEqual(result);
  });
  it("refuză produse omise, duplicate, străine și consum peste total", () => {
    for (const products of [
      [{ product_id: "p", consumed: "0" }],
      [
        { product_id: "p", consumed: "0" },
        { product_id: "p", consumed: "0" },
      ],
      [
        { product_id: "x", consumed: "0" },
        { product_id: "q", consumed: "0" },
      ],
      [
        { product_id: "p", consumed: "0.301" },
        { product_id: "q", consumed: "0" },
      ],
      [
        { product_id: "p", consumed: "-1" },
        { product_id: "q", consumed: "0" },
      ],
    ])
      expect(() => expandProductConsumption(allocations, products)).toThrow();
  });
  it("grupează după identitate, nu după nume, fără erori zecimale", () => {
    const lines = allocations.map((a) => ({
      ...a,
      product_name: "Același nume",
      base_unit: "ml",
    })) as SheetLine[];
    expect(
      groupProductLines(lines).map((x) => ({ id: x.product_id, quantity: x.quantity })),
    ).toEqual([
      { id: "p", quantity: 0.3 },
      { id: "q", quantity: 2 },
    ]);
  });
});

it("păstrează restul calculat în rezumatele istorice fără câmp remaining", () => {
  const lines = [
    {
      allocation_id: "a",
      product_name: "Produs",
      lot_code: "vechi",
      base_unit: "buc",
      quantity_precision: 0,
      issued: 12,
      consumed: 7,
      returned: 0,
    },
    {
      allocation_id: "b",
      product_name: "Produs",
      lot_code: "nou",
      base_unit: "buc",
      quantity_precision: 0,
      issued: 3,
      consumed: 0,
      returned: 0,
    },
  ];
  const grouped = groupDeclarationLines(lines, [
    { id: "a", product_id: "p" },
    { id: "b", product_id: "p" },
  ]);
  expect(grouped).toHaveLength(1);
  expect(grouped[0].remaining).toBe(8);
  expect(grouped[0].issued).toBe(15);
});

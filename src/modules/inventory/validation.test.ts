import { expect, it } from "vitest";
import { readStockLines } from "./validation";
it("nu acceptă linii duplicate, incomplete, nule sau negative", () => {
  const form = new FormData();
  form.append("lot_id", "10000000-0000-0000-0000-000000000001");
  form.append("quantity", "1,125");
  expect(readStockLines(form)).toEqual([
    { lot_id: "10000000-0000-0000-0000-000000000001", quantity: "1.125" },
  ]);
  for (const quantity of ["0", "0.000", "-1", "NaN"]) {
    form.set("quantity", quantity);
    expect(readStockLines(form)).toBeNull();
  }
  form.set("quantity", "1");
  form.append("lot_id", "10000000-0000-0000-0000-000000000001");
  expect(readStockLines(form)).toBeNull();
  form.append("quantity", "2");
  expect(readStockLines(form)).toBeNull();
});

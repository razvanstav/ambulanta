import { isUuid } from "@/modules/identity/policy";
import { parseMinimum } from "@/modules/catalog/rules";
export function readStockLines(form: FormData) {
  const lots = form.getAll("product_id").map(String);
  const quantities = form.getAll("quantity").map(String);
  if (
    !lots.length ||
    lots.length > 100 ||
    lots.length !== quantities.length ||
    new Set(lots).size !== lots.length
  )
    return null;
  const lines = [];
  for (let i = 0; i < lots.length; i++) {
    const quantity = parseMinimum(quantities[i], 3);
    if (!isUuid(lots[i]) || quantity === null || !/[1-9]/.test(quantity)) return null;
    lines.push({ product_id: lots[i], quantity });
  }
  return lines;
}

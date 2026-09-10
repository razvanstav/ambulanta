import { StockPage } from "@/modules/demo";

export default async function StockRoute({
  searchParams,
}: {
  searchParams: Promise<{ stare?: string | string[] }>;
}) {
  const { stare } = await searchParams;
  const initialStatus =
    typeof stare === "string" && ["sub-prag", "expira"].includes(stare) ? stare : "toate";
  return <StockPage key={initialStatus} initialStatus={initialStatus} />;
}

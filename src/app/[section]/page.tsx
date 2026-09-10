import { notFound } from "next/navigation";
import { SectionPage, type DemoSection } from "@/modules/demo";

const sections: DemoSection[] = [
  "receptii",
  "distribuire",
  "inchidere",
  "rapoarte",
  "personal",
  "masini",
  "setari",
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export default async function DemoSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as DemoSection)) notFound();
  return <SectionPage section={section as DemoSection} />;
}

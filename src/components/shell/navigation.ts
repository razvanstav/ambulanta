import type { IconName } from "@/components/ui/icon";

export type NavigationItem = { href: string; label: string; icon: IconName };
export const logisticsNavigation: NavigationItem[] = [
  { href: "/demo", label: "Privire de ansamblu", icon: "grid" },
  { href: "/demo/stocuri", label: "Stocuri", icon: "box" },
  { href: "/demo/receptii", label: "Recepții", icon: "file" },
  { href: "/demo/distribuire", label: "Distribuire tură", icon: "clipboard" },
  { href: "/demo/inchidere", label: "Închidere tură", icon: "circleCheck" },
  { href: "/demo/rapoarte", label: "Rapoarte", icon: "chart" },
  { href: "/demo/personal", label: "Personal", icon: "users" },
  { href: "/demo/masini", label: "Mașini", icon: "ambulance" },
  { href: "/demo/setari", label: "Setări", icon: "settings" },
];
export const shiftNavigation: NavigationItem[] = [
  { href: "/demo/tura-mea", label: "Tura curentă", icon: "pulse" },
  { href: "/demo/tura-mea/istoric", label: "Istoricul meu", icon: "clock" },
];

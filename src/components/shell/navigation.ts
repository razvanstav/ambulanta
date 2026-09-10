import type { IconName } from "@/components/ui/icon";

export type NavigationItem = { href: string; label: string; icon: IconName };
export const logisticsNavigation: NavigationItem[] = [
  { href: "/", label: "Privire de ansamblu", icon: "grid" },
  { href: "/stocuri", label: "Stocuri", icon: "box" },
  { href: "/receptii", label: "Recepții", icon: "file" },
  { href: "/distribuire", label: "Distribuire tură", icon: "clipboard" },
  { href: "/inchidere", label: "Închidere tură", icon: "circleCheck" },
  { href: "/rapoarte", label: "Rapoarte", icon: "chart" },
  { href: "/personal", label: "Personal", icon: "users" },
  { href: "/masini", label: "Mașini", icon: "ambulance" },
  { href: "/setari", label: "Setări", icon: "settings" },
];
export const shiftNavigation: NavigationItem[] = [
  { href: "/tura-mea", label: "Tura curentă", icon: "pulse" },
  { href: "/tura-mea/istoric", label: "Istoricul meu", icon: "clock" },
];

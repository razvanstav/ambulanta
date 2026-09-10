"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Button } from "@/components/ui/primitives";
import {
  canUseMyShift,
  canViewLogistics,
  isAdmin,
  roleLabels,
  stationRoles,
  type Identity,
} from "@/modules/identity/policy";
import { signOut } from "@/modules/identity/actions";
import type { NavigationItem } from "./navigation";
import { useHydrated } from "./use-hydrated";

export function AuthenticatedShell({
  identity,
  stationId,
  children,
}: {
  identity: Identity;
  stationId?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const router = useRouter();
  const menu = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const stations = identity.substations.filter((item) => item.active);
  const station = stations.find((item) => item.id === stationId);
  const base = station ? `/substatia/${station.id}` : "";
  const navigation: NavigationItem[] = station
    ? [{ href: base, label: "Spațiul substației", icon: "grid" }]
    : [];
  if (station && canViewLogistics(identity, station.id))
    navigation.push(
      { href: `${base}/logistica`, label: "Logistică / Magazie", icon: "box" },
      { href: `${base}/catalog`, label: "Catalog și loturi", icon: "box" },
      { href: `${base}/stocuri`, label: "Stocuri și recepții", icon: "box" },
      { href: `${base}/ture`, label: "Cereri și ture", icon: "pulse" },
      { href: `${base}/personal`, label: "Personal", icon: "users" },
      { href: `${base}/masini`, label: "Mașini", icon: "ambulance" },
    );
  if (station && canUseMyShift(identity, station.id))
    navigation.push({ href: `${base}/tura-mea`, label: "Tura mea", icon: "pulse" });
  if (isAdmin(identity))
    navigation.push({ href: "/administrare", label: "Administrare", icon: "settings" });
  navigation.push({ href: "/cont", label: "Contul meu", icon: "users" });
  const current = navigation.find((item) => item.href === pathname)?.label ?? "Gestiune substații";
  function closeMenu() {
    menu.current?.close();
  }
  function sidebar() {
    return (
      <>
        <Link
          href="/"
          className="brand"
          onClick={closeMenu}
          aria-label="Gestiune substații — pagina inițială"
        >
          <span className="brand-mark">
            <Icon name="pulse" />
          </span>
          <span>
            <strong>
              SAJ<span className="brand-dot">.</span>
            </strong>
            <small>Gestiune substații</small>
          </span>
        </Link>
        <nav className="identity-navigation" aria-label="Navigație cont">
          <span className="nav-caption">SPAȚIUL ECHIPEI</span>
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="nav-link"
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {pathname === item.href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-illustration" aria-hidden="true">
            <Icon name="ambulance" />
            <span className="road-line" />
          </div>
          <p>
            Grijă pentru echipaje.
            <br />
            <strong>Claritate în fiecare tură.</strong>
          </p>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Deconectare
            </Button>
          </form>
        </div>
      </>
    );
  }
  return (
    <div className="app-shell authenticated-shell" data-ready={hydrated}>
      <a className="skip-link" href="#continut">
        Sari la conținut
      </a>
      <aside className="sidebar">{sidebar()}</aside>
      <dialog
        ref={menu}
        className="mobile-menu"
        aria-label="Meniu principal"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMenu();
        }}
      >
        <div className="mobile-menu-content">
          <Button
            className="menu-close"
            variant="ghost"
            aria-label="Închide meniul"
            onClick={closeMenu}
          >
            <Icon name="close" />
          </Button>
          {sidebar()}
        </div>
      </dialog>
      <div className="app-body">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              ref={trigger}
              className="menu-trigger"
              variant="ghost"
              aria-label="Deschide meniul"
              aria-haspopup="dialog"
              disabled={!hydrated}
              onClick={() => menu.current?.showModal()}
            >
              <Icon name="menu" />
            </Button>
            <span>{current}</span>
          </div>
          <div className="header-controls">
            <label className="substation-control">
              <Icon name="pin" />
              <span>
                <small>Substația</small>
                <select
                  aria-label="Substația activă"
                  value={station?.id ?? ""}
                  onChange={(event) => {
                    if (stations.some((item) => item.id === event.target.value))
                      router.push(`/substatia/${event.target.value}`);
                  }}
                >
                  <option value="" disabled>
                    {stations.length ? "Alege substația" : "Nicio substație atribuită"}
                  </option>
                  {stations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <div className="demo-profile">
              <span className="avatar">
                {identity.displayName
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </span>
              <span>
                <strong>{identity.displayName}</strong>
                <small>
                  {station
                    ? stationRoles(identity, station.id)
                        .map((role) => roleLabels[role])
                        .join(" · ")
                    : "Cont individual"}
                </small>
              </span>
            </div>
          </div>
        </header>
        <div className="demo-banner">
          <Badge tone="green">
            <span className="status-dot" />
            Sesiune autentificată
          </Badge>
          <p>Mediu de dezvoltare cu date fictive.</p>
        </div>
        <main id="continut" tabIndex={-1} className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            <strong>SAJ</strong> · Gestiune substații
          </span>
          <span>
            Evidență clară. Echipaje pregătite.
            <Icon name="pulse" />
          </span>
        </footer>
      </div>
    </div>
  );
}

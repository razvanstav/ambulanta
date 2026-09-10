"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Badge, Button } from "@/components/ui/primitives";
import { DemoProvider, useDemo } from "@/modules/demo/context";
import { demoSubstations, type DemoSubstationId } from "@/modules/demo/data";
import { logisticsNavigation, shiftNavigation } from "./navigation";

function ShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isShift = pathname.startsWith("/tura-mea");
  const navigation = isShift ? shiftNavigation : logisticsNavigation;
  const currentPage =
    navigation.find((item) => item.href === pathname)?.label ?? "Gestiune substații";
  const { substation, setSubstationId } = useDemo();
  const menu = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);

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
        <div className="perspective-switch">
          <span className="nav-caption">PERSPECTIVĂ DEMO</span>
          <Link href={isShift ? "/" : "/tura-mea"} onClick={closeMenu} className="perspective-link">
            <span>
              <Icon name={isShift ? "users" : "box"} />
              {isShift ? "Tura mea" : "Logistică / Magazie"}
            </span>
            <Icon name="settings" />
          </Link>
          <p>Schimbă în {isShift ? "Logistică / Magazie" : "Tura mea"}</p>
        </div>
        <nav aria-label={isShift ? "Navigație Tura mea" : "Navigație Logistică"}>
          <span className="nav-caption">{isShift ? "SPAȚIUL MEU" : "GESTIUNE"}</span>
          {navigation.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`nav-link ${!isShift && index === 6 ? "nav-separated" : ""}`}
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
          <div className="sidebar-version">
            <span className="status-dot" />
            Mediu de prezentare<span>v0.1</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#continut">
        Sari la conținut
      </a>
      <aside className="sidebar">{sidebar()}</aside>
      <dialog
        ref={menu}
        className="mobile-menu"
        aria-label="Meniu principal"
        onClose={() => menuTrigger.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className="mobile-menu-content">
          <Button
            variant="ghost"
            className="menu-close"
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
            <button
              ref={menuTrigger}
              type="button"
              className="button button-ghost menu-trigger"
              aria-label="Deschide meniul"
              aria-haspopup="dialog"
              onClick={() => menu.current?.showModal()}
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb-root">{isShift ? "Tura mea" : "Logistică"}</span>
            <Icon name="chevron" />
            <span>{currentPage}</span>
          </div>
          <div className="header-controls">
            <label className="substation-control">
              <Icon name="pin" />
              <span>
                <small>Substația</small>
                <select
                  aria-label="Substația demonstrativă"
                  value={substation.id}
                  onChange={(event) => setSubstationId(event.target.value as DemoSubstationId)}
                >
                  {demoSubstations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <span className="header-divider" />
            <div className="demo-profile">
              <span className="avatar">{isShift ? "MD" : "LG"}</span>
              <span>
                <strong>{isShift ? "Mihai Dobre" : "Logistică / Magazie"}</strong>
                <small>Profil demonstrativ</small>
              </span>
            </div>
          </div>
        </header>
        <div className="demo-banner">
          <Badge tone="amber">
            <span className="status-dot" />
            Date demonstrative
          </Badge>
          <p>Previzualizare interfață. Operațiile nu se salvează.</p>
          <span className="demo-banner-end">
            {isShift ? "Perspectiva șefului de tură" : "Perspectiva logisticii"}
          </span>
        </div>
        <main id="continut" tabIndex={-1} className="main-content" key={substation.id}>
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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <ShellContent>{children}</ShellContent>
    </DemoProvider>
  );
}

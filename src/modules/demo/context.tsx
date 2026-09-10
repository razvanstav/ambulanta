"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { demoSubstations, type DemoSubstationId } from "./data";

type DemoContextValue = {
  substation: (typeof demoSubstations)[number];
  setSubstationId: (id: DemoSubstationId) => void;
  hasExamples: boolean;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [substationId, setSubstationId] = useState<DemoSubstationId>("rosiori");
  const substation = demoSubstations.find((item) => item.id === substationId) ?? demoSubstations[0];
  return (
    <DemoContext.Provider
      value={{ substation, setSubstationId, hasExamples: substationId === "rosiori" }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("Perspectiva demonstrativă necesită DemoProvider.");
  return context;
}

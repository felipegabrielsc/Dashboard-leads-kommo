"use client";

import { DashboardApp } from "@/components/DashboardApp";
import { StoreProvider } from "@/lib/store";

export default function HomePage() {
  return (
    <StoreProvider>
      <DashboardApp />
    </StoreProvider>
  );
}

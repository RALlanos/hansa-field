"use client";

import { useState } from "react";

import { HomeContent } from "../features/home/home-content";
import { HomeSidebar } from "../features/home/home-sidebar";
import { HomeTopbar } from "../features/home/home-topbar";

export function FieldWorkspace() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className="home-shell">
      <HomeSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((current) => !current)}
      />
      <div className="home-main">
        <HomeTopbar />
        <HomeContent />
      </div>
    </main>
  );
}

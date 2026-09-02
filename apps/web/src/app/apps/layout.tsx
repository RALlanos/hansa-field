import type { ReactNode } from "react";

import { AppsShell } from "../../features/layout/apps-shell";

export default function AppsLayout({ children }: { children: ReactNode }) {
  return <AppsShell>{children}</AppsShell>;
}

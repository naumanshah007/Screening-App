import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/workspace/context";

export function WorkspaceBanner({
  userRole,
  showCases = false,
}: {
  userRole?: string;
  showCases?: boolean;
}) {
  const workspace = getWorkspaceContext(userRole, showCases);

  return (
    <div className="border-b border-border bg-card/90 backdrop-blur">
      <div className="px-6 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {workspace.label}
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {workspace.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.shortcuts.map((shortcut) => (
              <Link key={shortcut.href} href={shortcut.href}>
                <Button variant="outline" size="sm">
                  {shortcut.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

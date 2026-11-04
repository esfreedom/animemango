import type { ReactNode } from "react";
import { logoutAdmin } from "@/actions/admin-auth";
import { AdminNav } from "./AdminNav";
import { buttonClass } from "./styles";
import type { CurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/session";

// The back-office frame: a sidebar and a work area. Visitors who are not admins (for example the
// login page) get the bare page without the sidebar.
export function AdminShell({ user, children }: { user: CurrentUser | null; children: ReactNode }) {
  if (!user || !isAdmin(user)) {
    return <div className="flex min-h-screen items-start justify-center p-6">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-line bg-surface p-4">
        <div className="space-y-6">
          <p className="px-3 text-sm font-bold text-ink">AnimeHub หลังบ้าน</p>
          <AdminNav />
        </div>
        <div className="space-y-2 text-xs text-muted">
          <p className="px-3">{user.displayName ?? user.username}</p>
          <form action={logoutAdmin}>
            <button type="submit" className={`${buttonClass} w-full`}>
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 space-y-6 p-6">{children}</main>
    </div>
  );
}

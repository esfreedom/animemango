"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/anime", label: "รายการอนิเมะ" },
  { href: "/moderation", label: "ร่างและรายงาน" },
  { href: "/catalog", label: "ข้อมูลอนิเมะ" },
  { href: "/studios", label: "ค่ายและช่องทาง" },
  { href: "/seo", label: "SEO bot" },
] as const;

// Highlights the current section. Paths are relative to the admin host.
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูหลังบ้าน" className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" || pathname === "/admin-app" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm ${active ? "bg-raised font-semibold text-ink" : "text-muted hover:bg-raised hover:text-ink"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

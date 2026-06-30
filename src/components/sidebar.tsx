"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "لوحة التحكم", icon: "📊" },
  { href: "/reception", label: "الاستقبال", icon: "🏢" },
  { href: "/students", label: "الطلبة", icon: "👤" },
  { href: "/teachers", label: "الأساتذة والحلقات", icon: "👨‍🏫" },
  { href: "/attendance", label: "الغياب", icon: "📋" },
  { href: "/tracking", label: "متابعة الطلبة", icon: "📖" },
  { href: "/discipline", label: "التوبيخات والاستحسانات", icon: "⚖️" },
  { href: "/ranking", label: "الترتيب", icon: "🏆" },
  { href: "/monitoring", label: "المتابعة", icon: "🔍" },
  { href: "/trips", label: "الرحلات", icon: "🚌" },
  { href: "/sanctions", label: "العقوبات", icon: "⛔" },
  { href: "/reports", label: "التقارير", icon: "📄" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];

function EightPointedStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      <polygon points="50,5 57,35 85,35 63,53 72,85 50,65 28,85 37,53 15,35 43,35" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed right-0 top-0 z-40 h-screen w-64 border-l border-sidebar-border bg-sidebar p-4 flex flex-col">
      <div className="relative mb-8 pt-6 pb-4 text-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
          <EightPointedStar className="w-48 h-48 text-sidebar-foreground" />
        </div>
        <h1 className="relative text-xl font-bold text-sidebar-foreground" style={{ fontFamily: "var(--font-display)" }}>
          مدرسة السلام
        </h1>
        <p className="relative text-xs text-sidebar-foreground/60 mt-1">النظام الإداري</p>
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-sidebar-primary/40 to-transparent" />
      </div>
      <nav className="space-y-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <span className="flex items-center justify-center w-5 h-5 text-base leading-none">
                {active ? <EightPointedStar className="w-4 h-4" /> : item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="pt-4 border-t border-sidebar-border text-center">
        <p className="text-[10px] text-sidebar-foreground/40" style={{ fontFamily: "var(--font-display)" }}>
          {new Date().getFullYear()} ©
        </p>
      </div>
    </aside>
  );
}

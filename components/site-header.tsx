"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const links = [
  { href: "/research", label: "Research" },
  { href: "/write", label: "Write" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-2 focus:py-1">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-12 max-w-6xl items-center gap-3 px-3">
        <Link href="/research" className="shrink-0 text-sm tracking-tight whitespace-nowrap">
          This Week in AI
        </Link>
        <nav aria-label="Primary" className="flex shrink-0 items-center gap-3 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground",
                pathname === link.href && "text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="hidden border border-border px-2 py-1 font-mono text-[10px] tracking-wide text-muted-foreground sm:inline"
            onClick={() => window.dispatchEvent(new Event("editorial:palette"))}
            aria-label="Open command palette"
          >
            Ctrl K
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button type="button" className="hidden border border-border px-2 py-1 text-xs sm:inline" aria-label="Theme menu">
                Theme
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setTheme("light")}>Light</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme("dark")}>Dark</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme("system")}>System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-label="Toggle theme"
            className="border border-border p-1.5"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="hidden size-3.5 dark:block" aria-hidden />
            <Moon className="size-3.5 dark:hidden" aria-hidden />
          </button>
          <a
            href="https://github.com/tejasmmali/Newsletter-Assistant"
            className="border border-border px-2 py-1 text-xs"
            aria-label="GitHub repository"
          >
            GitHub
          </a>
        </div>
      </div>
      <CommandPalette />
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import { runCommand } from "@/components/commands";
import { toast } from "sonner";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("editorial:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("editorial:palette", onOpen);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function run(name: string, missing: string) {
    setOpen(false);
    if (!runCommand(name)) toast(missing);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed top-[20%] left-1/2 z-50 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 border border-border bg-background text-foreground"
    >
      <Command.Input
        placeholder="Search commands"
        className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
      />
      <Command.List className="max-h-72 overflow-auto p-1 text-sm">
        <Command.Empty className="px-2 py-3 text-muted-foreground">No matching command.</Command.Empty>
        <Command.Group heading="Go" className="px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          <Command.Item className="px-2 py-1.5 data-[selected=true]:bg-muted" onSelect={() => go("/research")}>
            Research
          </Command.Item>
          <Command.Item className="px-2 py-1.5 data-[selected=true]:bg-muted" onSelect={() => go("/write")}>
            Write
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Actions" className="px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          <Command.Item
            className="px-2 py-1.5 data-[selected=true]:bg-muted"
            onSelect={() => run("load-example", "Open Write to load the example draft.")}
          >
            Load example draft
          </Command.Item>
          <Command.Item
            className="px-2 py-1.5 data-[selected=true]:bg-muted"
            onSelect={() => run("export-brief", "Open Research and generate a brief first.")}
          >
            Export brief
          </Command.Item>
          <Command.Item
            className="px-2 py-1.5 data-[selected=true]:bg-muted"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            Toggle theme
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

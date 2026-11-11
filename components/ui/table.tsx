import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}
function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-border text-left", className)} {...props} />;
}
function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}
function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-border", className)} {...props} />;
}
function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th className={cn("px-2 py-2 font-mono text-[10px] tracking-widest uppercase", className)} {...props} />
  );
}
function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-2 py-2 align-top", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };

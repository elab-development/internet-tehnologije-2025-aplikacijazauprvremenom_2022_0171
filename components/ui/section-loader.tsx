import { RiLoader4Line } from "@remixicon/react";

type SectionLoaderProps = {
  label?: string;
};

export function SectionLoader({ label = "Ucitavanje..." }: SectionLoaderProps) {
  return (
    <div className="text-muted-foreground animate-in fade-in-0 duration-200 flex items-center gap-2 text-xs">
      <RiLoader4Line className="size-3.5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

import { RiLoader4Line } from "@remixicon/react";
import { Skeleton } from "@/components/ui/skeleton";

type PageLoaderProps = {
  title?: string;
  description?: string;
};

export function PageLoader({
  title = "Loading workspace",
  description = "Preparing modules and synchronizing your data...",
}: PageLoaderProps) {
  return (
    <main className="min-h-svh">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl items-center justify-center p-6 md:p-10">
        <section className="notion-surface animate-in fade-in-0 zoom-in-95 duration-300 w-full max-w-xl rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary/15 text-primary inline-flex size-10 items-center justify-center rounded-xl">
              <RiLoader4Line className="size-5 animate-spin" />
            </span>
            <div>
              <h1 className="text-sm font-semibold">{title}</h1>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <Skeleton className="h-3 w-[70%]" />
            <Skeleton className="h-3 w-[90%]" />
            <Skeleton className="h-3 w-[55%]" />
          </div>
        </section>
      </div>
    </main>
  );
}

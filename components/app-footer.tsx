import { RiCalendarEventLine, RiMoneyEuroCircleLine } from "@remixicon/react";
import { getEurToRsdRate, getTodayHoliday } from "@/lib/external-footer-data";

function formatApiDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("sr-RS", { dateStyle: "medium" }).format(parsed);
}

function formatEurRsdRate(rate: number) {
  return new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

export async function AppFooter() {
  const [holiday, eurRsdRate] = await Promise.all([getTodayHoliday(), getEurToRsdRate()]);

  const holidayDate = holiday ? formatApiDate(holiday.date) : null;
  const rateDate = eurRsdRate ? formatApiDate(eurRsdRate.date) : null;

  return (
    <footer className="border-t border-border/70 bg-background/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
        <p className="flex flex-wrap items-center gap-2">
          <RiCalendarEventLine size={14} className="text-primary" />
          <span className="font-medium text-foreground">Danasnji praznik:</span>
          <span>{holiday?.title ?? "Podatak trenutno nije dostupan."}</span>
          {holidayDate ? <span className="opacity-80">({holidayDate})</span> : null}
        </p>

        <p className="flex flex-wrap items-center gap-2">
          <RiMoneyEuroCircleLine size={14} className="text-primary" />
          <span className="font-medium text-foreground">Kurs EUR/RSD:</span>
          <span>
            {eurRsdRate ? `1 EUR = ${formatEurRsdRate(eurRsdRate.rate)} RSD` : "Podatak trenutno nije dostupan."}
          </span>
          {rateDate ? <span className="opacity-80">(datum kursa: {rateDate})</span> : null}
        </p>
      </div>
    </footer>
  );
}

export function AppFooterLoader() {
  return (
    <footer className="border-t border-border/70 bg-background/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
        <p className="flex flex-wrap items-center gap-2">
          <RiCalendarEventLine size={14} className="text-primary" />
          <span className="font-medium text-foreground">Danasnji praznik:</span>
          <span className="inline-block h-3 w-44 animate-pulse rounded bg-muted" />
        </p>

        <p className="flex flex-wrap items-center gap-2">
          <RiMoneyEuroCircleLine size={14} className="text-primary" />
          <span className="font-medium text-foreground">Kurs EUR/RSD:</span>
          <span className="inline-block h-3 w-52 animate-pulse rounded bg-muted" />
        </p>
      </div>
    </footer>
  );
}

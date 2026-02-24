const LITURGICAL_API_TODAY_URL = "http://calapi.inadiutorium.cz/api/v0/en/calendars/default/today";
const EUR_EXCHANGE_API_URL =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json";

export type HolidayInfo = {
  date: string;
  title: string;
};

export type EurRsdRateInfo = {
  date: string;
  rate: number;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getTodayHoliday(): Promise<HolidayInfo | null> {
  try {
    const response = await fetch(LITURGICAL_API_TODAY_URL, {
      cache: "no-cache",
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isObjectRecord(payload) || typeof payload.date !== "string" || !Array.isArray(payload.celebrations)) {
      return null;
    }

    const holidayTitle = payload.celebrations
      .map((item) => (isObjectRecord(item) && typeof item.title === "string" ? item.title.trim() : ""))
      .find((title) => title.length > 0);

    if (!holidayTitle) {
      return null;
    }

    return {
      date: payload.date,
      title: holidayTitle,
    };
  } catch {
    return null;
  }
}

export async function getEurToRsdRate(): Promise<EurRsdRateInfo | null> {
  try {
    const response = await fetch(EUR_EXCHANGE_API_URL, {
      cache: "no-cache",
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    if (!isObjectRecord(payload) || typeof payload.date !== "string" || !isObjectRecord(payload.eur)) {
      return null;
    }

    const rsdRate = payload.eur.rsd;
    if (typeof rsdRate !== "number" || !Number.isFinite(rsdRate)) {
      return null;
    }

    return {
      date: payload.date,
      rate: rsdRate,
    };
  } catch {
    return null;
  }
}

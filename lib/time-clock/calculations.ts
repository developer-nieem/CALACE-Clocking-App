import type {
  EmployeePayRate,
  OrganizationSettings,
  TimeBreak,
  TimeEntry,
  TimeEntryTotals,
} from "@/types";
import { roundHours, roundMoney } from "@/lib/money";

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function completedBreakSeconds(breaks: TimeBreak[], asOf = new Date()) {
  return breaks.reduce((total, item) => {
    const end = item.breakEndAt ? new Date(item.breakEndAt) : asOf;
    return total + Math.max(0, (end.getTime() - new Date(item.breakStartAt).getTime()) / 1000);
  }, 0);
}

export function calculateEntryTotals(
  entry: TimeEntry,
  breaks: TimeBreak[],
  settings: OrganizationSettings,
  options: { asOf?: Date; priorWeeklyWorkedSeconds?: number } = {},
): TimeEntryTotals {
  const asOf = options.asOf ?? new Date();
  const end = entry.clockOutAt ? new Date(entry.clockOutAt) : asOf;
  const grossSeconds = Math.max(
    0,
    (end.getTime() - new Date(entry.clockInAt).getTime()) / 1000,
  );
  const breakSeconds = Math.min(grossSeconds, completedBreakSeconds(breaks, asOf));
  const workedSeconds = Math.max(0, grossSeconds - breakSeconds);

  let overtimeSeconds = 0;
  if (settings.dailyOvertimeEnabled) {
    overtimeSeconds = Math.max(
      overtimeSeconds,
      workedSeconds - settings.dailyOvertimeThresholdHours * 3600,
    );
  }
  if (settings.weeklyOvertimeEnabled) {
    const threshold = settings.weeklyOvertimeThresholdHours * 3600;
    overtimeSeconds = Math.max(
      overtimeSeconds,
      Math.max(0, (options.priorWeeklyWorkedSeconds ?? 0) + workedSeconds - threshold),
    );
  }
  overtimeSeconds = Math.min(workedSeconds, overtimeSeconds);
  const regularSeconds = workedSeconds - overtimeSeconds;
  const rate = entry.payRateSnapshot ?? 0;
  const regularHours = roundHours(regularSeconds / 3600);
  const overtimeHours = roundHours(overtimeSeconds / 3600);
  const regularPay = roundMoney(regularHours * rate);
  const overtimePay = roundMoney(overtimeHours * rate * settings.overtimeMultiplier);

  return {
    grossSeconds,
    breakSeconds,
    workedSeconds,
    regularSeconds,
    overtimeSeconds,
    regularPay,
    overtimePay,
    estimatedPay: roundMoney(regularPay + overtimePay),
  };
}

export function payRateForDate(
  rates: EmployeePayRate[],
  userId: string,
  workDate: string,
) {
  return (
    rates
      .filter(
        (rate) =>
          rate.userId === userId &&
          rate.effectiveFrom <= workDate &&
          (!rate.effectiveTo || rate.effectiveTo >= workDate),
      )
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]?.hourlyRate ?? null
  );
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

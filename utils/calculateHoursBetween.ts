/**
 * Calculate total hours and overtime hours between two timestamps.
 *
 * @param startTimestamp - The start time (Date, ISO string, or numeric timestamp)
 * @param endTimestamp - The end time (Date, ISO string, or numeric timestamp)
 * @returns An object containing total hours and overtime hours (hours over 8)
 */
export function calculateHoursBetween(
  startTimestamp: Date | string | number,
  endTimestamp: Date | string | number,
): { hours: number; overtime: number } {
  const start = new Date(startTimestamp);
  const end = new Date(endTimestamp);

  const msDifference = end.getTime() - start.getTime();
  const hours = Math.max(0, msDifference / (1000 * 60 * 60));
  const overtime = Math.max(0, hours - 8);

  return { hours, overtime };
}

/**
 * Calculate the number of days between two dates
 * @param startDate - The start date (Date object or string)
 * @param endDate - The end date (Date object or string)
 * @returns The number of days between the two dates
 */
export function calculateDaysBetween(
  startDate: Date | string,
  endDate: Date | string,
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const timeDifference = end.getTime() - start.getTime();
  const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

  return daysDifference;
}

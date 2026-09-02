/**
 * Pure pay-period calculation. No DB access so it's easy to unit test and to
 * keep the minimum-wage floor logic in exactly one place.
 */
function calculatePayPeriod({ taskPayTotal, hoursWorked, minimumWage }) {
  if (taskPayTotal < 0) throw new Error('taskPayTotal cannot be negative');
  if (hoursWorked == null || hoursWorked < 0) throw new Error('hoursWorked must be >= 0');
  if (minimumWage == null || minimumWage < 0) throw new Error('minimumWage must be >= 0');

  if (hoursWorked === 0) {
    return {
      effectiveHourly: null,
      topupAmount: 0,
      finalPay: round2(taskPayTotal),
    };
  }

  const effectiveHourly = taskPayTotal / hoursWorked;
  const floorPay = minimumWage * hoursWorked;
  const topupAmount = effectiveHourly < minimumWage ? round2(floorPay - taskPayTotal) : 0;
  const finalPay = round2(taskPayTotal + topupAmount);

  return {
    effectiveHourly: round2(effectiveHourly),
    topupAmount,
    finalPay,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { calculatePayPeriod, round2 };

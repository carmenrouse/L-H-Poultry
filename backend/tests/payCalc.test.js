const { calculatePayPeriod } = require('../src/services/payCalc');

describe('calculatePayPeriod', () => {
  test('no topup when effective hourly meets minimum wage', () => {
    const result = calculatePayPeriod({ taskPayTotal: 200, hoursWorked: 20, minimumWage: 7.25 });
    expect(result.effectiveHourly).toBe(10);
    expect(result.topupAmount).toBe(0);
    expect(result.finalPay).toBe(200);
  });

  test('generates a topup when effective hourly falls below minimum wage', () => {
    const result = calculatePayPeriod({ taskPayTotal: 100, hoursWorked: 20, minimumWage: 7.25 });
    expect(result.effectiveHourly).toBe(5);
    expect(result.topupAmount).toBe(45);
    expect(result.finalPay).toBe(145);
    expect(result.finalPay / 20).toBeCloseTo(7.25, 5);
  });

  test('topup brings effective hourly to exactly the minimum wage floor', () => {
    const result = calculatePayPeriod({ taskPayTotal: 0, hoursWorked: 10, minimumWage: 8 });
    expect(result.topupAmount).toBe(80);
    expect(result.finalPay).toBe(80);
  });

  test('zero hours worked skips the floor calculation entirely', () => {
    const result = calculatePayPeriod({ taskPayTotal: 50, hoursWorked: 0, minimumWage: 7.25 });
    expect(result.effectiveHourly).toBeNull();
    expect(result.topupAmount).toBe(0);
    expect(result.finalPay).toBe(50);
  });

  test('exactly at minimum wage produces no topup', () => {
    const result = calculatePayPeriod({ taskPayTotal: 145, hoursWorked: 20, minimumWage: 7.25 });
    expect(result.effectiveHourly).toBe(7.25);
    expect(result.topupAmount).toBe(0);
  });

  test('rejects negative inputs', () => {
    expect(() => calculatePayPeriod({ taskPayTotal: -1, hoursWorked: 10, minimumWage: 7.25 })).toThrow();
    expect(() => calculatePayPeriod({ taskPayTotal: 10, hoursWorked: -1, minimumWage: 7.25 })).toThrow();
  });
});

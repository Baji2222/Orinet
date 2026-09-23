// Shared leave-balance calculation, used by both the employee-facing
// "My Leave Balance" view and the HR "Employee Leave Balances" overview.
//
// Rule: every employee earns 1 free leave day for every month that has
// started since 1 Jan of the given year (or since their date of joining,
// if that's later in the same year). Approved, paid leave days consume the
// balance. A leave day that falls on a company holiday doesn't consume the
// balance, since the employee wasn't a working day anyway - so adding,
// editing or removing a holiday automatically changes every affected
// employee's used/remaining totals the next time this is called.

function dateRange(fromDate, toDate) {
  const dates = [];
  let d = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function monthsElapsedInYear(dateOfJoining, year, now = new Date()) {
  let startMonthIndex = 0;
  if (dateOfJoining) {
    const doj = new Date(`${dateOfJoining}T00:00:00`);
    if (!Number.isNaN(doj.getTime())) {
      if (doj.getFullYear() > year) return 0;
      if (doj.getFullYear() === year) startMonthIndex = doj.getMonth();
    }
  }
  const currentMonthIndex = now.getFullYear() === year ? now.getMonth() : (now.getFullYear() > year ? 11 : -1);
  if (currentMonthIndex < startMonthIndex) return 0;
  return currentMonthIndex - startMonthIndex + 1;
}

function computeLeaveBalance(user, leaveRequests, holidays, year) {
  const targetYear = year || new Date().getFullYear();
  const holidaySet = new Set(
    (holidays || []).filter((h) => h.date.slice(0, 4) === String(targetYear)).map((h) => h.date)
  );
  const totalAllotted = monthsElapsedInYear(user.dateOfJoining, targetYear);

  const breakdown = (leaveRequests || [])
    .filter((l) => l.userId === user.id)
    .filter((l) => l.fromDate.slice(0, 4) === String(targetYear) || l.toDate.slice(0, 4) === String(targetYear))
    .map((l) => {
      const days = dateRange(l.fromDate, l.toDate).filter((d) => d.slice(0, 4) === String(targetYear));
      const workingDays = days.filter((d) => !holidaySet.has(d));
      const countsAgainstBalance = l.status === 'approved' && l.type !== 'unpaid';
      return {
        id: l.id,
        fromDate: l.fromDate,
        toDate: l.toDate,
        type: l.type,
        status: l.status,
        totalDays: days.length,
        workingDays: workingDays.length,
        holidayOverlapDays: days.length - workingDays.length,
        countsAgainstBalance
      };
    })
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  const used = breakdown
    .filter((b) => b.countsAgainstBalance)
    .reduce((sum, b) => sum + b.workingDays, 0);

  return {
    year: targetYear,
    monthlyFreeLeave: 1,
    totalAllotted,
    used,
    remaining: Math.max(0, totalAllotted - used),
    breakdown
  };
}

module.exports = { computeLeaveBalance, dateRange };

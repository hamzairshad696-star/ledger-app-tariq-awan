// Fields a Viewer is allowed to receive (no internal notes, no audit data).
export const publicPerson = (p) => ({
  id: p.id, sr_no: p.sr_no, name: p.name, father_name: p.father_name, status: p.status,
  marital_status: p.marital_status, monthly_amount: p.monthly_amount, split_cash: p.split_cash, account: p.account, joining_date: p.joining_date,
});
export const publicMonth = (m) => ({
  year: m.year, month: m.month, required: m.required, paid: m.paid, advanceCovered: m.advanceCovered, covered: m.covered,
  pending: m.pending, upcoming: m.upcoming, status: m.status, isCurrent: m.isCurrent, isFuture: m.isFuture, closed: m.closed,
  advanceGivenAmount: m.advanceGivenAmount, advanceGivenFor: m.advanceGivenFor, advanceSources: m.advanceSources, lastPaymentDate: m.lastPaymentDate,
});

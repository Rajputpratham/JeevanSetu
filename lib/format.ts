const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  return inr.format(Math.round(n));
}

export function formatRange(lo: number, hi: number): string {
  if (lo === hi) return formatINR(lo);
  return `${formatINR(lo)} – ${formatINR(hi)}`;
}

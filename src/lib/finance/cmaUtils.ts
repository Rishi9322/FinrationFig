export function formatCmaValue(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "-";
  
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(value));
  
  if (value < 0) {
    return `(${formatted})`;
  }
  return formatted;
}

export function getValueClass(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value) || value === 0) return "val-zero";
  if (value < 0) return "val-negative";
  return "";
}

export function calculateYoY(current: number, previous: number): string {
  if (!previous) return "-";
  const growth = ((current - previous) / previous) * 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(growth));
  
  if (growth < 0) return `(${formatted})%`;
  return `${formatted}%`;
}

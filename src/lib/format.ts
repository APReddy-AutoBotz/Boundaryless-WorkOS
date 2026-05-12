export const roundMetric = (value: number, decimals = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const formatMetric = (value: number, decimals = 1) => {
  const rounded = roundMetric(value, decimals);
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : decimals,
  }).format(rounded);
};

export const formatHours = (value: number, decimals = 1) => `${formatMetric(value, decimals)}h`;

export const formatPercent = (value: number, decimals = 1) => `${formatMetric(value, decimals)}%`;

export const formatFte = (value: number, decimals = 1) => `${formatMetric(value, decimals)} FTE`;

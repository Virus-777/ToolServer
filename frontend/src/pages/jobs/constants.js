// Job industry categories (matches the `industry` column: 0 = software, 1 = civil)
export const INDUSTRY_OPTIONS = [
  { value: 0, label: 'Software' },
  { value: 1, label: 'Civil' },
];

export const getIndustryLabel = (industry) => {
  const option = INDUSTRY_OPTIONS.find((item) => item.value === Number(industry));
  return option ? option.label : 'Software';
};

export const getIndustryColor = (industry) => (Number(industry) === 1 ? 'amber' : 'blue');

// Copy / export fetch every job matching the current filters in one request
export const EXPORT_LIMIT = 10000;

// Date filter offers today + 2 days ahead back to 30 days ago
export const DATE_RANGE = { daysAhead: 2, daysBack: 30 };

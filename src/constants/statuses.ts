export const USER_ACCOUNT_STATUSES = ['Active', 'Disabled'] as const;

export const CLIENT_STATUSES = ['Active', 'Inactive'] as const;

export const EMPLOYEE_STATUSES = ['Active', 'On Leave', 'Exited'] as const;

export const PROJECT_STATUSES = ['Proposed', 'Active', 'On Hold', 'Completed'] as const;

export const ALLOCATION_STATUSES = ['Active', 'Paused', 'Completed'] as const;

export const TIMESHEET_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected'] as const;

export const TIMESHEET_REVIEW_STATUSES = ['Submitted', 'Approved', 'Rejected'] as const;

export const FIXED_STATUS_NOTE =
  'Status values are fixed workflow states because calculations, permissions, and lifecycle rules depend on these exact keys.';

export const QUERY_LIMITS = {
  tasks: {
    default: 30,
    max: 500,
  },
  reminders: {
    default: 25,
    max: 500,
  },
  events: {
    default: 40,
    max: 500,
  },
  notes: {
    default: 20,
    max: 100,
  },
} as const;

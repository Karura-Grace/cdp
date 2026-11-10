// Lucide-style inline icons from the live console sidebar (no glyphs or emoji).
const IC = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  profile: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" /></>,
  ready: <><path d="M12 13l4-4" /><path d="M3 18a9 9 0 0 1 18 0" /></>,
  align: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  perc: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6" /><path d="M18.7 20c0-2.5-1.4-4.2-3.4-4.8" /></>,
  eos: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" /><circle cx="9" cy="10" r="0.7" fill="currentColor" /><circle cx="15" cy="10" r="0.7" fill="currentColor" /></>,
  report: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5" /><path d="M9 12h6M9 16h6M9 8h3" /></>,
  tracker: <><path d="M4 6l1.6 1.6L8.5 5" /><path d="M4 13l1.6 1.6L8.5 12" /><path d="M12 6.5h8M12 13.5h8M12 19h6" /><path d="M4 19.5l1.6 1.6L8.5 18.5" /></>,
} as const;
// Glyphs for the staff shell rail.
export const SIC = {
  portfolio: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 4v16" /></>,
  building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 10h5a1 1 0 0 1 1 1v10" /><path d="M8 8h2M8 12h2M8 16h2M3 21h18" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M18.7 20c0-2.5-1.4-4.2-3.4-4.8" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
  segments: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" opacity=".35" /></>,
  back: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  chartEmpty: <><path d="M4 4v16h16" /><path d="M8 15v1M12 12v4M16 9v7" strokeDasharray="1 3" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  fileX: <><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v5h5" /><path d="M10 13l4 4M14 13l-4 4" /></>,
  warn: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  blocked: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  done: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  userX: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s4 1 5 2.5" /><path d="M17 10l4 4M21 10l-4 4" /></>,
  ...IC,
} as const;
export const SIco = ({ k }: { k: keyof typeof SIC }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SIC[k]}</svg>
);

// Decimal places for one decimal numbers in report prose. The AI narrative route sets 2 while it builds the chapter text
// for the model (owner Q-D9-24: headlines quote the same two decimal numbers as the tables); everything else reads 1.
export const prose = { places: 1 };
/** Build something with prose numbers at two decimals, then restore. Synchronous on purpose: no await can interleave. */
export function withTwoDecimals<T>(f: () => T): T { prose.places = 2; try { return f(); } finally { prose.places = 1; } }

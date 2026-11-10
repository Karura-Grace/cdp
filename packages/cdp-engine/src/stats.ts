/**
 * Welch two-sample t-test (spec §3.5.12 significance). Floats are acceptable here: the p-value is only
 * compared with α and never enters the score payload. Matches scipy.stats.ttest_ind(equal_var=False).
 */

function logGamma(x: number): number {
  // Lanczos approximation (g = 7, n = 9)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 1e-15, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Welch's t-test; null when either sample has < 2 values or the variance is zero. */
export function welchP(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const m = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const v = (xs: number[], mu: number) => xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1);
  const ma = m(a), mb = m(b);
  const sa = v(a, ma) / a.length, sb = v(b, mb) / b.length;
  const se2 = sa + sb;
  if (!(se2 > 0)) return null;
  const t = (ma - mb) / Math.sqrt(se2);
  const df = (se2 * se2) / ((sa * sa) / (a.length - 1) + (sb * sb) / (b.length - 1));
  return incBeta(df / (df + t * t), df / 2, 0.5);
}

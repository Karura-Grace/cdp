import * as E from "@pac/cdp-engine";

type Alpha = Partial<Record<"D7" | "D8" | "D9", string | null>>;

/** Plain sentences for dimensions whose answers were less consistent than usual (Cronbach alpha under the configured limit).
 *  Alpha never removes data: it only tells the reader to take care. Used by the Score review tab and the technical appendix. */
export function alphaNotes(alpha: Alpha | null | undefined): string[] {
  const limit = E.config.get("quality.alpha_disclose_lt");
  return (["D7", "D8", "D9"] as const).flatMap((d) => {
    const v = alpha?.[d];
    return v !== null && v !== undefined && E.D(v).lt(limit)
      ? [`${d} answers were less consistent than usual (${E.D(v).toFixed(2)}, below ${limit.toFixed(2)}). Read the ${d} score with care.`] : [];
  });
}

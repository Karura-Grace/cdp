export function consentText(o: { orgName: string; privacyRegime: string; purpose?: string | null }): { title: string; body: string };
export function purposeSentence(purpose: string | null): string;
export const WITHDRAW_HEADING: string;
export const WITHDRAW_DRAFT_NOTE: string;
export function consentPurposeGap(body: string, purpose?: string | null): string | null;

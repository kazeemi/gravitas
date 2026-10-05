export const INDUSTRIES = [
  { id: "consulting", label: "Consulting" },
  { id: "banking", label: "Banking & Finance" },
  { id: "technology", label: "Technology" },
  { id: "other", label: "Other" },
];

export function getIndustryLabel(sector: string | null | undefined, sectorCustom: string | null | undefined): string | null {
  if (!sector) return null;
  if (sector === "other") return sectorCustom || null;
  return INDUSTRIES.find(i => i.id === sector)?.label ?? sectorCustom ?? null;
}

// The "practicing for" tag shown on a session row: the specific company the
// question targeted if there was one, otherwise "General <industry>".
export function getSessionPrepTag(
  promptCompany: string | null | undefined,
  sector: string | null | undefined,
  sectorCustom: string | null | undefined,
): string | null {
  if (promptCompany) return promptCompany;
  const industry = getIndustryLabel(sector, sectorCustom);
  return industry ? `General ${industry}` : null;
}

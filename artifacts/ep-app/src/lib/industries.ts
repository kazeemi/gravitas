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

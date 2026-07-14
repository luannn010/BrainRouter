export type BrandTone = "calm" | "bold" | "editorial" | "technical";

export const BRAND_PALETTES: Record<BrandTone, { label: string; colors: string[] }> = {
  calm: { label: "Calm", colors: ["#D8F3E6", "#8FE3BF", "#2E8060", "#18392D", "#F4FAF7"] },
  bold: { label: "Bold", colors: ["#FFB38A", "#E5675F", "#8D2E38", "#1D1015", "#F9E8D7"] },
  editorial: { label: "Editorial", colors: ["#F2E7D5", "#D9B98F", "#A96F42", "#2A2320", "#FBF8F0"] },
  technical: { label: "Technical", colors: ["#B7D7FF", "#5E9EEB", "#315F9C", "#101C2D", "#EFF5FC"] },
};

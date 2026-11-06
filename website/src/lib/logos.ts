import logoNames from "./logos.json";

const slug = (name: string) =>
  name.toLowerCase().replace(/&/g, "and").replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const available = new Set<string>(logoNames);

/** The company's logo in /logos (made by scripts/brand_logos), or null to show its initial instead. */
export function logoFor(...names: (string | undefined)[]): string | null {
  for (const name of names) {
    if (name && available.has(slug(name))) return `/logos/${slug(name)}.webp`;
  }
  return null;
}

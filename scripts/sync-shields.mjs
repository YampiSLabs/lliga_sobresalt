import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const rootDir = process.cwd();
const packageDir = join(rootDir, "apps", "web", "node_modules", "catalunya-shields");
const assetsDir = join(packageDir, "assets", "svg");
const municipalitiesPath = join(packageDir, "data", "municipalities.raw.json");
const frontendOutputPath = join(rootDir, "apps", "web", "src", "lib", "cityShields.generated.ts");
const backendDataDir = join(rootDir, "apps", "backend", "league", "data");
const backendOutputPath = join(backendDataDir, "shield_cities.json");

const legacyAliases = {
  "cornella-de-llobregat": ["cornella"],
  "lhospitalet-de-llobregat": ["lhospitalet", "l-hospitalet-de-llobregat"],
  "santa-coloma-de-gramenet": ["santa-coloma"],
};

const legacyNames = {
  "lhospitalet-de-llobregat": "L'Hospitalet de Llobregat",
};

const legacySlugs = {
  "lhospitalet-de-llobregat": "lhospitalet",
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stripDiacritics(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function repairMojibake(value) {
  if (!/(?:\u00c3|\u00c2|\ufffd)/u.test(value)) return value;
  return Buffer.from(value, "latin1").toString("utf8");
}

function createSlug(value) {
  return stripDiacritics(repairMojibake(value).toLowerCase())
    .replace(/'/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createIdentifier(slug) {
  return `${slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Shield`;
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function quote(value) {
  return JSON.stringify(value);
}

if (!existsSync(assetsDir)) {
  throw new Error(`Missing catalunya-shields assets directory: ${relative(rootDir, assetsDir)}`);
}
if (!existsSync(municipalitiesPath)) {
  throw new Error(`Missing catalunya-shields municipality data: ${relative(rootDir, municipalitiesPath)}`);
}

const municipalities = readJson(municipalitiesPath).map((item) => ({
  name: repairMojibake(item.name),
  province: item.province ? repairMojibake(item.province) : null,
  slug: createSlug(item.name),
}));
const svgFiles = readdirSync(assetsDir).filter((file) => file.endsWith(".svg")).sort((a, b) => a.localeCompare(b));
const svgSlugs = new Set(svgFiles.map((file) => basename(file, ".svg")));

const cityRowsByAssetSlug = new Map();
for (const municipality of municipalities) {
  const assetSlug = municipality.slug;
  const slug = legacySlugs[assetSlug] ?? municipality.slug;
  const aliases = new Set([...(legacyAliases[assetSlug] ?? [])]);
  if (assetSlug !== slug) aliases.add(assetSlug);
  aliases.delete(slug);
  cityRowsByAssetSlug.set(assetSlug, {
    assetSlug,
    file: svgSlugs.has(assetSlug) ? `${assetSlug}.svg` : null,
    importName: svgSlugs.has(assetSlug) ? createIdentifier(assetSlug) : null,
    name: legacyNames[assetSlug] ?? municipality.name,
    slug,
    province: municipality.province,
    aliases: [...aliases].sort((a, b) => a.localeCompare(b)),
    hasShield: svgSlugs.has(assetSlug),
  });
}

for (const file of svgFiles) {
  const assetSlug = basename(file, ".svg");
  if (cityRowsByAssetSlug.has(assetSlug)) continue;
  const slug = legacySlugs[assetSlug] ?? assetSlug;
  const aliases = new Set([...(legacyAliases[assetSlug] ?? [])]);
  if (assetSlug !== slug) aliases.add(assetSlug);
  aliases.delete(slug);
  cityRowsByAssetSlug.set(assetSlug, {
    assetSlug,
    file,
    importName: createIdentifier(assetSlug),
    name: legacyNames[assetSlug] ?? titleFromSlug(assetSlug),
    province: null,
    slug,
    aliases: [...aliases].sort((a, b) => a.localeCompare(b)),
    hasShield: true,
  });
}

const cityRows = [...cityRowsByAssetSlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
const shieldRows = cityRows.filter((row) => row.hasShield);

const importLines = shieldRows
  .map((row) => `import ${row.importName} from "catalunya-shields/assets/svg/${row.file}";`)
  .join("\n");
const mapEntries = [];
for (const row of shieldRows) {
  const keys = [row.slug, ...row.aliases].sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    mapEntries.push(`  ${quote(key)}: ${row.importName},`);
  }
}
const slugEntries = shieldRows.map((row) => `  ${quote(row.slug)},`).join("\n");
const cityEntries = shieldRows
  .map((row) => (
    `  { name: ${quote(row.name)}, slug: ${quote(row.slug)}, province: ${quote(row.province)}, aliases: ${JSON.stringify(row.aliases)}, hasShield: ${row.hasShield} },`
  ))
  .join("\n");
const allCityEntries = cityRows
  .map((row) => (
    `  { name: ${quote(row.name)}, slug: ${quote(row.slug)}, province: ${quote(row.province)}, aliases: ${JSON.stringify(row.aliases)}, hasShield: ${row.hasShield} },`
  ))
  .join("\n");
const frontendContent = `${importLines}

type ShieldAsset = {
  src: string;
};

export type GeneratedCityShield = {
  name: string;
  slug: string;
  province: string | null;
  aliases: string[];
  hasShield: boolean;
};

export const GENERATED_CITY_SHIELDS: Record<string, ShieldAsset> = {
${mapEntries.sort().join("\n")}
};

export const GENERATED_CITY_SHIELD_SLUGS = [
${slugEntries}
] as const;

export const GENERATED_CITY_SHIELD_CITIES: GeneratedCityShield[] = [
${cityEntries}
];

export const GENERATED_CITIES: GeneratedCityShield[] = [
${allCityEntries}
];
`;

const backendManifest = cityRows
  .map(({ name, slug, province, aliases }) => ({ name, slug, province, aliases }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

mkdirSync(backendDataDir, { recursive: true });
writeFileSync(frontendOutputPath, frontendContent, "utf8");
writeFileSync(backendOutputPath, `${JSON.stringify(backendManifest, null, 2)}\n`, "utf8");

console.log(`Synced ${cityRows.length} municipalities and ${shieldRows.length} shields.`);
console.log(`Wrote ${relative(rootDir, frontendOutputPath)}`);
console.log(`Wrote ${relative(rootDir, backendOutputPath)}`);

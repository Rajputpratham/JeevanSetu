#!/usr/bin/env node
// One-off, single-worker setup tool. See the README and Nominatim usage policy.
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';

const hospitalFile = new URL('../data/hospitals.ts', import.meta.url);
const registryFile = new URL('../data/hospital-locations.ts', import.meta.url);
const cacheFile = new URL('../.nominatim-geocode-cache.json', import.meta.url);
const endpoint = process.env.NOMINATIM_SEARCH_URL || 'https://nominatim.openstreetmap.org/search';
const contact = process.env.NOMINATIM_CONTACT || 'https://github.com/Rajputpratham/JeevanSetu';
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/geocode.mjs [--write]');
const write = args.includes('--write');
const read = (file) => readFile(file, 'utf8');
const [hospitalCode, registryCode] = await Promise.all([read(hospitalFile), read(registryFile)]);

// Load the same records the app publishes, without building Next.js first.
function moduleUrl(code) {
  const { outputText } = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const registryModule = moduleUrl(registryCode);
const { HOSPITAL_GEO, isInsideBounds } = await import(registryModule);
const { HOSPITALS } = await import(moduleUrl(hospitalCode.replace("'./hospital-locations'", JSON.stringify(registryModule))));
const missing = HOSPITALS.filter((h) => !isInsideBounds(h.lat, h.lng, h.city));
console.log(`${HOSPITALS.length - missing.length} valid coordinate pairs skipped; ${missing.length} missing or invalid.`);

let cache = {};
if (missing.length) {
  try { cache = JSON.parse(await read(cacheFile)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
let nextAllowedAt = 0;
async function search(query) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', namedetails: '1', countrycodes: 'in', limit: '5', q: query }).toString();
  if (Object.hasOwn(cache, url.href)) return cache[url.href];
  await delay(Math.max(0, nextAllowedAt - Date.now()));
  nextAllowedAt = Date.now() + 1100;
  const res = await fetch(url, { headers: { 'User-Agent': `JeevanSetu-Dataset-Geocoder/1.0 (${contact})` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const results = await res.json();
  if (!Array.isArray(results)) throw new Error('Invalid Nominatim response');
  cache[url.href] = results;
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`);
  return results;
}

const normalize = (name) => typeof name === 'string' ? name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() : '';
const updates = new Map();
for (const hospital of missing) {
  try {
    const matches = await search(`${hospital.name}, ${hospital.address}`);
    // Do not pick a top-ranked result. Require a unique named hospital with an
    // exact PIN match, a real OSM feature ID and a point inside its city bounds.
    const names = [hospital.name, hospital.shortName].map(normalize).filter(Boolean);
    const verified = matches.filter((item) => item?.type === 'hospital' &&
      ['amenity', 'healthcare'].includes(item.category) &&
      ['node', 'way', 'relation'].includes(item.osm_type) && Number.isSafeInteger(item.osm_id) && item.osm_id > 0 &&
      [item.name, item.namedetails?.name, item.namedetails?.['name:en']].some((name) => names.includes(normalize(name))) &&
      hospital.pincode && item.address?.postcode === hospital.pincode &&
      typeof item.lat === 'string' && item.lat.trim() && typeof item.lon === 'string' && item.lon.trim() &&
      isInsideBounds(Number(item.lat), Number(item.lon), hospital.city));
    if (verified.length !== 1) {
      console.warn(`${hospital.id}: ${matches.length > 1 ? 'ambiguous or unverified' : 'unmatched or unverified'}; unchanged.`);
      for (const match of matches) console.warn(`  ${match?.display_name ?? '(unnamed candidate)'}`);
      continue;
    }
    const match = verified[0];
    const source = `https://www.openstreetmap.org/${match.osm_type}/${match.osm_id}`;
    updates.set(hospital.id, {
      ...HOSPITAL_GEO[hospital.id], id: hospital.id, lat: Number(match.lat), lng: Number(match.lon), confidence: 'verified',
      placeId: HOSPITAL_GEO[hospital.id]?.placeId ?? null, sourceUrl: source,
      note: `Exact hospital name and PIN matched in Nominatim; © OpenStreetMap contributors: ${source}`,
    });
    console.log(`${hospital.id}: verified match ${source}${write ? '' : ' (dry run)'}`);
  } catch (error) {
    console.error(`${hospital.id}: geocoding stopped (${error.message}); remaining records unchanged.`);
    process.exitCode = 1;
    break;
  }
}

if (write && updates.size) {
  const ast = ts.createSourceFile(registryFile.pathname, registryCode, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations])
    .find((variable) => variable.name.getText(ast) === 'HOSPITAL_GEO');
  const registry = declaration?.initializer;
  if (!registry || !ts.isObjectLiteralExpression(registry)) throw new Error('Could not locate HOSPITAL_GEO');
  const print = (value) => JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
  const edits = [];
  for (const property of registry.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const id = property.name.text;
    if (updates.has(id)) {
      edits.push([property.initializer.getStart(ast), property.initializer.end, print(updates.get(id))]);
      updates.delete(id);
    }
  }
  if (updates.size) {
    const prefix = registry.properties.length && !registry.properties.hasTrailingComma ? ',' : '';
    edits.push([registry.end - 1, registry.end - 1, `${prefix}\n${[...updates].map(([id, value]) => `  ${JSON.stringify(id)}: ${print(value)},`).join('\n')}\n`]);
  }
  if (await read(registryFile) !== registryCode) throw new Error('Registry changed while geocoding; refusing to overwrite it.');
  const updated = edits.sort((a, b) => b[0] - a[0]).reduce((code, [start, end, value]) => code.slice(0, start) + value + code.slice(end), registryCode);
  await writeFile(registryFile, updated);
  console.log('Updated data/hospital-locations.ts. Review the diff before committing.');
}

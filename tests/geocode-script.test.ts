// @vitest-environment node
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const execFile = promisify(execFileCallback);

it('writes a unique verified match to the real registry shape without overwriting ambiguous listings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jeevansetu-geocode-test-'));
  try {
    await mkdir(join(directory, 'scripts'));
    await cp('scripts/geocode.mjs', join(directory, 'scripts', 'geocode.mjs'));
    await cp('data', join(directory, 'data'), { recursive: true });
    await symlink(resolve('node_modules'), join(directory, 'node_modules'), 'junction');
    const registry = join(directory, 'data', 'hospital-locations.ts');
    const hospitals = join(directory, 'data', 'hospitals.ts');
    await writeFile(registry, (await readFile(registry, 'utf8')).replace(/  '(aiims-new-delhi|safdarjung-hospital)': \{[^}]*\},\n/g, ''));
    await writeFile(hospitals, (await readFile(hospitals, 'utf8')).replace(/(id: '(?:aiims-new-delhi|safdarjung-hospital)',[\s\S]*?\n)    lat: [^\n]+\n/g, '$1'));
    await writeFile(join(directory, 'mock.mjs'), `
      import assert from 'node:assert/strict';
      let previous = 0;
      globalThis.fetch = async (url, options) => {
        assert(options.headers['User-Agent'].includes('JeevanSetu-Dataset-Geocoder'));
        assert(Date.now() - previous >= 1095);
        previous = Date.now();
        const query = url.searchParams.get('q');
        const base = { type: 'hospital', category: 'amenity', osm_type: 'way', osm_id: 12345,
          lat: '28.5671', lon: '77.2089', address: { postcode: '110029' } };
        if (query.startsWith('All India Institute')) return Response.json([{ ...base, name: 'AIIMS New Delhi' }]);
        if (query.startsWith('Safdarjung')) return Response.json([
          { ...base, name: 'Safdarjung Hospital' }, { ...base, name: 'Safdarjung Hospital', osm_id: 54321 },
        ]);
        throw new Error('Unexpected lookup for ' + query);
      };
    `);
    const { stdout, stderr } = await execFile(process.execPath, ['--import', './mock.mjs', 'scripts/geocode.mjs', '--write'], { cwd: directory });
    expect(stdout).toContain('2 missing or invalid');
    expect(stdout).toContain('aiims-new-delhi: verified match');
    expect(stderr).toContain('safdarjung-hospital: ambiguous or unverified');
    const updated = await readFile(registry, 'utf8');
    expect(updated).toContain('"aiims-new-delhi": {');
    expect(updated).toContain('"sourceUrl": "https://www.openstreetmap.org/way/12345"');
    expect(updated).not.toContain("'safdarjung-hospital': {");
    const second = await execFile(process.execPath, ['--import', './mock.mjs', 'scripts/geocode.mjs'], { cwd: directory });
    expect(second.stdout).toContain('1 missing or invalid');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 10_000);

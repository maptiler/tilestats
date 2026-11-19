'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs').promises;
const sloppySort = require('./utils/sloppy-sort');
const geostats = require('../');

function fixturePath(fileName) {
  return path.join(__dirname, 'fixtures', fileName);
}

async function getExpected(name) {
  const data = await fs.readFile(
    fixturePath(path.join('expected', name + '.json')),
    'utf8',
  );
  return JSON.parse(data);
}

/**
 * Compares the stats for a fixture with the expected JSON.
 *
 * @param {string} src - Fixture path relative to test/fixtures/src.
 * @param {string} expected - Name of the JSON file in test/fixtures/expected.
 * @param {Object} [options] - Options passed to geostats.
 * @param {boolean} [sort=true] - Sort arrays before comparing, because tile
 *   analysis is async and the order of items is not deterministic.
 */
async function assertStats(src, expected, options, sort = true) {
  const [actual, exp] = await Promise.all([
    geostats(fixturePath(path.join('src', src)), options),
    getExpected(expected),
  ]);
  if (sort) assert.deepEqual(sloppySort(actual), sloppySort(exp));
  else assert.deepEqual(actual, exp);
  return actual;
}

let tmpPath;

before(async() => {
  tmpPath = await fs.mkdtemp(fixturePath('tmp-'));
});

after(() => fs.rm(tmpPath, { recursive: true }));

test('Errors without a file path', async() => {
  await assert.rejects(geostats());
});

test('Errors when MBTiles file not found', async() => {
  await assert.rejects(geostats(fixturePath('doodoodoo.mbtiles')));
});

test('Errors when Mapnik-interpreted file not found', async() => {
  await assert.rejects(geostats(fixturePath('doodoodoo.csv')));
});

test('GeoJSON with many value types, input matching MBTiles, forceAllAttributes', async() => {
  await assertStats('many-types.geojson', 'many-types-geojson', { forceAllAttributes: true, ignoreTranslations: true });
});

test('GeoJSON, ignoreTranslations to false, briefAttributes to power, addLanguages to true', async() => {
  await assertStats('many-types.geojson', 'many-types-geojson-translations', { briefAttributes: 'power', addLanguages: true });
});

// Key difference between the MBTiles and the GeoJSON output now
// is that when Mapnik reads the GeoJSON it inserts `null` values
// in weird places
test('MBTiles with many value types, input matching GeoJSON', async() => {
  await assertStats('many-types.mbtiles', 'many-types-mbtiles');
});

test('GeoJSON with over 100 unique attributes and values, input matching Shapefile and CSV', async() => {
  await assertStats('populations-plus.geojson', 'populations-plus-geojson', undefined, false);
});

// Key difference between the Shapefile and the GeoJSON output right now
// seems to be that the shapefile has converted `null` to `""` in
// predominantly string-valued attributes
test('Shapefile with over 100 unique attributes and values, input matching GeoJSON and CSV', async() => {
  await assertStats('populations-plus/populations-plus.shp', 'populations-plus-shp', undefined, false);
});

// Key difference between the CSV and Shapefile and GeoJSON is that it
// includes X and Y attributes (it also converts `null` to `""`, like Shapefile)
test('CSV with over 100 unique attributes and values, input matching GeoJSON and Shapefile', async() => {
  await assertStats('populations-plus.csv', 'populations-plus-csv', undefined, false);
});

test('MBTiles with gzipped data', async() => {
  await assertStats('vectorgzip.mbtiles', 'vectorgzip');
});

test('MBTiles with raster data', async() => {
  const output = await geostats(fixturePath('src/pngs.mbtiles'));
  assert.deepEqual(output, { layerCount: 0, layers: [] });
});

test('GeoJSON with over 1000 unique attributes', async() => {
  const actual = await assertStats('two-thousand-properties.geojson', 'two-thousand-properties');
  assert.equal(actual.layers[0].attributeCount, 1000, 'attributeCount stops at 1000');
  assert.equal(actual.layers[0].attributes.length, 100, 'attribute details stop at 100');
});

test('GeoJSON with many geometry types', async() => {
  await assertStats('geometry-extravaganza.geojson', 'geometry-extravaganza');
});

test('MBTiles with no features', async() => {
  const output = await geostats(fixturePath('src/no-features.mbtiles'));
  assert.deepEqual(output, { layerCount: 0, layers: [] });
});

test('Shapefile with no features', async() => {
  await assertStats('no-features/no-features.shp', 'no-features');
});

test('CSV with no features', async() => {
  await assertStats('no-features.csv', 'no-features');
});

// Currently this is blocked by a bug in node-mapnik
test.skip('GeoJSON with no features still outputs', async() => {
  const output = await geostats(fixturePath('src/no-features.geojson'));
  assert.deepEqual(output, {
    layerCount: 1,
    layers: [
      {
        attributeCount: 0,
        attributes: [],
        count: 0,
        layer: 'no-features',
      },
    ],
  });
});

test('invalid GeoJSON', async() => {
  await assert.rejects(geostats(fixturePath('src/invalid.geojson')));
});

test('GeoJSON skips invalid geometry types', async() => {
  await assertStats('geometry-invalid-types.geojson', 'geojson-invalid-geometry-types', undefined, false);
});

test('invalid Shapefile', async() => {
  await assert.rejects(geostats(fixturePath('src/invalid.shp')));
});

test('invalid CSV', async() => {
  await assert.rejects(geostats(fixturePath('src/invalid.csv')));
});

test('invalid MBTiles', async() => {
  await assert.rejects(geostats(fixturePath('src/invalid.mbtiles')));
});

test('invalid file format', async() => {
  await assert.rejects(geostats(fixturePath('src/invalid.txt')));
});

test('GeoJSON with specified name attribute', async() => {
  await assertStats('many-types.geojson', 'many-types-geojson-name-only', { attributes: ['name'] });
});

test('GeoJSON with specified attributes', async() => {
  await assertStats('two-thousand-properties.geojson', 'two-thousand-properties-only-two', {
    attributes: ['prop-21', 'prop-1031'],
  });
});

test('Trying to report on more than 100 attributes', async() => {
  const attributes = Array.from({ length: 110 }, (_, i) => 'attr-' + i);
  await assert.rejects(
    geostats(fixturePath('src/populations-plus.geojson'), { attributes }),
    { message: 'Cannot report on more than 100 attributes' },
  );
});

test('GeoJSON with prototype attribute', async() => {
  await assertStats('prototype.geojson', 'prototype');
});

test('truncate attribute names', async() => {
  await assertStats('long-attribute-names.geojson', 'long-attribute-names');
});

test('MBTiles with two layers', async() => {
  await assertStats('two-layers.mbtiles', 'two-layers');
});

test('MBTiles with tilestats metadata table returns as expected', async() => {
  await assertStats('tilestats.mbtiles', 'tilestats');
});

test('option --into-md with non MBTiles file', async() => {
  await assert.rejects(
    geostats(fixturePath('src/many-types.geojson'), { intoMd: true }),
    { message: 'Option --into-md can be used only for mbtiles' },
  );
});

test('MBTiles with option --into-md', async() => {
  const tmpFilename = path.join(tmpPath, 'many-types.mbtiles');
  await fs.copyFile(fixturePath('src/many-types.mbtiles'), tmpFilename);
  const exp = sloppySort(await getExpected('many-types-mbtiles'));

  const act = await geostats(tmpFilename, { intoMd: true });
  assert.deepEqual(sloppySort(act), exp);

  await assert.rejects(
    geostats(tmpFilename, { intoMd: true }),
    { message: 'Tilestats already exist in json record of metadata table, run without --into-md to display them' },
  );

  const preGenStats = await geostats(tmpFilename);
  assert.deepEqual(sloppySort(preGenStats), exp);
});

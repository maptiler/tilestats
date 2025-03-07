'use strict';

const briefAttributesDefault = ['id', 'name', 'name1', 'name2', 'originalid', 'adm0_l', 'amd0_r', 'disputed_name', 'ref', 'fid', 'uuid'];

/**
 * Returns an object bearing stats, formatted for output & reportage.
 *
 * @param {Object} stats - See create-layer-stats.js
 * @param {Object} options
 *   @param {string[]} [options.attributes]
 *   @param {string[]} [options.briefAttributes]
 *   @param {boolean} [options.forceAllAttributes]
 *   @param {number} [options.maxValuesToReport]
 *   @param {boolean} [options.addLanguages]
 * @return {Object} The report, which adheres to the relevant JSON schema.
 */
module.exports = function(stats, options) {

  // if we have a stats object already built from an mbtiles file
  if (!stats.layerCountSet && Number.isInteger(stats.layerCount)) return stats;

  const briefAttributes = options.briefAttributes || briefAttributesDefault;

  const result = {
    layerCount: stats.layerCountSet.size,
    layers: stats.layers.map(reportLayer),
  };

  if (options.addLanguages) {
    result.languages = Array.from(stats.languages);
  }

  return result;

  function reportLayer(layerStats) {
    const result = {
      layer: layerStats.name,
      attributeCount: layerStats.attributeCountSet.size,
      attributes: Object.values(layerStats.attributes).map(reportAttribute),
    };

    const geometry = Array.from(layerStats.geometry);
    if (geometry.length > 1) result.geometry = geometry;
    else if (geometry.length === 1) result.geometry = geometry[0];

    return result;
  }

  function reportAttribute(attribute) {
    const result = Object.assign({}, attribute);

    if (options.forceAllAttributes || options.attributes?.has(attribute.attribute) || !briefAttributes.includes(attribute.attribute)) {
      // Convert the Set to an array of limited size
      const values = [];
      const valueSetIterator = attribute.valueSet.values();
      if (attribute.valueSet.size <= options.maxValuesToReport) {
        let item = valueSetIterator.next();
        while (!item.done) {
          values.push(item.value);
          item = valueSetIterator.next();
        }
        delete result.min;
        delete result.max;
        result.values = values;
      }
    }
    delete result.valueSet;

    return result;
  }
};

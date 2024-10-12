/**
 * Creates a backward search dictionary object from an array.
 *
 * @param {Array<Array<any>>} array An array or searchable elements.
 * @returns {Object} A dictionary object with the elements from the input array
 *          as keys, and their indices as values.
 */
function backdict(array) {
  return Object.fromEntries(unpack(array));
}

/**
 * Creates a dictionary object from key-value pairs.
 *
 * @param {Array<string>} keys An array of keys for the dictionary.
 * @param {Array<any>} values An array of values corresponding to the keys.
 * @returns {Object} A dictionary object with the provided keys and values.
 */
function dict(keys, values) {
  return Object.fromEntries(zip(keys, values));
}

/**
 * Unpacks an array into an array of sub-arrays, each containing an element and
 * its index.
 *
 * @param {Array<any>} array The array to unpack.
 * @returns {Array<Array<any>>} An array containing sub-arrays where each
 *          sub-array contains an element and its index in the input array.
 *          The sub-arrays are ordered by the original index of the elements.
 *          The first element of each sub-array is the element from the input
 *          array, and the second element is the index of that element.
 */
function unpack(array) {
  return array.map((e, i) => [e, i]);
}

/**
 * Inverts the keys and values of a dictionary object.
 *
 * @param {Object} dictionary The dictionary object to invert.
 * @returns {Object} A dictionary object with the inverted keys and values.
 */
function invdict(dictionary) {
  return Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [value, key]),
  );
}

/**
 * Zips two arrays of the same length into an array of sub-arrays.
 *
 * @param {Array<any>} array_1 The first array to be zipped.
 * @param {Array<any>} array_2 The second array to be zipped, with the same
 *        length as `array_1`.
 * @returns {Array<Array<any>>} A new array containing sub-arrays where each
 *          sub-array combines elements at the same index from `array_1` and
 *          `array_2`.
 */
function lzip(array_1, array_2) {
  return array_1.map((e, i) => [e, array_2[i]]);
}

/**
 * Extracts keys and values from a dictionary object.
 *
 * @param {Object} dictionary The dictionary object to extract from.
 * @returns {Array<Array<any>>} An array containing two sub-arrays:
 *          - The first sub-array holds the keys.
 *          - The second sub-array holds the values.
 */
function undict(dictionary) {
  return [Object.keys(dictionary), Object.values(dictionary)];
}

/**
 * Unzips an array of sub-arrays into separate arrays.
 * (Equivalent to the inverse operation of `zip`)
 *
 * @param {Array<Array<any>>} zippedArray The array of sub-arrays to unzip.
 * @returns {Array<Array<any>>} An array containing the unzipped elements
 *                              from the sub-arrays, grouped by their original
 *                              positions in the input array.
 */
function unzip(zipped_array) {
  const maxLength = Math.max(...zipped_array.map((array) => array.length));
  const result = Array.from({ length: maxLength }).map(() => []);
  for (const zipped_item of zipped_array) {
    for (const [i, value] of zipped_item.entries()) {
      result[i].push(value);
    }
  }
  return result;
}

/**
 * Zips multiple arrays into a single array of sub-arrays.
 *
 * @param {...Array<any>} arrays The arrays to be zipped.
 * @returns {Array<Array<any>>} A new array containing sub-arrays where each
 *          sub-array combines elements at the same index from the input
 *          arrays.
 */
function zip(...arrays) {
  const maxLength = Math.max(...arrays.map((array) => array.length));
  return Array.from({ length: maxLength }).map((_, i) =>
    arrays.map((array) => array[i]),
  );
}

export { backdict, dict, invdict, lzip, undict, unpack, unzip, zip };

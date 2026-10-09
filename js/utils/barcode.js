/**
 * Code 128 / Code 39 Offline Barcode Generator (Zero Dependencies)
 * Generates lightweight, crisp SVG barcodes suitable for ID cards and print.
 */

// Code 128 Character Set B encoding patterns (index corresponds to ASCII value - 32)
const CODE128_B_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "233111", "211133"                      // 100-107 (includes START_B: 104, STOP: 106)
];

const START_B = 104;
const STOP = 106;

/**
 * Generate a Code 128B barcode pattern as an array of binary modules (1=bar, 0=space)
 * @param {string} text 
 * @returns {string} String of '1' and '0' bits
 */
export function encodeCode128B(text) {
  const clean = String(text || '0000').trim();
  const codes = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const value = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(value);
    checksum += value * (i + 1);
  }

  const checkVal = checksum % 103;
  codes.push(checkVal);
  codes.push(STOP);

  let binary = "";
  codes.forEach((codeIdx, index) => {
    const pattern = CODE128_B_PATTERNS[codeIdx] || "212222";
    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      binary += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  });
  // Stop pattern terminator bar (2 units)
  binary += "11";
  return binary;
}

/**
 * Generate an inline SVG Barcode string
 * @param {string} text - Value to encode
 * @param {Object} options - Customization options
 * @returns {string} SVG markup
 */
export function generateBarcodeSVG(text = '', options = {}) {
  const {
    width = 160,
    height = 32,
    color = '#000000',
    backgroundColor = 'transparent',
    showText = true,
    fontSize = 8,
    fontFamily = "'Courier New', Courier, monospace"
  } = options;

  const rawText = String(text || '').trim();
  const binary = encodeCode128B(rawText);
  const totalModules = binary.length;
  const barHeight = showText ? height - fontSize - 2 : height;
  const moduleWidth = width / totalModules;

  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < totalModules; i++) {
    const bit = binary[i];
    if (bit === '1' && !inBar) {
      inBar = true;
      barStart = i;
    } else if (bit === '0' && inBar) {
      inBar = false;
      const w = (i - barStart) * moduleWidth;
      const x = barStart * moduleWidth;
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="${color}" />`;
    }
  }

  if (inBar) {
    const w = (totalModules - barStart) * moduleWidth;
    const x = barStart * moduleWidth;
    rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="${color}" />`;
  }

  const textElement = showText ? `
    <text x="${(width / 2).toFixed(2)}" 
          y="${height}" 
          text-anchor="middle" 
          font-family="${fontFamily}" 
          font-size="${fontSize}px" 
          font-weight="600"
          fill="${color}" 
          letter-spacing="1px">${rawText}</text>
  ` : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" 
         viewBox="0 0 ${width} ${height}" 
         width="100%" 
         height="100%" 
         style="background: ${backgroundColor}; display: block; overflow: visible;">
      ${rects}
      ${textElement}
    </svg>
  `.trim();
}

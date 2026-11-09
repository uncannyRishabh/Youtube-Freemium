import { parseLyricsfileYaml, normalizeWordSyncLyrics, timestampToSeconds } from '../src/utils.js';

console.log('=== Testing Word-Sync YAML Parsing & Normalization ===\n');

// Test 1: User's exact fragmented lyrics array should be consolidated into lines with word timestamps
const userSample = [
    ["00:05.89", "Okay, never been shit, never had shit", []],
    ["00:05.89", "Okay, ", []],
    ["00:07.09", "never ", []],
    ["00:07.31", "been ", []],
    ["00:07.53", "shit, ", []],
    ["00:07.74", "never ", []],
    ["00:07.94", "had ", []],
    ["00:07.97", "shit", []],
    ["00:08.26", "Never knew shit, never out, never do shit, damn", []],
    ["00:08.26", "Never ", []],
    ["00:08.69", "knew ", []],
    ["00:08.89", "shit, ", []],
    ["00:09.10", "never ", []],
    ["00:09.37", "out, ", []],
    ["00:09.52", "never ", []],
    ["00:09.75", "do ", []],
    ["00:09.94", "shit, ", []],
    ["00:10.17", "damn", []],
    ["00:10.36", "But a nigga never gave two shits, damn", []],
    ["00:10.36", "But ", []],
    ["00:10.57", "a ", []],
    ["00:10.64", "nigga ", []],
    ["00:10.85", "never ", []],
    ["00:11.07", "gave ", []],
    ["00:11.29", "two ", []],
    ["00:11.48", "shits, ", []],
    ["00:12.74", "damn", []]
];

const consolidated = normalizeWordSyncLyrics(userSample);
console.log('Consolidated lines count:', consolidated.length);

if (consolidated.length !== 3) {
    console.error(`FAIL: Expected 3 consolidated lines, got ${consolidated.length}`);
    process.exit(1);
}

// Verify line 1
const line1 = consolidated[0];
console.log('Line 1 text:', line1[1]);
console.log('Line 1 words count:', line1[2].length);

if (line1[1] !== "Okay, never been shit, never had shit") {
    console.error('FAIL: Line 1 text mismatch');
    process.exit(1);
}
if (line1[2].length !== 7) {
    console.error(`FAIL: Expected 7 words in line 1, got ${line1[2].length}`);
    process.exit(1);
}
if (line1[2][0].text !== "Okay, " || line1[2][0].start !== 5.89 || line1[2][0].end !== 7.09) {
    console.error('FAIL: Word 0 in Line 1 timings mismatch', line1[2][0]);
    process.exit(1);
}

// Test 2: Parse raw YAML with 0-space and 2-space words indentation
const sampleYaml = `
version: "1.0"
lines:
- text: "Okay, never been shit, never had shit"
  start_ms: 5890
  end_ms: 8260
  words:
  - text: "Okay, "
    start_ms: 5890
  - text: "never "
    start_ms: 7090
  - text: "been "
    start_ms: 7310
  - text: "shit, "
    start_ms: 7530
  - text: "never "
    start_ms: 7740
  - text: "had "
    start_ms: 7940
  - text: "shit"
    start_ms: 7970
- text: "Never knew shit, never out, never do shit, damn"
  start_ms: 8260
  end_ms: 10360
  words:
  - text: "Never "
    start_ms: 8260
  - text: "knew "
    start_ms: 8690
`;

const parsedYaml = parseLyricsfileYaml(sampleYaml);
console.log('Parsed YAML lines count:', parsedYaml.length);

if (parsedYaml.length !== 2) {
    console.error(`FAIL: Expected 2 lines from YAML, got ${parsedYaml.length}`);
    process.exit(1);
}

if (parsedYaml[0][2].length !== 7) {
    console.error(`FAIL: Expected 7 words in parsed YAML line 0, got ${parsedYaml[0][2].length}`);
    process.exit(1);
}

console.log('\nAll word-sync tests passed successfully!');

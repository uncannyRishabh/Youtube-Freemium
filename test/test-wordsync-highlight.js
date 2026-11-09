import { parseLyricsfileYaml } from '../src/utils.js';

console.log('=== Testing Word-Sync Spacing & Highlight Tracing State ===\n');

function assert(condition, message) {
    if (!condition) {
        console.error('FAIL:', message);
        process.exit(1);
    }
    console.log('PASS:', message);
}

// Test 1: Verify words parsed from YAML retain natural single space inside word text without extra gap
const sampleYaml = `
version: "1.0"
lines:
- text: "(Mi come a dancehall, mi a- go kill ya with the lingua)"
  start_ms: 1000
  end_ms: 5000
  words:
  - text: "(Mi "
    start_ms: 1000
    end_ms: 1500
  - text: "come "
    start_ms: 1500
    end_ms: 2000
  - text: "a "
    start_ms: 2000
    end_ms: 2500
  - text: "dancehall, "
    start_ms: 2500
    end_ms: 3200
`;

const parsed = parseLyricsfileYaml(sampleYaml);
assert(parsed.length === 1, 'Should have 1 parsed line');
const lineWords = parsed[0][2];
assert(lineWords.length === 4, 'Should have 4 parsed words');

// Words have single space trailing; column-gap: 0 ensures no double-spacing
console.log('Word 0 text:', JSON.stringify(lineWords[0].text));
console.log('Word 1 text:', JSON.stringify(lineWords[1].text));
assert(lineWords[0].text === "(Mi ", 'Word 0 text should preserve trailing space');
assert(lineWords[1].text === "come ", 'Word 1 text should preserve trailing space');

// Test 2: Word sync highlight tracking logic simulation
// Simulating lyric lines state machine across time
const lines = [
    {
        words: [
            { text: "Mi ", start: 1.0, end: 1.5, class: 'yf-word yf-word-upcoming' },
            { text: "come ", start: 1.5, end: 2.0, class: 'yf-word yf-word-upcoming' }
        ]
    },
    {
        words: [
            { text: "dancehall ", start: 2.5, end: 3.5, class: 'yf-word yf-word-upcoming' }
        ]
    }
];

function simulateSync(currentTime, activeIdx) {
    for (let l = 0; l < lines.length; l++) {
        const line = lines[l];
        if (l < activeIdx) {
            for (let w = 0; w < line.words.length; w++) {
                line.words[w].class = 'yf-word yf-word-sung';
            }
        } else if (l === activeIdx) {
            for (let w = 0; w < line.words.length; w++) {
                const word = line.words[w];
                if (currentTime >= word.end) {
                    word.class = 'yf-word yf-word-sung';
                } else if (currentTime >= word.start && currentTime < word.end) {
                    word.class = 'yf-word yf-word-current';
                } else {
                    word.class = 'yf-word yf-word-upcoming';
                }
            }
        } else {
            for (let w = 0; w < line.words.length; w++) {
                line.words[w].class = 'yf-word yf-word-upcoming';
            }
        }
    }
}

// At time 1.7s (line 0 active, word 1 playing):
simulateSync(1.7, 0);
assert(lines[0].words[0].class === 'yf-word yf-word-sung', 'Word 0 should be sung');
assert(lines[0].words[1].class === 'yf-word yf-word-current', 'Word 1 should be current');
assert(lines[1].words[0].class === 'yf-word yf-word-upcoming', 'Line 1 word 0 should be upcoming');

// At time 3.0s (active line moved to line 1):
simulateSync(3.0, 1);
// Line 0 is scrolled away (l < activeIdx): all its words MUST REMAIN yf-word-sung!
assert(lines[0].words[0].class === 'yf-word yf-word-sung', 'Line 0 word 0 must remain sung after scroll away');
assert(lines[0].words[1].class === 'yf-word yf-word-sung', 'Line 0 word 1 must remain sung after scroll away');
assert(lines[1].words[0].class === 'yf-word yf-word-current', 'Line 1 word 0 should be current');

console.log('\nAll word-sync highlight & spacing tests passed successfully!');

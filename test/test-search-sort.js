import { sortResultsByDuration, getSyncTier } from '../src/utils.js';

console.log('=== Testing Search Results Sorting with WordSync Priority & Tiering ===\n');

function assert(condition, message) {
    if (!condition) {
        console.error('FAIL:', message);
        process.exit(1);
    }
    console.log('PASS:', message);
}

// Test 1: Track with wordSynced should be on top even if another track has closer duration
const videoDuration = 210; // 3m 30s

const searchResults = [
    {
        id: 1,
        trackName: 'Track A (Exact duration, plain)',
        duration: 210,
        plainLyrics: 'Some lyrics',
        hasWordSync: false,
        lyricsfile: 'version: 1\nlines:\n  - plain lyrics line' // Has lyricsfile but NOT hasWordSync!
    },
    {
        id: 2,
        trackName: 'Track B (Synced lyrics, diff 15s)',
        duration: 225,
        syncedLyrics: '[00:01.00] Line',
        hasWordSync: false,
        lyricsfile: 'version: 1\nlines:\n  - [00:01.00] Line' // Has lyricsfile but NOT hasWordSync!
    },
    {
        id: 3,
        trackName: 'Track C (Different duration, wordSynced)',
        duration: 240,
        syncedLyrics: '[00:01.00] Line',
        wordSynced: true
    },
    {
        id: 4,
        trackName: 'Track D (hasWordSync, diff 2s)',
        duration: 208,
        syncedLyrics: '[00:01.00] Line',
        hasWordSync: true
    }
];

// Tier check:
assert(getSyncTier(searchResults[0]) === 0, 'Track A with lyricsfile but hasWordSync: false is Tier 0 (plain)');
assert(getSyncTier(searchResults[1]) === 1, 'Track B with lyricsfile and syncedLyrics is Tier 1 (synced, not wordSync)');
assert(getSyncTier(searchResults[2]) === 2, 'Track C with wordSynced: true is Tier 2 (word-synced)');
assert(getSyncTier(searchResults[3]) === 2, 'Track D with hasWordSync: true is Tier 2 (word-synced)');

const sorted = sortResultsByDuration([...searchResults], videoDuration);

console.log('Sorted order:');
sorted.forEach((item, idx) => {
    const tier = getSyncTier(item);
    const tierName = tier === 2 ? 'WORD SYNC' : (tier === 1 ? 'SYNCED' : 'PLAIN');
    console.log(`  ${idx + 1}. [${tierName}] ${item.trackName} (dur: ${item.duration})`);
});

// The first two items MUST be the word synced tracks (Track D and Track C)
assert(
    getSyncTier(sorted[0]) === 2 && getSyncTier(sorted[1]) === 2,
    'Top results must be Tier 2 wordSynced tracks'
);

// Between Track D (dur 208, diff 2) and Track C (dur 240, diff 30), Track D has closer duration so it should be #1
assert(sorted[0].id === 4, 'Track D (closer duration among wordSynced) should be #1');
assert(sorted[1].id === 3, 'Track C (wordSynced) should be #2');

// After wordSynced tracks, Track B (synced) MUST be #3 even though Track A has exact duration (diff 0)!
// Because Synced (Tier 1) > Plain (Tier 0)
assert(sorted[2].id === 2, 'Track B (synced) should be #3 before plain lyrics');
assert(sorted[3].id === 1, 'Track A (plain) should be #4');

console.log('\nAll search sort tests passed successfully!');

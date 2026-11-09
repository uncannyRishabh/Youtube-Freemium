import { normalizeSongTitle, normalizeArtistName, calculateLexicalScore } from '../src/utils.js';

function assert(condition, message) {
    if (!condition) {
        console.error('FAIL:', message);
        process.exit(1);
    }
    console.log('PASS:', message);
}

console.log('=== Testing Normalization & Lexical Matching ===\n');

// Test 1: Title normalization with descriptors
const t1 = normalizeSongTitle('Taken for a Fool (Official Music Video)');
const t2 = normalizeSongTitle('Taken for a Fool');
assert(t1 === 'taken for a fool', `t1 should be 'taken for a fool', got: '${t1}'`);
assert(t2 === 'taken for a fool', `t2 should be 'taken for a fool', got: '${t2}'`);

// Test 2: Artist normalization with - Topic
const a1 = normalizeArtistName('The Strokes - Topic');
const a2 = normalizeArtistName('The Strokes');
assert(a1 === 'the strokes', `a1 should be 'the strokes', got: '${a1}'`);
assert(a2 === 'the strokes', `a2 should be 'the strokes', got: '${a2}'`);

// Test 3: Score calculation between YouTube Video Title & YouTube Music Album Track
const score1 = calculateLexicalScore(
    'Taken for a Fool (Official Music Video)',
    'The Strokes',
    'Taken for a Fool',
    'The Strokes - Topic'
);
console.log('Score 1 (Taken for a Fool):', score1);
assert(score1 >= 0.85, `Score should be >= 0.85, got ${score1}`);

// Test 4: Remastered track title
const score2 = calculateLexicalScore(
    'In the End [Official HD Video]',
    'Linkin Park',
    'In the End (2020 Remaster)',
    'Linkin Park'
);
console.log('Score 2 (In the End):', score2);
assert(score2 >= 0.85, `Score should be >= 0.85, got ${score2}`);

// Test 5: Completely different songs should NOT match
const scoreDiff = calculateLexicalScore(
    'Taken for a Fool',
    'The Strokes',
    'Reptilia',
    'The Strokes'
);
console.log('Score Diff (Taken for a Fool vs Reptilia):', scoreDiff);
assert(scoreDiff < 0.6, `Score should be < 0.6, got ${scoreDiff}`);

// Test 6: Single-word title must NOT match longer candidate containing that word with different artist
const scoreNever = calculateLexicalScore(
    'NEVER',
    'JID',
    'I Was Never There - The Weeknd',
    ''
);
console.log('Score Never vs I Was Never There:', scoreNever);
assert(scoreNever === 0, `Score should be 0, got ${scoreNever}`);

// Test 7: Songs by different artists must NEVER match even with similar words
const scoreDiffArtist = calculateLexicalScore(
    'Heart-Shaped Box',
    'Nirvana',
    'Heart-Shaped Box',
    'Some Other Artist'
);
console.log('Score Diff Artist:', scoreDiffArtist);
assert(scoreDiffArtist === 0, `Score should be 0, got ${scoreDiffArtist}`);

console.log('\nAll lexical unit tests passed successfully!');

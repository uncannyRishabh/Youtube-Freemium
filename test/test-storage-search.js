import { calculateLexicalScore } from '../src/utils.js';

function mockFindSavedLyricsByLexicalSearch(allData, targetTitle, targetArtist) {
    if (!targetTitle) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const [key, record] of Object.entries(allData)) {
        if (key === 'yt-userPrefs' || !record || !record.lyrics || record.message !== 'OK') {
            continue;
        }

        const candidateTitle = record.title || '';
        const candidateArtist = record.channel || record.artist || '';

        const score = calculateLexicalScore(targetTitle, targetArtist, candidateTitle, candidateArtist);
        if (score >= 0.75 && score > highestScore) {
            highestScore = score;
            bestMatch = { ...record, originalUid: key };
        }
    }

    return bestMatch;
}

const mockDatabase = {
    'yt-userPrefs': { fontSize: '24px', profanity: true },
    '0U_jGVEKr9s': {
        title: 'Taken for a Fool (Official Music Video)',
        channel: 'The Strokes',
        lyrics: '[00:10.00] Sister, it feels like just yesterday\n[00:15.00] Sister, don\'t you forget my number on the door',
        message: 'OK',
        synced: true,
        source: 'LRCLIB',
        offset: 0.5
    },
    'anotherVideoId': {
        title: 'Someday',
        channel: 'The Strokes',
        lyrics: '[00:05.00] In many ways, they\'ll miss the good old days',
        message: 'OK',
        synced: true,
        source: 'LRCLIB',
        offset: 0
    }
};

// Searching for the song when played on YouTube Music with different UID 'tJoOmUp3XYQ'
const match = mockFindSavedLyricsByLexicalSearch(mockDatabase, 'Taken for a Fool', 'The Strokes');

console.log('Match found:', match ? {
    originalUid: match.originalUid,
    title: match.title,
    synced: match.synced,
    hasLyrics: !!match.lyrics,
    offset: match.offset
} : 'NONE');

if (!match || match.originalUid !== '0U_jGVEKr9s') {
    console.error('FAIL: Expected match with originalUid 0U_jGVEKr9s');
    process.exit(1);
}

console.log('SUCCESS: Lexical search successfully reused YouTube lyrics for YouTube Music track!');

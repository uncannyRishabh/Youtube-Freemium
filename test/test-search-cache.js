import { SearchMemoryCache } from '../src/utils.js';

console.log('=== Testing SearchMemoryCache (In-Memory, No LocalStorage) ===\n');

function assert(condition, message) {
    if (!condition) {
        console.error('FAIL:', message);
        process.exit(1);
    }
    console.log('PASS:', message);
}

const cache = new SearchMemoryCache(3, 1000); // Max 3 items, 1000ms TTL

// 1. Basic Set and Get
const results1 = [{ id: 1, name: 'Song 1' }];
cache.set('Bohemian Rhapsody - Queen', results1);

assert(cache.has('Bohemian Rhapsody - Queen'), 'Item exists in cache');
assert(cache.get('  bohemian   rhapsody - queen  ') === results1, 'Normalized key hits cache');

// 2. Cache miss on unknown query
assert(cache.get('Another One Bites The Dust') === null, 'Unknown query returns null');

// 3. TTL Expiration
const results2 = [{ id: 2, name: 'Song 2' }];
cache.set('Short TTL Song', results2, 50); // 50ms TTL

assert(cache.get('Short TTL Song') === results2, 'Short TTL item exists immediately');
setTimeout(() => {
    assert(cache.get('Short TTL Song') === null, 'Expired TTL item returns null');

    // 4. LRU Eviction with capacity limit = 3
    const testLru = new SearchMemoryCache(2, 60000); // 2 capacity
    testLru.set('Query A', [{ a: 1 }]);
    testLru.set('Query B', [{ b: 1 }]);
    assert(testLru.has('Query A') && testLru.has('Query B'), 'Initial items in cache');

    // Access Query A so Query B becomes oldest
    testLru.get('Query A');

    // Insert Query C -> Query B should be evicted
    testLru.set('Query C', [{ c: 1 }]);
    assert(testLru.has('Query A'), 'Query A retained (recently accessed)');
    assert(testLru.has('Query C'), 'Query C added');
    assert(!testLru.has('Query B'), 'Query B evicted by LRU');

    console.log('\nAll SearchMemoryCache tests passed successfully!');
}, 70);

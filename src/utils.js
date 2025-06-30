/**
 * Utility functions for Chrome storage and common operations
 */

/**
 * Saves an object to Chrome's local storage
 * @param {string} uid - Unique identifier for storage. If empty, saves object directly
 * @param {object} obj - Object to store
 * @returns {Promise} Promise that resolves when save is complete
 */
export function saveObject(uid, obj) {
	const value = uid === '' ? obj : { [uid]: obj };
	return new Promise((resolve, reject) => {
		chrome.storage.local.set(value, () => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			}
			resolve();
		});
	});
}

/**
 * Retrieves data from Chrome's local storage
 * @param {string} uid - Unique identifier to retrieve
 * @returns {Promise<object>} Promise that resolves with retrieved data
 */
export function getFromStorage(uid) {
	return new Promise((resolve) => {
		chrome.storage.local.get(uid, (result) => {
			if (chrome.runtime.lastError) {
				console.error('Error getting from storage:', chrome.runtime.lastError);
				resolve({});
				return;
			}

			// Update last accessed time for video entries
			if (!isEmpty(result) && result[uid]?.title) {
				result[uid].lastAccessed = Date.now();
				chrome.storage.local.set({ [uid]: result[uid] });
			}

			resolve(result || {});
		});
	});
}

/**
 * Checks if an object is empty or null
 * @param {object} obj - Object to check
 * @returns {boolean} True if object is empty or null
 */
export function isEmpty(obj) {
	return obj == null || Object.keys(obj).length === 0;
}

/**
 * Extracts video ID from a YouTube URL
 * @param {string} url - YouTube video URL
 * @returns {string} Video ID or empty string if not found
 */
export function getVideoID(url) {
	try {
		const urlObject = new URL(url);
		const searchParams = new URLSearchParams(urlObject.search);
		return searchParams.get('v');
	} catch (e) {
		return '';
	}
}

/**
 * Builds a clean search query string
 * @param {string} query - Raw query string
 * @returns {string} Cleaned query string
 */
export function queryBuilder(q, n) {
	try {
		q = q.trim();
		q = q.replace(/\[[^\]]*\]/g, ''); // remove contents within []
		q = q.replace(/\([^)]*\)/g, ''); // remove contents within 
		q = q.replace(/\s+/g, ' '); // replace multiple spaces with a single space
		q = q.replace(/[\t\n]/g, ' '); // replace tabs and newlines with spaces
		// q = q?.replace(/[\s\t\n]/g, '+') //+

		// if (q.split(' ').length < 2 || (q.length < 4 && !q.includes('-'))) {
		if (!q.includes(n))
			q += ' ' + n
		// }

		//TODO:Append verified creator channel name only if one letter title
		return q + " lyrics"
		// return encodeURIComponent(q + "+lyrics")
	}
	catch (e) {
		console.log(e)
		return "(404) lyrics"
	}
}

/**
 * Generates sanitized URL for A-Z Lyrics based on song name and channel
 * @param {string} name 
 * @param {string} channel 
 * @returns 
 */
export function generateA2ZLyricsUrl(name, channel) {
	// Remove channel name from song name if present to avoid duplication in URL
	if (name.includes(channel)) {
		name = name.replace(channel, '');
	}
	//remove all characters after first comma
	let sanitizedArtist = channel.includes(',') ? channel.split(',')[0] : channel;

	// Remove all non-alphanumeric characters and convert to lowercase for channel
	sanitizedArtist = sanitizedArtist.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

	// Remove all non-alphanumeric characters and convert to lowercase for song name
	let sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

	return `https://www.azlyrics.com/lyrics/${findA2ZspecificName(sanitizedArtist)}/${sanitizedName}.html`;
}

function findA2ZspecificName(name) {
	const a2zNames = {
		'theweeknd': 'weeknd',
		'thewanted': 'wanted',
		'thechainsmokers': 'chainsmokers'
	};

	return a2zNames[name] || name;
}


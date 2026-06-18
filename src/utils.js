
export function getDefaultUserPrefs(){
	return {
		profanity:'true',
		kill_shorts:false,
		skipAdsState:'OFF'
	}
}

export const carouselData = [
    {
        header: "Lyrics Sync",
        subtext: "Real-time scrolling for your favorite tracks.",
        link: "https://www.youtube.com/watch?v=xiZUf98A1Ts&list=RDxiZUf98A1Ts&t=47"
    },
    {
        header: "Disable Shorts",
        subtext: "Clean your feed with a single toggle.",
        link: "https://github.com/sponsors/uncannyRishabh"
    },
    {
        header: "Adjust Offset",
        subtext: "Millisecond precision for perfect sync.",
        link: "https://github.com/sponsors/uncannyRishabh"
    }
];

export const fuzzyProfanityDictionary = ['ass', 'bitch', 'bullshit', 'cunt', 'cock', 'dick', 'faggot', 'fuck', 'nigga', 'nigger', 'motherfuck', 'pussy', 'slut', 'shit', 'whore']
export const exactProfanityDictionary = []

/**
 * Saves an object to Chrome's local storage
 * @param {string} uid - Unique identifier for storage. If empty, saves object directly
 * @param {object} obj - Object to store
 * @returns {Promise} Promise that resolves when save is complete
 */
export async function saveObject(uid, obj) {
	// Get current prefs
	if (uid === 'yt-userPrefs') {
		const currentPrefs = await getFromStorage('yt-userPrefs');
		// Merge obj into currentPrefs['yt-userPrefs']
		const updatedPrefs = { ...currentPrefs['yt-userPrefs'], ...obj };
		obj = updatedPrefs;

		console.log('UID: ' + uid + ' obj : ' + obj)
		console.log(obj)
	}

	// Save back to storage
	return new Promise((resolve, reject) => {
		chrome.storage.local.set({ [uid]: obj }, () => {
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

	//replace all $ with s
	sanitizedArtist = sanitizedArtist.replaceAll('$', 's').trim();

	// Remove all non-alphanumeric characters and convert to lowercase for channel
	sanitizedArtist = sanitizedArtist.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();

	// remove all characters between brackets
	let sanitizedName = name.replaceAll(/\[.*?\]/g, '').trim();
	
	// Remove all non-alphanumeric characters and convert to lowercase for song name
	sanitizedName = sanitizedName.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();

	return `https://www.azlyrics.com/lyrics/${findA2ZspecificName(sanitizedArtist)}/${sanitizedName}.html`;
}

function findA2ZspecificName(name) {
	const a2zNames = {
		'theweeknd': 'weeknd',
		'thewanted': 'wanted',
		'thechainsmokers': 'chainsmokers',
		
	};

	return a2zNames[name] || name;
}

function findLRCLibspecificName(name) {
	const lrcLibNames = {
		'TYDOLLA$IGN': 'Ty Dolla $ign'	
	};

	return lrcLibNames[name] || name;
}

export async function searchLrclibdotnet(track, artist, signal) {
	// try {
		const myHeaders = new Headers();
		myHeaders.append("Referer", "Freemium by - @uncannyRishabh");
		
		const requestOptions = {
			method: "GET",
			redirect: "follow",
			headers: myHeaders,
			signal
		};

		var url = generateLRCLIBUrl(track, artist)
		console.log('searching LRCLIB : ', url)
		return await fetch(url, requestOptions)
	// } catch (error) {
	// 	console.log('LRCLIB fetch aborted - previous search cancelled', error);
        
    //     return new Response(JSON.stringify({
    //         "message": "Failed to find specified track",
    //         "name": "TrackNotFound",
    //         "statusCode": 404
    //     }), {
    //         status: 404,
    //         statusText: "Not Found",
    //         headers: { 'Content-Type': 'application/json' }
    //     });
    // }
}

function generateLRCLIBUrl(track, artist){
	// remove commas
	track = track.replaceAll(',', '').trim();

	// remove contents within []
	track = track.replace(/\[[^\]]*\]/g, '');

	// remove all special characters between brackets ()
	track = track.replaceAll(/\(.*?\)/g, '').trim();

	track = track.replaceAll('feat','')
	track = track.replaceAll('featuring','')
	
	// remove commas
	artist = artist.replaceAll(',', '').trim();
	// remove all special characters between brackets
	artist = artist.replaceAll(/\(.*?\)/g, '').trim();
	
	track = track.replaceAll(' ','+');
	artist = artist.replaceAll(' ','+');

	track = encodeURI(track)
	artist = encodeURI(findLRCLibspecificName(artist))
	
	return `https://lrclib.net/api/get?artist_name=${artist}&track_name=${track}`;
}

/**
 * Accepts image and outputs 3 prominent colors (Unused)
 * @param {*} img 
 * @returns 
 */
export function extractProminentColors(img) {
	const ctx = canvas.getContext('2d');
	// Downscale canvas for performance
	const scale = Math.min(100 / img.width, 100 / img.height);
	canvas.width = img.width * scale;
	canvas.height = img.height * scale;

	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
	const colorCounts = {};

	// This value determines the granularity of color grouping.
	// A higher value means fewer groups and faster processing.
	const colorQuantization = 8;

	for (let i = 0; i < imageData.length; i += 4) {
		const r = imageData[i];
		const g = imageData[i + 1];
		const b = imageData[i + 2];
		const a = imageData[i + 3];

		// Ignore transparent or near-transparent pixels
		if (a < 128) continue;

		// Quantize colors to group similar shades together
		const r_q = Math.round(r / colorQuantization) * colorQuantization;
		const g_q = Math.round(g / colorQuantization) * colorQuantization;
		const b_q = Math.round(b / colorQuantization) * colorQuantization;

		const colorKey = `${r_q},${g_q},${b_q}`;
		colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
	}

	const sortedColors = Object.keys(colorCounts)
		.map(key => ({
			color: key.split(',').map(Number),
			count: colorCounts[key]
		}))
		.sort((a, b) => b.count - a.count);

	// --- Select the final colors ---
	const bubbleColors = sortedColors.slice(0, 3).map(c => `rgb(${c.color.join(',')})`);

	// Find a light color for the background
	let backgroundColor = '#f0f4f8'; // Default fallback
	const lightestColor = sortedColors.find(c => {
		const [r, g, b] = c.color;
		const brightness = (r * 299 + g * 587 + b * 114) / 1000; // Perceived brightness
		return brightness > 200; // Look for a very light color
	});

	if (lightestColor) {
		backgroundColor = `rgb(${lightestColor.color.join(',')})`;
	} else if (sortedColors.length > 0) {
		// If no light color is found, create one by lightening the most prominent color
		const [r, g, b] = sortedColors[0].color;
		backgroundColor = `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`;
	}

	return { bubbleColors, backgroundColor };
}

export async function findLyricsfromSources(tabId, source, val, channel, signal) {
	var result;

	switch (source) {
		case 'BING': {
			result = await searchBing(tabId, val, channel, signal)
			break;
		}
		case 'A2Z': {
			result = await searchA2Z(tabId, val, channel, signal)
			break;
		}
		case 'LRCLIB': {
			result = await searchLRCLIB(tabId, val, channel, signal)
			break;
		}
		default: {
			result = await searchLRCLIB(tabId, val, channel, signal)
			if (isEmpty(result[0].result) || JSON.parse(result[0].result).message === 'NOK') {
				result = await searchA2Z(tabId, val, channel, signal)
				if (isEmpty(result[0].result) || JSON.parse(result[0].result).message === 'NOK') {
					result = await searchBing(tabId, val, channel, signal)
				}
			}
		}
	}

	return result;
}

async function searchLRCLIB(tabId, name, channel, signal) {

	if (name.includes(channel)) {
		name = name.replace(channel, '')
	}

	var response = await (await searchLrclibdotnet(name, channel, signal)).text()
	//Todo : fallback logic when multiple artists search with all artists, if not found search with first
	return await chrome.scripting.executeScript({
		target: { tabId },
		function: (resp) => {
			var resp = JSON.parse(resp)
			var lyrics = []
			var message = 'NOK'
			var source = 'LRCLIB'
			var synced = false
			var name = resp?.name

			/**
			 * {
					"message": "Failed to find specified track",
					"name": "TrackNotFound",
					"statusCode": 404
				}
			*/

			if ((name && name != 'TrackNotFound') && resp?.plainLyrics != null) {
				message = 'OK'
				synced = resp.syncedLyrics != null
			}
			if (message == 'OK' && synced) {
				lyrics = resp.syncedLyrics?.replaceAll('[', '').split('\n').map(line => line.split(']'))
				lyrics = sanitizeAndInsertLyrics(lyrics)
			}
			else if (message == 'OK' && !synced) {
				lyrics = resp.plainLyrics.split('\n')
			}

			function isValidTimestamp(timestamp) {
				// \d{2} matches two digits for MM and SS
				// \.\d{2,3} matches a literal dot followed by 2 or 3 digits for milliseconds
				const pattern = /^\d{1,2}:\d{1,2}\.\d{2,3}$/;
				return pattern.test(timestamp);
			}

			function sanitizeAndInsertLyrics(lyrics) {
				const sortedLyrics = [];

				//remove metadata
				lyrics = lyrics.filter(line => {
					if (line[0] && isValidTimestamp(line[0])) {
						return true;
					}
				})

				lyrics.forEach(line => {
					// Safety check
					if (!Array.isArray(line) || line.length < 2) return;

					const lyricText = line[line.length - 1];
					const timestamps = line.slice(0, -1);

					timestamps.forEach(ts => {
						if (!isValidTimestamp(ts)) return;

						// Find the first index where the existing timestamp is later than the new one
						const insertIndex = sortedLyrics.findIndex(item => ts.localeCompare(item[0]) < 0);

						if (insertIndex === -1) {
							// If the timestamp is later than everything currently in the array, push to the end
							sortedLyrics.push([ts, lyricText]);
						} else {
							// Insert the [timestamp, lyric] pair exactly where it fits
							sortedLyrics.splice(insertIndex, 0, [ts, lyricText]);
						}
					});
				});

				return sortedLyrics;
			};

			var r = { lyrics, message, source, synced }
			return JSON.stringify(r)
		},
		args: [response]
	});
}

async function searchBing(tabId, name, channel, signal) {
	var myHeaders = {
		'accept-language': 'en-US,en-IN;q=0.9,en;q=0.8',
		'cache-control': 'no-cache',
		'dnt': '1',
		'pragma': 'no-cache',
		'priority': 'u=0, i',
		'sec-ch-ua-bitness': '"64"',
		'sec-ch-ua-full-version': '"124.0.6367.208"',
		'sec-ch-ua-full-version-list': '"Chromium";v="124.0.6367.208", "Google Chrome";v="124.0.6367.208", "Not-A.Brand";v="99.0.0.0"',
		'sec-ch-ua-mobile': '?1',
		'sec-ch-ua-model': '"Nexus 5"',
		'sec-ch-ua-platform': '"Android"',
		'sec-ch-ua-platform-version': '"6.0"',
		'sec-fetch-dest': 'document',
		'sec-fetch-mode': 'navigate',
		'sec-fetch-site': 'same-origin',
		'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
	}

	var requestOptions = {
		method: 'GET',
		headers: myHeaders,
		redirect: 'follow',
		signal
	};

	var mq = encodeURIComponent(queryBuilder(name, channel))
	var url = `https://www.bing.com/search?q=${mq}`
	console.log('searching bing : ', url)
	var response = await (await fetch(url, requestOptions)).text();

	//Handle not found
	return await chrome.scripting.executeScript({
		target: { tabId },
		function: (resp) => {
			// console.log(resp)
			var lyrics = []
			var message = ''
			var source = 'BING'
			var synced = false
			const parser = new DOMParser();
			// Remove <base> tag to avoid CSP violation
			const sanitizedResp = resp.replace(/<base\b[^>]*>/gi, '');
			const doc = parser.parseFromString(sanitizedResp, 'text/html');
			// const lContainer = doc.querySelector('#kp-wp-tab-default_tab\\:kc\\:\\/music\\/recording_cluster\\:lyrics > div > div')
			var lyricBody = doc.querySelector('.lyric_body')
			var lContainer = lyricBody ? doc.querySelectorAll('.lyric_body .verse') : doc.querySelectorAll('#lyric_body .verse')
			const b_TopTitle = doc.querySelector('.b_topTitle')

			//Alternate container
			if (b_TopTitle && b_TopTitle.textContent === "Lyrics") {
				lContainer = doc.querySelector('.l_tac_facts')
			}

			if (lContainer != null && Object.keys(lContainer).length != 0) {
				// console.log(lContainer.textContent)
				message = 'OK'
				// lContainer.querySelectorAll('span').forEach(span => {
				// 	lyrics.push(span.textContent.trim());
				// });

				var raw = ''
				lContainer.forEach(verse => raw += verse.innerHTML)
				// console.log(raw)
				if (raw.length > 0) {
					var wd = raw.replaceAll(/<\/?div[^>]*>/g, '');
					lyrics = wd.split('<br>').map(line => line.trim()).filter(Boolean);
				}
				else {
					message = 'NOK'
				}

				// console.log(lyrics);
			}
			else {
				message = 'NOK'
			}

			//VALIDATE HERE
			var r = { lyrics, message, source, synced }
			// console.log(r)
			return JSON.stringify(r)
		},
		args: [response]
	});
}

async function searchA2Z(tabId, name, channel, signal) {
	const requestOptions = {
		method: "GET",
		redirect: "follow",
		signal
	};

	if (name.includes(channel)) {
		name = name.replace(channel, '')
	}

	var url = generateA2ZLyricsUrl(name, channel)
	console.log('searching A2Z : ', url)
	var response = await fetch(encodeURI(url), requestOptions)
	var page = await response.text()

	return await chrome.scripting.executeScript({
		target: { tabId },
		function: (resp) => {
			// console.log(resp)
			var lyrics = []
			var message = ''
			var source = 'A2Z'
			var synced = false
			const parser = new DOMParser();
			// Remove <base> tag to avoid CSP violation
			const sanitizedResp = resp.replace(/<base\b[^>]*>/gi, '');
			const doc = parser.parseFromString(sanitizedResp, 'text/html');

			let look = true;
			let raw = ''
			let refDiv = doc.querySelector(".ringtone");
			if (refDiv && refDiv.nextElementSibling) {
				while (look && refDiv.nextElementSibling) {
					refDiv = refDiv.nextElementSibling;
					if (refDiv.tagName === 'DIV') {
						look = false;
						raw = refDiv.textContent
					}
				}
				var wd = raw.replaceAll(/<\/?div[^>]*>/g, '');
				var lyrics = wd.split('\n').map(line => line.trim()).filter(Boolean)
			}

			message = (lyrics != undefined && lyrics.length > 0) ? "OK" : "NOK"
			var r = { lyrics, message, source, synced }
			// console.log(r)
			return JSON.stringify(r)
		},
		args: [page]
	});
}

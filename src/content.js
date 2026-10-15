var player, lyricContainer, moveRequired, insidePrimary, observer
var primaryInner, secondaryInner
var YT_SELECTORS, YTF_SELECTORS

(async () => {
	console.log('Script Injected')
	
	try {
		const constants = await import(chrome.runtime.getURL('ytf-constants.js'));
		YT_SELECTORS = constants.YT_SELECTORS;
		YTF_SELECTORS = constants.YTF_SELECTORS;
	} catch (e) {
		console.error('Failed to import constants, falling back to defaults:', e);
	}

	// Fallback definitions in case dynamic import fails
	if (!YT_SELECTORS) {
		YT_SELECTORS = {
			LAYOUT: {
				PRIMARY: 'ytd-watch-flexy #primary > #primary-inner',
				SECONDARY: 'ytd-watch-flexy #secondary',
				TARGET: (isNarrow) => isNarrow ? 'ytd-watch-flexy #primary > #primary-inner' : 'ytd-watch-flexy #secondary'
			},
			METADATA: {
				MUSIC_BADGE: 'button-view-model a',
				FALLBACK_TITLE: '#above-the-fold > #title',
				FALLBACK_CHANNEL: '#upload-info > #channel-name > div > div'
			},
			SHORTS: {
				RICH_SECTION_SHELF: 'ytd-rich-section-renderer ytd-rich-shelf-renderer',
				HIDE_CLASS: 'hide-youtube-shelves'
			}
		};
	}
	if (!YTF_SELECTORS) {
		YTF_SELECTORS = {
			CONTAINER: {
				CLASS: '.yf-container',
				IN_PRIMARY: 'ytd-watch-flexy #primary > #primary-inner > #yf-container',
				IN_SECONDARY: 'ytd-watch-flexy #secondary > #yf-container'
			},
			HEADER: {
				PROGRESS_BAR: '#ytf-progressbar',
				NOW_PLAYING_LABEL: '.now-playing'
			}
		};
	}

	// Load user preferences
	var userPrefs = await getFromStorage('yt-userPrefs');

	var kill_shorts = userPrefs['yt-userPrefs']?.kill_shorts;

	var preconnect1 = document.createElement("link");
	preconnect1.rel = "preconnect";
	preconnect1.href = "https://fonts.googleapis.com";
	document.head.appendChild(preconnect1);

	var preconnect2 = document.createElement("link");
	preconnect2.rel = "preconnect";
	preconnect2.href = "https://fonts.gstatic.com";
	preconnect2.crossOrigin = "";
	document.head.appendChild(preconnect2);

	moveRequired = document.querySelector(YT_SELECTORS.LAYOUT.TARGET(window.innerWidth < 1000)) == null;

	const style = document.createElement('style');
	style.textContent = `
		.hide-youtube-shelves ytd-rich-shelf-renderer,
		.hide-youtube-shelves ytd-reel-shelf-renderer {
			display: none !important;
		}
	`;

	document.head.appendChild(style);
	if (kill_shorts) {
		document.documentElement.classList.toggle(YT_SELECTORS.SHORTS.HIDE_CLASS);
	}

	chrome.runtime.onMessage.addListener(async (obj, sender, res) => {
		const { type, val } = obj;

    	var ytc = document.querySelector(YT_SELECTORS.LAYOUT.TARGET(window.innerWidth < 1000));

		switch (type) {
			case 'NEW_SEARCH': {
				if (!ytc) {
					res({ 'name': '', 'channel': '' })
					break;
				}

				var container = ytc.querySelector(YTF_SELECTORS.CONTAINER.CLASS)
				var progressbar = ytc.querySelector(YTF_SELECTORS.HEADER.PROGRESS_BAR)
				var nowPlaying = ytc.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_LABEL)
				var music = document.querySelector(YT_SELECTORS.METADATA.MUSIC_BADGE)
				var isMusic = music === null ? false : (music.textContent == 'Music')

				if (container && container.getAttribute('data-uid') === val) {
					res({ 'name': '', 'channel': '' })
					break;
				}

				if (isMusic) {
					if (progressbar) {
						progressbar.style.visibility = 'visible'
						progressbar.classList.add("pure-material-progress-linear");
						progressbar.classList.remove("no-animate")
					}
					if (nowPlaying) nowPlaying.textContent = 'Searching -'
				}
				let title = document.querySelector(YT_SELECTORS.METADATA.FALLBACK_TITLE)?.textContent.trim();
				let channel = document.querySelector(YT_SELECTORS.METADATA.FALLBACK_CHANNEL)?.textContent.trim();
				console.log('Content.js :::: ' + title + " - " + channel)

				if (title && channel) {
					res({ 'name': title, 'channel': channel })
				}
				else {
					res({ 'name': '', 'channel': '' })
				}

				break;
			}
			case 'DISPLAY_LYRICS': {
				break;
			}
			default: {
				console.log('cjs : Unknown command')
			}
		}

	})

	
	/**
	 * Retrieves data from Chrome's local storage
	 * @param {string} uid - Unique identifier to retrieve
	 * @returns {Promise<object>} Promise that resolves with retrieved data
	 */
	function getFromStorage(uid) {
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
	function isEmpty(obj) {
		return obj == null || Object.keys(obj).length === 0;
	}


})();

function hideShelfRenderer() {
	const elements = document.querySelectorAll('ytd-rich-section-renderer ytd-rich-shelf-renderer');
	elements.forEach(el => {
		el.style.display = 'none';
	});
}

// // Initial check in case it's already loaded
// hideShelfRenderer();

// function observePlayer() {
// 	if(lyricContainer == null){
// 		lyricContainer = document.querySelector(window.innerWidth < 1000 ? '#primary > #primary-inner > #below > #yf-container' : '#secondary > #secondary-inner > #yf-container');
// 	}
// 	if (insidePrimary && lyricContainer) {
// 		player.style.width = `${lyricContainer.style.width}px`;
// 	}
// }

function windowResize() {
	const inPrimarySelector = YTF_SELECTORS?.CONTAINER?.IN_PRIMARY || 'ytd-watch-flexy #primary > #primary-inner > #yf-container';
	const inSecondarySelector = YTF_SELECTORS?.CONTAINER?.IN_SECONDARY || 'ytd-watch-flexy #secondary > #yf-container';

	insidePrimary = document.querySelector(inPrimarySelector);
	moveRequired = document.querySelector(window.innerWidth < 1000
		? inPrimarySelector
		: inSecondarySelector
	) == null;

	if (moveRequired) {
		if (insidePrimary) {
			moveDivToSecondary();
		}
		else {
			moveDivToPrimary();
		}
	}
}

function moveDivToPrimary() {
	const secondaryContainerSelector = YTF_SELECTORS?.CONTAINER?.IN_SECONDARY || 'ytd-watch-flexy #secondary > #yf-container';
	const primaryInnerSelector = YT_SELECTORS?.LAYOUT?.PRIMARY || 'ytd-watch-flexy #primary > #primary-inner';

	lyricContainer = document.querySelector(secondaryContainerSelector);

	if (lyricContainer) {
		lyricContainer.classList.add('ytf-container-marginTop');
		if (primaryInner == null) {
			primaryInner = document.querySelector(primaryInnerSelector);
		}
		const firstChild = primaryInner?.children[1];

		if (firstChild) {
			primaryInner.insertBefore(lyricContainer, firstChild);
		}
	}
}

function moveDivToSecondary() {
	const primaryContainerSelector = YTF_SELECTORS?.CONTAINER?.IN_PRIMARY || 'ytd-watch-flexy #primary > #primary-inner > #yf-container';
	const secondarySelector = YT_SELECTORS?.LAYOUT?.SECONDARY || 'ytd-watch-flexy #secondary';

	lyricContainer = document.querySelector(primaryContainerSelector);

	if (lyricContainer) {
		lyricContainer.classList.remove('ytf-container-marginTop');
		if (secondaryInner == null) {
			secondaryInner = document.querySelector(secondarySelector);
		}
		const firstChild = secondaryInner?.firstChild;

		if (firstChild) {
			secondaryInner.insertBefore(lyricContainer, firstChild);
		}
	}
}

// function getAlbumArtColors() {
//   const colorThief = new ColorThief();
//   const img = document.querySelector("#items > yt-video-attribute-view-model > div > a > div.yt-video-attribute-view-model__hero-section > img");

//   if (img) {
//     img.crossOrigin = "Anonymous";
//     if (img.complete) {
//       const palette = colorThief.getPalette(img, 3);
//       console.log(palette);
//     } else {
//       img.addEventListener('load', function() {
//         const palette = colorThief.getPalette(img, 3);
//         console.log(palette);
//       });
//     }
//   }
// }

window.onresize = windowResize;

// getAlbumArtColors();

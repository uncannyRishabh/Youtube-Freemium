var player, lyricContainer, moveRequired, insidePrimary, observer
var primaryInner, secondaryInner
var YT_SELECTORS, YTF_SELECTORS

(async () => {
	console.log('Script Injected');

	YT_SELECTORS = {
		LAYOUT: {
			PRIMARY: 'ytd-watch-flexy #primary > #primary-inner',
			SECONDARY: 'ytd-watch-flexy #secondary',
			TARGET: (isNarrow) => isNarrow ? 'ytd-watch-flexy #primary > #primary-inner' : 'ytd-watch-flexy #secondary'
		},
		METADATA: {
			MUSIC_BADGE: 'button-view-model a',
			MUSIC_HEADER_TITLE: '#header-container #title',
			MUSIC_CARD_CONTAINERS: [
				'#items > yt-video-attribute-view-model:nth-child(1)',
				'ytd-structured-description-content-renderer #items > yt-video-attribute-view-model:nth-child(1)',
				'.yt-video-attribute-view-model__metadata',
				'.ytVideoAttributeViewModelContentContainer'
			],
			MUSIC_CARD_TITLE_SUFFIX: ' > div.yt-video-attribute-view-model__secondary > div.yt-video-attribute-view-model__title',
			MUSIC_CARD_ARTIST_SUFFIX: ' > div.yt-video-attribute-view-model__secondary > div.yt-video-attribute-view-model__subtitle',
			FALLBACK_TITLE: '#above-the-fold h1, ytd-watch-metadata #title, #above-the-fold #title',
			FALLBACK_CHANNEL: '#upload-info > #channel-name > div > div'
		},
		SHORTS: {
			RICH_SECTION_SHELF: 'ytd-rich-section-renderer ytd-rich-shelf-renderer',
			HIDE_CLASS: 'hide-youtube-shelves'
		}
	};

	YTF_SELECTORS = {
		CONTAINER: {
			ROOT: '#yf-container',
			CLASS: '.yf-container',
			IN_PRIMARY: 'ytd-watch-flexy #primary > #primary-inner > #yf-container',
			IN_SECONDARY: 'ytd-watch-flexy #secondary > #yf-container',
			SWAP_TARGETS: '#searchingDiv, #intermediateContainer, #lyricContainer, #notFound',
			COLLAPSED_CLASS: 'collapsed'
		},
		HEADER: {
			PROGRESS_BAR: '#ytf-progressbar',
			NOW_PLAYING_LABEL: '.now-playing',
			NOW_PLAYING_INPUT: '.now-playing-text-input',
			COLLAPSE_BTN: '#yf-collapse-btn',
			COLLAPSE_BTN_CLASS: '.yf-collapse-btn'
		}
	};

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

	function getUrlVideoID(url) {
		try {
			const urlObj = new URL(url || window.location.href);
			return urlObj.searchParams.get('v');
		} catch (e) {
			return null;
		}
	}

	let lastReportedUid = null;

	function extractPageMetadata(watchFlexy) {
		const cleanField = (str) => str?.replace(/\b(feat|ft)\b\.?/i, '').trim() || '';

		const musicBadge = watchFlexy.querySelector(YT_SELECTORS.METADATA.MUSIC_BADGE);
		const isMusic = musicBadge != null && musicBadge.textContent.trim() === 'Music';

		let title = '';
		let channel = '';

		if (isMusic) {
			const cardContainer = YT_SELECTORS.METADATA.MUSIC_CARD_CONTAINERS.find(s => watchFlexy.querySelector(s) !== null);

			if (cardContainer) {
				title = cleanField(watchFlexy.querySelector(cardContainer + YT_SELECTORS.METADATA.MUSIC_CARD_TITLE_SUFFIX)?.textContent);
				channel = cleanField(watchFlexy.querySelector(cardContainer + YT_SELECTORS.METADATA.MUSIC_CARD_ARTIST_SUFFIX)?.textContent);
			}

			if (!title || !channel) {
				title = cleanField(watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_TITLE)?.textContent);
				channel = cleanField(watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_CHANNEL)?.textContent);
			}
		} else {
			title = cleanField(watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_TITLE)?.textContent);
			channel = cleanField(watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_CHANNEL)?.textContent);
		}

		return { isMusic, title, channel };
	}

	function notifyPageReady() {
		if (!window.location.pathname.startsWith('/watch')) {
			lastReportedUid = null;
			return;
		}

		const currentUid = getUrlVideoID(window.location.href);
		if (!currentUid) {
			return;
		}

		const watchFlexy = document.querySelector('ytd-watch-flexy:not([hidden])');
		const domUid = watchFlexy?.getAttribute('video-id');

		// Wait until watchFlexy is active and matches the URL's video ID
		if (!watchFlexy || domUid !== currentUid) {
			return;
		}

		const titleEl = watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_TITLE);
		const titleText = titleEl?.textContent?.trim();
		if (!titleText || titleText.length === 0) {
			return;
		}

		if (currentUid === lastReportedUid) {
			return;
		}

		lastReportedUid = currentUid;
		const { isMusic, title, channel } = extractPageMetadata(watchFlexy);

		// If it's a music video, activate the search indicator immediately
		if (isMusic) {
			const ytc = document.querySelector(YT_SELECTORS.LAYOUT.TARGET(window.innerWidth < 1000));
			const progressbar = ytc?.querySelector(YTF_SELECTORS.HEADER.PROGRESS_BAR);
			const nowPlaying = ytc?.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_LABEL);
			if (progressbar) {
				progressbar.style.visibility = 'visible';
				progressbar.classList.add('pure-material-progress-linear');
				progressbar.classList.remove('no-animate');
			}
			if (nowPlaying) nowPlaying.textContent = 'Searching -';
		} else {
			// Video is not a music video: ensure container remains closed
			const ytc = document.querySelector(YT_SELECTORS.LAYOUT.TARGET(window.innerWidth < 1000));
			const container = ytc?.querySelector(YTF_SELECTORS.CONTAINER.CLASS);
			if (container) {
				container.classList.add(YTF_SELECTORS.CONTAINER.COLLAPSED_CLASS);
				const collapseBtn = container.querySelector(YTF_SELECTORS.HEADER.COLLAPSE_BTN) || container.querySelector(YTF_SELECTORS.HEADER.COLLAPSE_BTN_CLASS);
				if (collapseBtn) collapseBtn.title = 'Expand';
			}
		}

		chrome.runtime.sendMessage({
			type: 'YOUTUBE_PAGE_DATA_UPDATED',
			uid: currentUid,
			url: window.location.href,
			isMusic: isMusic,
			title: title,
			channel: channel
		});
	}

	window.addEventListener('yt-navigate-start', () => {
		lastReportedUid = null;
		chrome.runtime.sendMessage({
			type: 'YOUTUBE_NAVIGATE_START',
			url: window.location.href
		});
		const container = document.querySelector(YTF_SELECTORS.CONTAINER.CLASS);
		if (container) {
			container.removeAttribute('data-uid');
			const progressbar = container.querySelector(YTF_SELECTORS.HEADER.PROGRESS_BAR);
			if (progressbar) {
				progressbar.classList.remove('pure-material-progress-linear');
				progressbar.classList.add('no-animate');
				progressbar.style.visibility = 'hidden';
			}
			const nowPlayingInput = container.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_INPUT);
			if (nowPlayingInput) {
				nowPlayingInput.value = '';
				nowPlayingInput.placeholder = '';
				nowPlayingInput.removeAttribute('data-current-title');
			}
			const nowPlayingLabel = container.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_LABEL);
			if (nowPlayingLabel) {
				nowPlayingLabel.textContent = '';
			}
			const existingContent = container.querySelector(YTF_SELECTORS.CONTAINER.SWAP_TARGETS);
			if (existingContent) {
				existingContent.remove();
			}
		}
	});

	window.addEventListener('yt-page-data-updated', notifyPageReady);
	window.addEventListener('yt-navigate-finish', notifyPageReady);

	// Push-based DOM observer on YouTube page manager to reactively detect video transitions
	const pageObserver = new MutationObserver(() => {
		if (window.location.pathname.startsWith('/watch')) {
			notifyPageReady();
		}
	});

	function setupPageObserver() {
		const targetNode = document.querySelector('ytd-page-manager') || document.querySelector('ytd-app') || document.body;
		if (targetNode) {
			pageObserver.observe(targetNode, {
				attributes: true,
				attributeFilter: ['video-id', 'hidden'],
				childList: true,
				subtree: true
			});
		}
	}

	setupPageObserver();

	if (window.location.pathname.startsWith('/watch')) {
		notifyPageReady();
	}

	chrome.runtime.onMessage.addListener(async (obj, sender, res) => {
		const { type, val } = obj;

    	var ytc = document.querySelector(YT_SELECTORS.LAYOUT.TARGET(window.innerWidth < 1000));

		switch (type) {
			case 'NEW_SEARCH': {
				if (!ytc) {
					res({ 'name': '', 'channel': '' });
					break;
				}

				var container = ytc.querySelector(YTF_SELECTORS.CONTAINER.CLASS);
				var progressbar = ytc.querySelector(YTF_SELECTORS.HEADER.PROGRESS_BAR);
				var nowPlaying = ytc.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_LABEL);

				const watchFlexy = document.querySelector('ytd-watch-flexy:not([hidden])');
				const domUid = watchFlexy?.getAttribute('video-id');

				// If container already displays this exact video, skip redundant search
				if (container && container.getAttribute('data-uid') === val && domUid === val) {
					res({ 'name': '', 'channel': '', 'alreadyRendered': true });
					break;
				}

				// If watchFlexy is not ready for the requested video ID, report not ready
				if (!watchFlexy || (val && domUid !== val)) {
					res({ 'name': '', 'channel': '', 'notReady': true });
					break;
				}

				const { isMusic, title, channel } = extractPageMetadata(watchFlexy);

				if (isMusic) {
					if (progressbar) {
						progressbar.style.visibility = 'visible';
						progressbar.classList.add('pure-material-progress-linear');
						progressbar.classList.remove('no-animate');
					}
					if (nowPlaying) nowPlaying.textContent = 'Searching -';
				}

				console.log('Content.js :::: ' + title + ' - ' + channel);
				res({ 'name': title, 'channel': channel, 'isMusic': isMusic });

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

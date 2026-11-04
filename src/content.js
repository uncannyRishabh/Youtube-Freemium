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
			ATTRIBUTES_SECTION: 'yt-video-attributes-section-view-model, ytd-video-description-music-section-renderer, ytd-horizontal-card-list-renderer',
			SECTION_HEADER_TITLE: '.videoAttributesSectionViewModelTitle, .yt-video-attributes-section-view-model__title, #header-container #title, h3, h2, #title',
			MUSIC_CARD_ELEMENTS: [
				'yt-video-attribute-view-model',
				'.yt-video-attribute-view-model__metadata',
				'.ytVideoAttributeViewModelContentContainer'
			],
			MUSIC_CARD_CONTAINERS: [
				'.yt-video-attribute-view-model__metadata',
				'.ytVideoAttributeViewModelContentContainer'
			],
			MUSIC_CARD_TITLE_SUFFIX: ' > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)',
			MUSIC_CARD_ARTIST_SUFFIX: ' > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)',
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

		#ytf-progressbar {
			position: absolute !important;
			top: 0 !important;
			left: 0 !important;
			width: 100% !important;
			height: 2px !important;
			min-height: 2px !important;
			z-index: 20 !important;
			border-radius: 12px 12px 0 0 !important;
			pointer-events: none !important;
			box-sizing: border-box !important;
			border: none !important;
			-webkit-appearance: none !important;
			appearance: none !important;
			background-color: transparent !important;
		}

		#ytf-progressbar.pure-material-progress-linear {
			visibility: visible !important;
			opacity: 1 !important;
			color: #e21 !important;
			background-color: var(--yt-spec-raised-background, #212121) !important;
		}

		#ytf-progressbar.no-animate {
			visibility: hidden !important;
			opacity: 0 !important;
			animation: none !important;
			background-image: none !important;
		}

		.yf-container {
			overflow: hidden !important;
			transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
		}

		.yf-container.collapsed {
			max-height: 50px !important;
			overflow: hidden !important;
		}

		.yf-container.collapsed .intermediateContainer,
		.yf-container.collapsed #searchingDiv,
		.yf-container.collapsed #notFound,
		.yf-container.collapsed #yf-search-results,
		.yf-container.collapsed #yf-search-dropdown,
		.yf-container.collapsed #yf-dropdown {
			display: none !important;
		}

		.yf-container.collapsed .yf-header-bottom {
			display: none !important;
		}

		.yf-container.collapsed .yf-menu {
			opacity: 0 !important;
			visibility: hidden !important;
			pointer-events: none !important;
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

	function normalizeToken(str) {
		return String(str || '')
			.toLowerCase()
			.replace(/[\u2010-\u2015\u2212]/g, '-')
			.replace(/[^\p{L}\p{N}\s]/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function cleanField(str) {
		return String(str || '')
			.replace(/\b(feat|ft)\b\.?/i, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function isMusicCardFresh(cardTitle, cardArtist, fallbackTitle, fallbackChannel) {
		if (!cardTitle) return false;
		if (cardArtist && /\(born\s+\d{4}\)/i.test(cardArtist)) return false;

		const normCardTitle = normalizeToken(cardTitle);
		const normCardArtist = normalizeToken(cardArtist);
		const normFallbackTitle = normalizeToken(fallbackTitle);
		const normFallbackChannel = normalizeToken(fallbackChannel);

		if (!normCardTitle || !normFallbackTitle) return false;

		if (normFallbackTitle.includes(normCardTitle) || normCardTitle.includes(normFallbackTitle)) {
			return true;
		}

		if (normCardArtist && (normFallbackChannel.includes(normCardArtist) || normFallbackTitle.includes(normCardArtist))) {
			return true;
		}

		const cardTokens = normCardTitle.split(/\s+/).filter(t => t.length > 2);
		if (cardTokens.length > 0) {
			const matchingTokens = cardTokens.filter(t => normFallbackTitle.includes(t));
			if (matchingTokens.length >= Math.ceil(cardTokens.length * 0.6)) {
				return true;
			}
		}

		return false;
	}

	function extractMusicCard(watchFlexy, fallbackTitle, fallbackChannel) {
		const isExcludedSection = (sec) => {
			const header = sec.querySelector(
				YT_SELECTORS.METADATA.SECTION_HEADER_TITLE || '.videoAttributesSectionViewModelTitle, .yt-video-attributes-section-view-model__title, #header-container #title, h3, h2, #title'
			)?.textContent?.trim()?.toLowerCase() || '';
			return header.includes('people') || header.includes('cast') || header.includes('game') || header.includes('place') || header.includes('creator');
		};

		const isMusicSection = (sec) => {
			const header = sec.querySelector(
				YT_SELECTORS.METADATA.SECTION_HEADER_TITLE || '.videoAttributesSectionViewModelTitle, .yt-video-attributes-section-view-model__title, #header-container #title, h3, h2, #title'
			)?.textContent?.trim()?.toLowerCase() || '';
			if (
				header.includes('music') ||
				header.includes('song') ||
				header.includes('música') ||
				header.includes('musique') ||
				header.includes('musik')
			) {
				return true;
			}
			const badge = sec.querySelector(YT_SELECTORS.METADATA.MUSIC_BADGE);
			if (badge && badge.textContent.trim().toLowerCase().includes('music')) {
				return true;
			}
			return false;
		};

		const extractDetailsFromCard = (cardEl) => {
			if (!cardEl) return null;

			const parentSec = cardEl.closest('yt-video-attributes-section-view-model, ytd-horizontal-card-list-renderer');
			if (parentSec && isExcludedSection(parentSec)) {
				return null;
			}

			let titleEl = cardEl.querySelector(
				'.ytVideoAttributeViewModelTitle, .yt-video-attribute-view-model__title'
			);
			let artistEl = cardEl.querySelector(
				'.ytVideoAttributeViewModelSubtitle, .yt-video-attribute-view-model__subtitle, .yt-video-attribute-view-model__secondary-subtitle'
			);

			if (!titleEl) {
				titleEl = cardEl.querySelector(
					'.ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1), .yt-video-attribute-view-model__metadata > :nth-child(1) > :nth-child(1), .yt-video-attribute-view-model__secondary > :nth-child(1)'
				);
			}
			if (!artistEl) {
				artistEl = cardEl.querySelector(
					'.ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2), .yt-video-attribute-view-model__metadata > :nth-child(1) > :nth-child(2), .yt-video-attribute-view-model__secondary > :nth-child(2)'
				);
			}

			const title = cleanField(titleEl?.textContent);
			const artist = cleanField(artistEl?.textContent);

			if (!title) return null;

			// Reject biographical person subtitles (e.g. "Rapper (born 1992)")
			if (artist && /\(born\s+\d{4}\)/i.test(artist)) {
				return null;
			}

			return { title, artist };
		};

		const sectionSelector = YT_SELECTORS.METADATA.ATTRIBUTES_SECTION || 'yt-video-attributes-section-view-model, ytd-video-description-music-section-renderer, ytd-horizontal-card-list-renderer';
		const sections = Array.from(watchFlexy.querySelectorAll(sectionSelector));

		let musicSections = sections.filter(isMusicSection);

		// If no section explicitly matched "Music", check if music badge is inside a section
		if (musicSections.length === 0) {
			const musicBadge = watchFlexy.querySelector(YT_SELECTORS.METADATA.MUSIC_BADGE);
			if (musicBadge) {
				const badgeSec = musicBadge.closest(sectionSelector);
				if (badgeSec && !isExcludedSection(badgeSec)) {
					musicSections.push(badgeSec);
				}
			}
		}

		let candidateCards = [];
		if (musicSections.length > 0) {
			for (const sec of musicSections) {
				let cards = Array.from(sec.querySelectorAll('yt-video-attribute-view-model'));
				if (cards.length === 0) {
					cards = Array.from(sec.querySelectorAll('.yt-video-attribute-view-model__metadata, .ytVideoAttributeViewModelContentContainer'));
				}
				candidateCards.push(...cards);
			}
		} else {
			const allCards = Array.from(
				watchFlexy.querySelectorAll(
					'yt-video-attribute-view-model, .yt-video-attribute-view-model__metadata, .ytVideoAttributeViewModelContentContainer'
				)
			);
			candidateCards = allCards.filter(c => {
				const sec = c.closest('yt-video-attributes-section-view-model, ytd-horizontal-card-list-renderer');
				return !sec || !isExcludedSection(sec);
			});
		}

		let firstValidCandidate = null;
		for (const card of candidateCards) {
			const details = extractDetailsFromCard(card);
			if (!details) continue;

			if (isMusicCardFresh(details.title, details.artist, fallbackTitle, fallbackChannel)) {
				return { title: details.title, artist: details.artist, isCardValid: true };
			}

			if (!firstValidCandidate && musicSections.length > 0) {
				firstValidCandidate = details;
			}
		}

		if (firstValidCandidate) {
			return { title: firstValidCandidate.title, artist: firstValidCandidate.artist, isCardValid: true };
		}

		return null;
	}

	function parseFallbackMetadata(fallbackTitle, fallbackChannel) {
		let rawTitle = String(fallbackTitle || '').trim();
		let rawChannel = String(fallbackChannel || '').trim();

		let cleanedTitle = rawTitle
			.replace(/\[[^\]]*\]/g, '')
			.replace(/\((?:official\s*(?:video|audio|music\s*video|lyric\s*video)?|lyrics?|visualizer|remastered|audio|hd|4k)\)/gi, '')
			.replace(/\b(official\s*(?:music\s*)?video|official\s*audio|lyric\s*video)\b/gi, '')
			.replace(/\s+/g, ' ')
			.trim();

		let title = '';
		let channel = '';

		const dashMatch = cleanedTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
		if (dashMatch) {
			const part1 = dashMatch[1].trim();
			const part2 = dashMatch[2].trim();
			const normChannel = normalizeToken(rawChannel);

			if (normChannel && normalizeToken(part1).includes(normChannel)) {
				channel = part1;
				title = part2;
			} else if (normChannel && normalizeToken(part2).includes(normChannel)) {
				channel = part2;
				title = part1;
			} else {
				channel = part1;
				title = part2;
			}
		} else {
			title = cleanedTitle;
			channel = rawChannel.replace(/\s*-\s*Topic$/i, '').trim();
		}

		return {
			title: cleanField(title),
			channel: cleanField(channel)
		};
	}

	let lastReportedSignature = null;
	let pendingRetryTimer = null;

	function extractPageMetadata(watchFlexy) {
		const musicBadge = watchFlexy.querySelector(YT_SELECTORS.METADATA.MUSIC_BADGE);
		const isMusic = musicBadge != null && musicBadge.textContent.trim() === 'Music';

		const fallbackTitleEl = watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_TITLE);
		const fallbackTitle = fallbackTitleEl?.textContent?.trim() || '';

		const fallbackChannelEl = watchFlexy.querySelector(YT_SELECTORS.METADATA.FALLBACK_CHANNEL);
		const fallbackChannel = fallbackChannelEl?.textContent?.trim() || '';

		let title = '';
		let channel = '';
		let isCardValid = false;

		const cardResult = extractMusicCard(watchFlexy, fallbackTitle, fallbackChannel);

		if (cardResult) {
			title = cardResult.title;
			channel = cardResult.artist;
			isCardValid = cardResult.isCardValid;
		}

		if (!isCardValid && fallbackTitle) {
			const fallbackParsed = parseFallbackMetadata(fallbackTitle, fallbackChannel);
			if (fallbackParsed.title) {
				title = fallbackParsed.title;
				channel = fallbackParsed.channel;
			}
		}

		return { isMusic, title, channel, isCardValid, fallbackTitle, fallbackChannel };
	}

	function notifyPageReady() {
		if (!window.location.pathname.startsWith('/watch')) {
			lastReportedSignature = null;
			if (pendingRetryTimer) clearTimeout(pendingRetryTimer);
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
		const fallbackTitle = titleEl?.textContent?.trim();
		if (!fallbackTitle || fallbackTitle.length === 0) {
			return;
		}

		const metadata = extractPageMetadata(watchFlexy);
		const { isMusic, title, channel, isCardValid } = metadata;

		// If music badge exists but card is not fresh yet, YouTube is still rendering the description.
		// Wait briefly for the fresh music card mutation before dispatching.
		if (isMusic && !isCardValid) {
			if (!pendingRetryTimer) {
				pendingRetryTimer = setTimeout(() => {
					pendingRetryTimer = null;
					notifyPageReady();
				}, 400);
			}
			if (!lastReportedSignature || !lastReportedSignature.startsWith(currentUid + ':')) {
				return;
			}
		}

		if (pendingRetryTimer) {
			clearTimeout(pendingRetryTimer);
			pendingRetryTimer = null;
		}

		if (!title) {
			return;
		}

		const currentSignature = `${currentUid}:${isMusic}:${title}:${channel}`;
		if (currentSignature === lastReportedSignature) {
			return;
		}

		lastReportedSignature = currentSignature;

		// Activate the search indicator immediately
		const ytc = document.querySelector(YT_SELECTORS.LAYOUT.TARGET(window.innerWidth < 1000));
		const progressbar = ytc?.querySelector(YTF_SELECTORS.HEADER.PROGRESS_BAR);
		const nowPlaying = ytc?.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_LABEL);
		const nowPlayingInput = ytc?.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_INPUT);

		if (isMusic) {
			if (progressbar) {
				progressbar.style.visibility = 'visible';
				progressbar.style.opacity = '1';
				progressbar.classList.add('pure-material-progress-linear');
				progressbar.classList.remove('no-animate');
			}
			if (nowPlaying) nowPlaying.textContent = 'Searching -';
			if (nowPlayingInput && title) {
				const dispTitle = channel && !title.includes(' - ') && !title.toLowerCase().includes(channel.toLowerCase())
					? `${title} - ${channel}`
					: title;
				nowPlayingInput.value = dispTitle;
				nowPlayingInput.setAttribute('data-current-title', dispTitle);
			}
		} else {
			// Video is not a music video: ensure container remains closed
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
		lastReportedSignature = null;
		if (pendingRetryTimer) {
			clearTimeout(pendingRetryTimer);
			pendingRetryTimer = null;
		}
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
				progressbar.style.opacity = '0';
			}
			const nowPlayingInput = container.querySelector(YTF_SELECTORS.HEADER.NOW_PLAYING_INPUT);
			if (nowPlayingInput) {
				nowPlayingInput.value = '';
				nowPlayingInput.placeholder = 'song - artist';
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

window.onresize = windowResize;

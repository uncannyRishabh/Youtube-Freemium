/**
 * content-ytm.js
 * YouTube Music Dedicated Content Script for YouTube Freemium.
 * Strictly scoped to https://music.youtube.com/* - contains zero regular YouTube logic.
 */

(() => {
	console.log('[Freemium] YouTube Music Script Injected');

	const YTM_SELECTORS = {
		PLAYER_BAR: {
			ROOT: 'ytmusic-player-bar',
			TITLE: 'ytmusic-player-bar .title',
			BYLINE: 'ytmusic-player-bar .byline',
			ARTIST_LINK: 'ytmusic-player-bar .byline a[href*="/channel/"]'
		},
		LAYOUT: {
			PLAYER_PAGE: 'ytmusic-player-page#player-page',
			SIDE_PANEL: 'ytmusic-player-page #side-panel',
			TAB_RENDERER: 'ytmusic-player-page #tab-renderer',
			TABS: 'ytmusic-player-page tp-yt-paper-tab.tab-header',
			SECTION_LIST: 'ytmusic-tab-renderer#tab-renderer ytmusic-section-list-renderer',
			DESCRIPTION_SHELF: 'ytmusic-description-shelf-renderer',
			CONTENTS: 'ytmusic-tab-renderer#tab-renderer ytmusic-section-list-renderer #contents'
		},
		YTF: {
			CONTAINER: '#yf-container',
			CONTAINER_CLASS: '.yf-container',
			PROGRESS_BAR: '#ytf-progressbar',
			NOW_PLAYING_INPUT: '.now-playing-text-input',
			NOW_PLAYING_LABEL: '.now-playing'
		}
	};

	let lastReportedSignature = null;
	let pendingDebounceTimer = null;

	function cleanField(str) {
		return String(str || '')
			.replace(/\b(feat|ft)\b\.?/i, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function getUrlVideoID(url) {
		try {
			const moviePlayer = document.getElementById('movie_player');
			if (moviePlayer && typeof moviePlayer.getVideoData === 'function') {
				const vid = moviePlayer.getVideoData()?.video_id;
				if (vid) return vid;
			}
		} catch (e) {}

		try {
			const urlObj = new URL(url || window.location.href);
			return urlObj.searchParams.get('v');
		} catch (e) {
			return null;
		}
	}

	/**
	 * Extracts current track title and artist from YouTube Music DOM elements or mediaSession fallback.
	 */
	function extractTrackMetadata() {
		const bar = document.querySelector(YTM_SELECTORS.PLAYER_BAR.ROOT);

		// 1. Song Title
		let title = '';
		const titleEl = bar?.querySelector(YTM_SELECTORS.PLAYER_BAR.TITLE);
		if (titleEl) {
			title = titleEl.getAttribute('title') || titleEl.textContent?.trim() || '';
		}

		// 2. Artist
		let artist = '';
		const artistLink = bar?.querySelector(YTM_SELECTORS.PLAYER_BAR.ARTIST_LINK);
		if (artistLink) {
			artist = artistLink.textContent?.trim() || '';
		}
		if (!artist) {
			const bylineEl = bar?.querySelector(YTM_SELECTORS.PLAYER_BAR.BYLINE);
			if (bylineEl) {
				const fullByline = bylineEl.textContent?.trim() || '';
				const parts = fullByline.split('•').map(p => p.trim()).filter(Boolean);
				if (parts.length > 0) {
					artist = parts[0];
				}
			}
		}

		// 3. Fallback to navigator.mediaSession
		if (!title && navigator.mediaSession?.metadata?.title) {
			title = navigator.mediaSession.metadata.title;
		}
		if (!artist && navigator.mediaSession?.metadata?.artist) {
			artist = navigator.mediaSession.metadata.artist;
		}

		return {
			title: cleanField(title),
			artist: cleanField(artist)
		};
	}

	/**
	 * Detects whether YouTube Music has changed songs and notifies background script.
	 */
	function notifyTrackChange() {
		let urlUid = null;
		try {
			const urlObj = new URL(window.location.href);
			urlUid = urlObj.searchParams.get('v');
		} catch (e) {}

		const moviePlayer = document.getElementById('movie_player');
		const mpData = (moviePlayer && typeof moviePlayer.getVideoData === 'function')
			? moviePlayer.getVideoData()
			: null;

		// Guard: If URL specifies a video ID but moviePlayer is still holding the previous track's video ID,
		// the player has not completed switching yet. Wait for the transition to avoid stale metadata broadcast.
		if (urlUid && mpData?.video_id && mpData.video_id !== urlUid) {
			return;
		}

		let currentUid = (mpData && mpData.video_id) ? mpData.video_id : urlUid;
		let title = (mpData && mpData.title) ? cleanField(mpData.title) : '';
		let artist = (mpData && mpData.author) ? cleanField(mpData.author) : '';

		const domMeta = extractTrackMetadata();
		if (!title) title = domMeta.title;
		if (!artist) artist = domMeta.artist;

		if (!title) {
			return;
		}

		const currentSignature = `${currentUid || 'unknown'}:${title}:${artist}`;
		if (currentSignature === lastReportedSignature) {
			return;
		}

		lastReportedSignature = currentSignature;

		// Immediately reflect searching indicator and reset stale data-uid on live container if present
		const container = document.querySelector(YTM_SELECTORS.YTF.CONTAINER_CLASS);
		if (container) {
			container.removeAttribute('data-uid');
			container._currentUid = null;

			const progressbar = container.querySelector(YTM_SELECTORS.YTF.PROGRESS_BAR);
			const nowPlaying = container.querySelector(YTM_SELECTORS.YTF.NOW_PLAYING_LABEL);
			const nowPlayingInput = container.querySelector(YTM_SELECTORS.YTF.NOW_PLAYING_INPUT);

			if (progressbar) {
				progressbar.style.visibility = 'visible';
				progressbar.style.opacity = '1';
				progressbar.classList.add('pure-material-progress-linear');
				progressbar.classList.remove('no-animate');
			}
			if (nowPlaying) nowPlaying.textContent = 'Searching -';
			if (nowPlayingInput && title) {
				const dispTitle = artist && !title.includes(' - ') && !title.toLowerCase().includes(artist.toLowerCase())
					? `${title} - ${artist}`
					: title;
				nowPlayingInput.value = dispTitle;
				nowPlayingInput.setAttribute('data-current-title', dispTitle);
			}
		}

		chrome.runtime.sendMessage({
			type: 'YTMUSIC_PAGE_DATA_UPDATED',
			uid: currentUid,
			url: window.location.href,
			isMusic: true,
			title: title,
			channel: artist
		});
	}

	function debouncedTrackChange() {
		if (pendingDebounceTimer) {
			clearTimeout(pendingDebounceTimer);
		}
		pendingDebounceTimer = setTimeout(() => {
			pendingDebounceTimer = null;
			notifyTrackChange();
		}, 100);
	}

	// 1. Listen to YouTube Music navigation events
	window.addEventListener('yt-navigate-start', () => {
		chrome.runtime.sendMessage({ type: 'YOUTUBE_NAVIGATE_START' });
	});
	window.addEventListener('yt-navigate-finish', debouncedTrackChange);
	window.addEventListener('yt-page-data-updated', debouncedTrackChange);
	window.addEventListener('popstate', debouncedTrackChange);

	// Also catch video element metadata changes directly
	document.addEventListener('loadedmetadata', (e) => {
		if (e.target && e.target.tagName === 'VIDEO') {
			debouncedTrackChange();
		}
	}, true);

	// 2. Observe mutations on the persistent YouTube Music player bar
	let playerBarObserver = null;
	function setupPlayerBarObserver() {
		const playerBar = document.querySelector(YTM_SELECTORS.PLAYER_BAR.ROOT);
		if (playerBar && !playerBarObserver) {
			playerBarObserver = new MutationObserver(() => {
				debouncedTrackChange();
			});
			playerBarObserver.observe(playerBar, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: ['title']
			});
			// Initial check
			notifyTrackChange();
		}
	}

	let pageObserver = null;
	function setupPageObserver() {
		const playerPage = document.querySelector(YTM_SELECTORS.LAYOUT.PLAYER_PAGE);
		const sidePanel = document.querySelector(YTM_SELECTORS.LAYOUT.SIDE_PANEL) ||
			document.querySelector('ytmusic-player-page #side-panel');
		if (playerPage && !pageObserver) {
			pageObserver = new MutationObserver(() => {
				checkAndMountUnderLyricsTab();
			});
			pageObserver.observe(playerPage, {
				attributes: true,
				attributeFilter: ['player-ui-state', 'player-page-ui-state', 'fullscreen', 'player-fullscreened', 'is-fullscreen', 'video-mode_', 'video-mode', 'hidden', 'visibility']
			});
			if (sidePanel) {
				pageObserver.observe(sidePanel, {
					attributes: true,
					attributeFilter: ['hidden', 'visibility', 'aria-hidden', 'style']
				});
			}
		}
	}

	// 3. Fallback body observer to discover player bar and page layout upon initial SPA load
	const appObserver = new MutationObserver(() => {
		if (!playerBarObserver) {
			setupPlayerBarObserver();
		}
		if (!pageObserver) {
			setupPageObserver();
		}
		// Also re-verify if tab changed to LYRICS or fullscreen state changed
		checkAndMountUnderLyricsTab();
	});

	appObserver.observe(document.body, {
		childList: true,
		subtree: true
	});

	setupPlayerBarObserver();
	setupPageObserver();

	function isPlayerFullscreen() {
		if (document.fullscreenElement || document.webkitFullscreenElement) return true;
		const playerPage = document.querySelector(YTM_SELECTORS.LAYOUT.PLAYER_PAGE);
		if (playerPage) {
			const state = (playerPage.getAttribute('player-ui-state') || playerPage.getAttribute('player-page-ui-state') || '').toUpperCase();
			if (state === 'FULLSCREEN') return true;
			if (playerPage.hasAttribute('fullscreen') || playerPage.hasAttribute('player-fullscreened') || playerPage.hasAttribute('is-fullscreen')) return true;
		}
		const sidePanel = document.querySelector(YTM_SELECTORS.LAYOUT.SIDE_PANEL) ||
			document.querySelector('ytmusic-player-page #side-panel');
		if (sidePanel) {
			if (sidePanel.hasAttribute('hidden') || sidePanel.getAttribute('aria-hidden') === 'true' || sidePanel.getAttribute('visibility') === 'HIDDEN') return true;
			try {
				const style = window.getComputedStyle(sidePanel);
				if (style.display === 'none' || style.visibility === 'hidden') return true;
			} catch (e) {}
		}
		return false;
	}

	/**
	 * Ensures the Freemium container is mounted inside YouTube Music's #side-panel
	 * and only displayed whenever the user selects the "LYRICS" tab and is not in fullscreen.
	 */
	function checkAndMountUnderLyricsTab() {
		const container = document.querySelector(YTM_SELECTORS.YTF.CONTAINER_CLASS);
		if (!container) return;

		const sidePanel = document.querySelector(YTM_SELECTORS.LAYOUT.SIDE_PANEL) ||
			document.querySelector('ytmusic-player-page #side-panel');

		if (sidePanel) {
			container.setAttribute('data-platform', 'ytmusic');
			if (!container.getAttribute('data-ytm-mode')) {
				container.setAttribute('data-ytm-mode', 'freemium');
			}
			if (!container.getAttribute('data-search-state')) {
				container.setAttribute('data-search-state', 'collapsed');
			}
			if (container.parentElement !== sidePanel) {
				sidePanel.appendChild(container);
			}
			sidePanel.setAttribute('data-ytf-mode', container.getAttribute('data-ytm-mode'));

			// Check if Lyrics tab is active and not in fullscreen video mode
			const isLyricsTab = !!document.querySelector('ytmusic-tab-renderer#tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"]');
			const isFullscreen = isPlayerFullscreen();
			container.style.display = (isLyricsTab && !isFullscreen) ? '' : 'none';
		}
	}

	// Listen to tab clicks to immediately verify mounting
	document.addEventListener('click', (e) => {
		if (e.target.closest(YTM_SELECTORS.LAYOUT.TABS) || e.target.closest('tp-yt-paper-tab')) {
			setTimeout(checkAndMountUnderLyricsTab, 50);
		}
	});

	// Listen to fullscreen changes to immediately hide/show container
	document.addEventListener('fullscreenchange', checkAndMountUnderLyricsTab);
	document.addEventListener('webkitfullscreenchange', checkAndMountUnderLyricsTab);
	window.addEventListener('resize', checkAndMountUnderLyricsTab);

	// Listen for runtime messages from background
	chrome.runtime.onMessage.addListener((obj, sender, res) => {
		const { type, val } = obj;

		if (type === 'NEW_SEARCH') {
			const currentUid = getUrlVideoID(window.location.href);
			const { title, artist } = extractTrackMetadata();
			res({
				name: title,
				channel: artist,
				isMusic: true,
				uid: currentUid
			});
		}
	});

})();

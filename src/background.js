import { saveObject, getFromStorage, isEmpty, getVideoID, queryBuilder, getDefaultUserPrefs, fuzzyProfanityDictionary, findLyricsfromSources, searchLrclibRecords, fetchLrclibRecordById, parseLyricsfileYaml } from './utils.js';
import { YT_SELECTORS, YTF_SELECTORS } from './ytf-constants.js';

(() => {

    let currentSearchController = null;

    // State management
    let currentState = {
        tabTitle: undefined,
        reqUrl: '',
        complete: false,
        process: false,
        navigation: false,
        tabList: [],
        uid: ''
    };

    const ONINSTALL_REASON_INSTALL = 'install';
    const ONINSTALL_REASON_UPDATE = 'update';
    const YOUTUBE_URL = "youtube.com";
    const YOUTUBE_WATCH_URL = YOUTUBE_URL + "/watch";
    const CHANGE_INFO_STATUS_LOADING = 'loading';
    const CHANGE_INFO_STATUS_COMPLETE = 'complete';
    const TRANSITION_FORWARD_BACK = 'forward_back';

    /**
     * Clamps font size to a valid range [14px, 36px] with a fallback.
     */
    function normalizeFontSize(rawSize, defaultPx = 24) {
        const parsed = parseFloat(rawSize);
        const clamped = (!isNaN(parsed) ? Math.min(Math.max(parsed, 14), 36) : defaultPx);
        return Math.round(clamped) + 'px';
    }

    /**
     * Parses an offset value to a finite float, or returns the fallback.
     */
    function parseOffset(offsetVal, fallback = 0.0) {
        const num = parseFloat(offsetVal);
        return (!isNaN(num) && isFinite(num)) ? num : fallback;
    }

    /**
     * Constructs a unified display title combining track title and artist name.
     */
    function buildDisplayTitle(title, artist) {
        if (!title) return '';
        if (artist && !title.includes(' - ') && !title.toLowerCase().includes(artist.toLowerCase())) {
            return `${title} - ${artist}`;
        }
        return title;
    }

    /**
     * Handles extension installation/update events
     */
    chrome.runtime.onInstalled.addListener(function (details) {
        if (details.reason == ONINSTALL_REASON_INSTALL) {
            reloadRelevantTabs();
        } else if (details.reason == ONINSTALL_REASON_UPDATE) {
            console.log("Goated extension just got updated");
            chrome.action.setBadgeText({ text: ' ' });
            chrome.action.setBadgeBackgroundColor({ color: '#ffffffff' });
            reloadRelevantTabs();
        }
    });

    function reloadRelevantTabs() {
        chrome.tabs.query({ url: "*://*.youtube.com/watch?*" }, function (tabs) {
            tabs.forEach(tab => {
                var tabId = tab.id;
                chrome.scripting.executeScript({
                    target: { tabId },
                    function: () => {
                        window.location.reload();
                    }
                });
            });
        });
    }

    /**
     * Handles tab updates
     */
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tabInfo) {
        if (tabInfo.url && tabInfo.url.includes(YOUTUBE_WATCH_URL)) {
            if (changeInfo.status && changeInfo.status === CHANGE_INFO_STATUS_LOADING) {
                currentState.complete = false;
                currentState.navigation = false;
            }
            if (changeInfo.status && changeInfo.status === CHANGE_INFO_STATUS_COMPLETE) {
                if (currentState.navigation) {
                    currentState.navigation = false;
                    currentState.tabTitle = tabInfo.title;
                    currentState.uid = getVideoID(tabInfo.url);
                    main(tabInfo.url, tabId);
                }
            }
            if (changeInfo.title) {
                currentState.tabTitle = tabInfo.title;
                currentState.uid = getVideoID(tabInfo.url);
                main(tabInfo.url, tabId);
            }
        }
    });

    /**
     * Handles YouTube forward and backward navigation
     */
    chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
        if (details.url && details.url.includes(YOUTUBE_WATCH_URL)) {
            chrome.tabs.get(details.tabId, function (tab) {
                if (tab.title != 'Youtube') currentState.tabTitle = tab.title;
            });
            if (details.frameId === 0 && currentState.process != true) {
                currentState.complete = true;
            }
            if (details.transitionQualifiers.includes(TRANSITION_FORWARD_BACK)) {
                currentState.navigation = true;
            }
        }
    });

    /**
     * Handles tab closure
     */
    chrome.tabs.onRemoved.addListener((tabId) => {
        if (currentState.tabList.includes(tabId)) {
            currentState.tabList = currentState.tabList.filter(id => id !== tabId);
        }
    });

    /**
     * Handles messages from content script
     */
    chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => {
        const { type, val, action } = obj;

        if (action === 'clearUpdateBadge') {
            chrome.action.setBadgeText({ text: '' });
        }

        switch (type) {
            case 'YOUTUBE_NAVIGATE_START': {
                if (currentSearchController) {
                    currentSearchController.abort('Navigation started');
                }
                currentState.uid = null;
                break;
            }
            case 'YOUTUBE_PAGE_DATA_UPDATED': {
                const targetUrl = obj.url || sender.tab?.url;
                const targetTabId = sender.tab?.id;
                if (targetUrl && targetTabId && targetUrl.includes(YOUTUBE_WATCH_URL)) {
                    currentState.tabTitle = sender.tab?.title;
                    currentState.uid = obj.uid || getVideoID(targetUrl);
                    main(targetUrl, targetTabId, {
                        isMusic: obj.isMusic,
                        title: obj.title,
                        channel: obj.channel
                    });
                }
                break;
            }
            case 'SEARCH_LRCLIB': {
                const query = val || obj.query;
                searchLrclibRecords(query).then((results) => {
                    sendResponse({ success: true, results });
                }).catch((err) => {
                    sendResponse({ success: false, error: err.message, results: [] });
                });
                return true;
            }
            case 'FETCH_LRCLIB_RECORD': {
                const recordId = val || obj.id;
                fetchLrclibRecordById(recordId).then((record) => {
                    sendResponse({ success: true, record });
                }).catch((err) => {
                    sendResponse({ success: false, error: err.message });
                });
                return true;
            }
            case 'SAVE_SELECTED_LYRICS': {
                const targetUid = obj.uid;
                const data = obj.data || {};
                if (targetUid) {
                    saveObject(targetUid, {
                        ...data,
                        userSelected: true,
                        message: 'OK',
                        lastAccessed: Date.now()
                    }).then(() => {
                        sendResponse({ success: true });
                    }).catch((err) => {
                        sendResponse({ success: false, error: err.message });
                    });
                    return true;
                }
                sendResponse({ success: false, error: 'No UID provided' });
                break;
            }
            case 'SAVE_OFFSET': {
                const targetUid = obj.uid;
                const newOffset = parseOffset(obj.offset !== undefined ? obj.offset : val, NaN);
                if (targetUid && !isNaN(newOffset)) {
                    saveObject(targetUid, { offset: newOffset }).then(() => {
                        sendResponse({ success: true, offset: newOffset });
                    }).catch((err) => {
                        sendResponse({ success: false, error: err.message });
                    });
                    return true;
                }
                sendResponse({ success: false, error: 'Invalid UID or offset' });
                break;
            }
            case 'SAVE_FONT_SIZE': {
                const rawSize = val || obj.fontSize;
                if (rawSize) {
                    const clampedSize = normalizeFontSize(rawSize);
                    saveObject('yt-userPrefs', { fontSize: clampedSize }).then(() => {
                        sendResponse({ success: true, fontSize: clampedSize });
                    }).catch((err) => {
                        sendResponse({ success: false, error: err.message });
                    });
                    return true;
                }
                sendResponse({ success: false, error: 'No font size provided' });
                break;
            }
            case 'PROFANITY_TOGGLE': {
                currentState.tabList.forEach(async (tabId) => {
                    toggleProfanityFilter(tabId, JSON.parse(val));
                });
                break;
            }
            case 'KILL_SHORTS': {
                saveObject('yt-userPrefs', { 'kill_shorts': val });
                chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
                    tabs.forEach(tab => {
                        killShort(tab.id, val).catch(() => {});
                    });
                });
                break;
            }
            case 'SKIP_AD':
            case 'SLEEP_TIMER':
            case 'NEW_UI':
                break;
            default:
                console.warn('Unknown message type:', type);
        }
    });

    /**
     * Main processing function for YouTube page changes
     */
    async function main(url, tabId, preloadedMetadata = null) {
        currentState.process = true;
        currentState.reqUrl = url;
        const targetUid = getVideoID(url);
        currentState.uid = targetUid;

        if (!currentState.tabList.includes(tabId)) {
            currentState.tabList.push(tabId);
        }

        try {
            await runInContext(url, tabId, preloadedMetadata);
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Waits until the active watch page DOM inside the tab matches the target video ID
     * and has rendered its primary metadata, using reactive MutationObserver (push-based, no polling).
     */
    async function waitForWatchPageReady(tabId, uid, maxWaitMs = 3000) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: (expectedUid, timeout, YT_SEL) => {
                    return new Promise((resolve) => {
                        const checkImmediate = () => {
                            const currentUrl = window.location.href;
                            if (!currentUrl.includes(expectedUid)) {
                                return false;
                            }

                            const watchFlexy = document.querySelector('ytd-watch-flexy:not([hidden])');
                            const domUid = watchFlexy?.getAttribute('video-id');

                            if (watchFlexy && domUid === expectedUid) {
                                const titleEl = watchFlexy.querySelector(YT_SEL.METADATA.FALLBACK_TITLE);
                                const titleText = titleEl?.textContent?.trim();
                                if (titleText && titleText.length > 0) {
                                    return true;
                                }
                            }
                            return false;
                        };

                        if (checkImmediate()) {
                            resolve(true);
                            return;
                        }

                        let finished = false;
                        let timer = null;
                        let observer = null;

                        const cleanup = (result) => {
                            if (finished) return;
                            finished = true;
                            if (timer) clearTimeout(timer);
                            if (observer) observer.disconnect();
                            window.removeEventListener('yt-page-data-updated', onPageData);
                            resolve(result);
                        };

                        const onPageData = () => {
                            if (checkImmediate()) cleanup(true);
                        };
                        window.addEventListener('yt-page-data-updated', onPageData);

                        observer = new MutationObserver(() => {
                            if (checkImmediate()) cleanup(true);
                        });

                        const target = document.querySelector('ytd-page-manager') || document.querySelector('ytd-app') || document.body;
                        if (target) {
                            observer.observe(target, {
                                attributes: true,
                                attributeFilter: ['video-id', 'hidden'],
                                childList: true,
                                subtree: true
                            });
                        }

                        // Single fallback timeout (not a polling loop) to prevent dangling listeners
                        timer = setTimeout(() => {
                            cleanup(checkImmediate());
                        }, timeout);
                    });
                },
                args: [uid, maxWaitMs, YT_SELECTORS]
            });
            return Boolean(results && results[0]?.result);
        } catch (e) {
            console.warn('waitForWatchPageReady error:', e);
            return false;
        }
    }

    /**
     * Injects the 'Searching lyrics...' UI placeholder into Freemium's container.
     */
    async function injectSearchingState(tabId, displayTitle) {
        return chrome.scripting.executeScript({
            target: { tabId },
            function: (searchTitle, YT_SEL, YTF_SEL) => {
                var ytc = document.querySelector(window.innerWidth < 1000 ? YT_SEL.LAYOUT.PRIMARY : YT_SEL.LAYOUT.SECONDARY);
                var container = ytc?.querySelector(YTF_SEL.CONTAINER.CLASS);
                if (!container) return;

                var npt = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_INPUT);
                if (npt) {
                    npt.value = searchTitle || '';
                    npt.placeholder = searchTitle || 'Searching...';
                    npt.setAttribute('data-current-title', searchTitle || '');
                }

                var progressbar = container.querySelector(YTF_SEL.HEADER.PROGRESS_BAR);
                if (progressbar) {
                    progressbar.classList.remove("no-animate");
                    progressbar.classList.add("pure-material-progress-linear");
                }

                var searchingDiv = document.createElement('div');
                searchingDiv.id = 'searchingDiv';
                searchingDiv.className = 'not-found';
                var searchingSpinner = document.createElement('div');
                searchingSpinner.className = 'yf-search-spinner';
                var searchingText = document.createElement('span');
                searchingText.className = 'not-found-title';
                searchingText.textContent = 'Searching lyrics...';
                searchingDiv.appendChild(searchingSpinner);
                searchingDiv.appendChild(searchingText);

                var existingContent = container.querySelector(YTF_SEL.CONTAINER.SWAP_TARGETS);
                if (existingContent) {
                    container.replaceChild(searchingDiv, existingContent);
                } else {
                    container.appendChild(searchingDiv);
                }
            },
            args: [displayTitle, YT_SELECTORS, YTF_SELECTORS]
        });
    }

    const runInContext = async (url, tabId, preloadedMetadata = null) => {
        var uid = getVideoID(url);
        if (!uid) return;

        if (currentSearchController) {
            currentSearchController.abort('New search initiated');
        }
        currentSearchController = new AbortController();
        const searchSignal = currentSearchController.signal;

        let metadata = preloadedMetadata;
        if (!metadata || metadata.isMusic === undefined) {
            // Push-based observer wait until DOM is ready for the target UID
            const isReady = await waitForWatchPageReady(tabId, uid);
            if (!isReady || searchSignal.aborted || currentState.uid !== uid) {
                return;
            }
            metadata = await getVideoMusicMetadata(tabId, uid);
        }

        if (searchSignal.aborted || currentState.uid !== uid) {
            return;
        }

        const isMusic = Boolean(metadata.isMusic);
        const val = metadata.title || metadata.val || '';
        const channel = metadata.channel || '';

        var obj = await getFromStorage(uid);
        var prefs = await getFromStorage('yt-userPrefs');
        var profanityCheck = prefs['yt-userPrefs']?.profanity ?? true;
        var savedFontSize = normalizeFontSize(prefs['yt-userPrefs']?.fontSize);
        let lyrics = '';
        let message = 'NOK';
        let title = '';
        let source = '';
        let synced = false;
        let offset = 0.0;
        var skipAdsState = '';

        if (skipAdsState == 'FULL') {
            injectClickValidator(tabId);
        }

        if (isMusic) {
            let displayTitle = buildDisplayTitle(val, channel);
            const hasUserSelection = !isEmpty(obj) && obj[uid]?.userSelected === true && obj[uid]?.message === 'OK';

            if (!hasUserSelection && ((!isEmpty(obj) && obj[uid]?.title && obj[uid]?.title != val && obj[uid]?.title != displayTitle) || (isEmpty(obj) && val))) {
                await injectSearchingState(tabId, displayTitle);

                let result = await findLyricsfromSources(tabId, "", val, channel, searchSignal);
                if (searchSignal.aborted || currentState.uid !== uid) {
                    return;
                }

                let resultObject = JSON.parse(result[0]?.result || '{}');
                const existingSavedOffset = (obj && obj[uid] && obj[uid].offset !== undefined && obj[uid].offset !== null)
                    ? parseOffset(obj[uid].offset, null)
                    : null;

                if (!resultObject || resultObject.message === 'NOK') {
                    lyrics = '';
                    message = 'NOK';
                    offset = existingSavedOffset !== null ? existingSavedOffset : 0.0;
                } else {
                    lyrics = resultObject.lyrics || '';
                    message = resultObject.message || '';
                    source = resultObject.source || '';
                    synced = resultObject.synced ?? synced;
                    offset = existingSavedOffset !== null
                        ? existingSavedOffset
                        : parseOffset(resultObject.offset, 0.0);
                }
                var timeCreated = Date.now();
                title = displayTitle || val;

                if (message === 'OK' && lyrics && lyrics.length > 0 && !searchSignal.aborted && currentState.uid === uid) {
                    saveObject(uid, { lyrics, message, scroll: 0, timeCreated, lastAccessed: timeCreated, title, source, synced, offset });
                }
            } else if (!isEmpty(obj)) {
                lyrics = obj[uid]?.lyrics || '';
                message = obj[uid]?.message || "NOK";
                title = obj[uid]?.title || displayTitle || '';
                source = obj[uid]?.source || '';
                synced = obj[uid]?.synced ?? false;
                offset = parseOffset(obj[uid]?.offset, 0.0);
            }
        } else {
            // Non-music video: only restore lyrics if explicitly selected by the user
            const hasUserSelection = !isEmpty(obj) && obj[uid]?.userSelected === true && obj[uid]?.message === 'OK';
            if (hasUserSelection) {
                lyrics = obj[uid]?.lyrics || '';
                message = obj[uid]?.message || "OK";
                title = obj[uid]?.title || '';
                source = obj[uid]?.source || '';
                synced = obj[uid]?.synced ?? false;
                offset = parseOffset(obj[uid]?.offset, 0.0);
            } else {
                lyrics = '';
                message = "NOK";
                title = '';
                source = '';
                synced = false;
                offset = 0.0;
            }
        }

        if (searchSignal.aborted || currentState.uid !== uid) {
            return;
        }

        if (!profanityCheck || profanityCheck == undefined) {
            profanityCheck = true;
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            function: (lyrics, message, uid, title, profanityCheck, synced, offset, fuzzyProfanityDictionary, source, YT_SEL, YTF_SEL, initialFontSize, isMusic) => {
                const watchFlexy = document.querySelector('ytd-watch-flexy:not([hidden])');
                if (!watchFlexy) return;
                const domUid = watchFlexy.getAttribute('video-id');
                if (uid && domUid && domUid !== uid) return;

                var ytc = document.querySelector(window.innerWidth < 1000 ? YT_SEL.LAYOUT.PRIMARY : YT_SEL.LAYOUT.SECONDARY);
                var container = ytc?.querySelector(YTF_SEL.CONTAINER.CLASS);
                var intermediateContainer = ytc?.querySelector(YTF_SEL.CONTAINER.INTERMEDIATE);
                var lyricElements = [];
                const mediaElem = document.querySelector(YT_SEL.PLAYER.VIDEO);

                if (container) {
                    container._currentUid = uid;
                }

                if (mediaElem) {
                    mediaElem.setAttribute('ytf-data-offset', offset);
                }

                function clampFontSize(sizeStr) {
                    const val = parseFloat(sizeStr);
                    if (isNaN(val)) return '24px';
                    const clamped = Math.min(Math.max(val, 14), 36);
                    return Math.round(clamped) + 'px';
                }

                if (!container) {
                    var header = document.createElement('div');
                    var progressbar = document.createElement("progress");
                    container = document.createElement('div');

                    var linkElement2 = document.createElement('link');
                    linkElement2.rel = 'stylesheet';
                    linkElement2.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20,300,0,0';
                    document.head.appendChild(linkElement2);

                    var linkElement3 = document.createElement('link');
                    linkElement3.rel = 'stylesheet';
                    linkElement3.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@300&family=Saira+Extra+Condensed:wght@500&display=swap';
                    document.head.appendChild(linkElement3);

                    var linkElement4 = document.createElement('link');
                    linkElement4.rel = 'stylesheet';
                    linkElement4.href = 'https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap';
                    document.head.appendChild(linkElement4);

                    header.id = 'header';
                    header.className = 'yf-header';

                    container.id = 'yf-container';
                    container.className = 'yf-container';
                    if (window.innerWidth < 1000) {
                        container.classList.add('ytf-container-marginTop');
                    }

                    var logoContainerDiv = document.createElement("div");
                    logoContainerDiv.className = "yf-logo-container";

                    var logoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    logoSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                    logoSvg.setAttribute("width", "40");
                    logoSvg.setAttribute("height", "40");
                    logoSvg.setAttribute("viewBox", "0 0 1024 1024");
                    logoSvg.classList.add("yf-logo-svg");

                    var path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path1.setAttribute("fill", "#FC0100");
                    path1.setAttribute("d", "M497.268 276.736C569.711 276.396 642.135 279.114 714.349 284.881C727.446 285.968 740.525 287.277 753.578 288.806C762.329 289.799 773.414 290.9 781.817 293.23C795.119 296.897 807.298 303.82 817.254 313.373C827.078 322.74 834.543 334.301 839.039 347.108C843.577 359.777 845.063 374.58 847.007 387.876C858.627 467.352 858.43 548.006 848.033 627.6C846.074 642.592 845.426 659.295 840.797 673.725C836.646 686.45 829.643 698.058 820.323 707.664C793.908 735.032 759.734 733.521 724.49 736.863C659.05 743.177 593.366 746.622 527.625 747.19C455.787 747.44 383.977 744.327 312.431 737.858C299.624 736.809 286.823 735.68 274.03 734.471C247.281 731.948 226.202 729.921 206.282 709.991C196.308 700.013 188.215 688.687 183.633 675.14C178.552 660.121 178.181 643.987 175.971 628.407C172.016 595.768 168.915 561.886 168.02 528.999C166.884 487.303 170.372 444.976 175.412 403.616C177.66 385.167 179.645 363.75 185.764 346.264C189.674 335.005 195.987 324.733 204.266 316.159C212.168 307.974 224.681 298.99 235.62 295.684C258.55 288.753 284.987 287.203 308.733 285.017C371.384 279.247 434.386 277.827 497.268 276.736Z");
                    logoSvg.appendChild(path1);

                    var path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path2.setAttribute("fill", "#EEEEED");
                    path2.setAttribute("d", "M482.546 379.687C487.355 378.959 499.46 379.307 504.518 379.339L542.029 379.427C588.699 379.22 635.37 379.252 682.04 379.524C673.664 399.79 665.433 420.116 657.349 440.5L515.341 440.422C509.241 453.903 502.839 469.987 497.507 483.85C539.887 484.81 582.436 483.069 625.463 484.098C619.41 501.742 609.041 525.293 601.855 543.048L569.115 542.684L474.236 542.552C469.347 553.387 464.524 565.758 459.907 576.874C450.442 599.536 441.123 622.258 431.952 645.04C402.498 644.256 372.473 644.849 342.941 645.015C364.752 591.016 387.026 537.206 409.76 483.59L426.614 442.782C439.178 411.884 444.923 384.546 482.546 379.687Z");
                    logoSvg.appendChild(path2);

                    logoContainerDiv.appendChild(logoSvg);

                    var freemiumSpan = document.createElement("span");
                    freemiumSpan.className = "freemium";
                    freemiumSpan.textContent = "Free Mium";
                    logoContainerDiv.appendChild(freemiumSpan);

                    var nowPlayingDiv = document.createElement("div");
                    nowPlayingDiv.className = "now-playing-div";

                    var nowPlayingText = document.createElement("input");
                    nowPlayingText.setAttribute("autocomplete", "off");
                    nowPlayingText.setAttribute("spellcheck", "false");
                    nowPlayingText.id = "now-playing-text-input";
                    nowPlayingText.className = "now-playing-text-input";
                    nowPlayingText.value = title;
                    nowPlayingText.placeholder = title || "Search song or artist...";
                    nowPlayingText.setAttribute("data-current-title", title);
                    nowPlayingText.title = "Click to search or edit song";

                    var searchBtn = document.createElement("button");
                    searchBtn.className = "yf-search-btn";
                    searchBtn.title = "Search lyrics";
                    searchBtn.setAttribute("aria-label", "Search lyrics");
                    searchBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                        </svg>
                    `;

                    nowPlayingText.addEventListener('focus', () => {
                        nowPlayingDiv.classList.add('active-input');
                        if (nowPlayingText.value === nowPlayingText.getAttribute('data-current-title')) {
                            nowPlayingText.select();
                        }
                    });

                    nowPlayingText.addEventListener('blur', () => {
                        nowPlayingDiv.classList.remove('active-input');
                        if (!nowPlayingText.value.trim()) {
                            nowPlayingText.value = nowPlayingText.getAttribute('data-current-title') || '';
                        }
                    });

                    nowPlayingText.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (container._performSearch) {
                                container._performSearch(nowPlayingText.value.trim());
                            }
                        } else if (e.key === 'Escape') {
                            nowPlayingText.value = nowPlayingText.getAttribute('data-current-title') || '';
                            nowPlayingText.blur();
                            if (container._closeSearchResults) {
                                container._closeSearchResults();
                            }
                        }
                    });

                    searchBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (container._performSearch) {
                            container._performSearch(nowPlayingText.value.trim());
                        }
                    });

                    nowPlayingDiv.appendChild(nowPlayingText);
                    nowPlayingDiv.appendChild(searchBtn);

                    var menuSpan = document.createElement("span");
                    menuSpan.className = "yf-menu";
                    menuSpan.textContent = "...";

                    var yfDropdown = document.createElement('div');
                    yfDropdown.id = 'yf-dropdown';
                    yfDropdown.className = 'yf-dropdown';

                    const ul = document.createElement('ul');

                    const getTargetVideoID = (url) => {
                        try {
                            return new URL(url).searchParams.get('v') || '';
                        } catch (e) {
                            return '';
                        }
                    };

                    ['Font Size', 'Lyric Offset', 'Report'].forEach((optionText) => {
                        const li = ul.appendChild(document.createElement('li'));
                        li.className = 'yf-dd-list';

                        switch (optionText) {
                            case 'Font Size': {
                                var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('material-symbols-outlined', 'yf-dd-list-icon');
                                var pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M592.54-687.001H432.385q-12.628 0-21.467-8.853-8.84-8.852-8.84-21.499 0-12.646 8.84-21.646 8.839-9 21.467-9h381.307q12.628 0 21.467 8.853 8.84 8.853 8.84 21.499 0 12.647-8.84 21.646-8.839 9-21.467 9H653.537v444.693q0 12.628-8.852 21.467-8.853 8.84-21.5 8.84-12.646 0-21.646-8.952-8.999-8.952-8.999-21.74v-444.308ZM235.232-496.924h-88.924q-12.628 0-21.467-8.853-8.84-8.852-8.84-21.499 0-12.646 8.84-21.646 8.839-9 21.467-9h238.461q12.628 0 21.467 8.853 8.84 8.852 8.84 21.499 0 12.646-8.84 21.646-8.839 9-21.467 9h-88.924v254.616q0 12.628-8.853 21.467-8.852 8.84-21.499 8.84-12.646 0-21.454-8.84-8.807-8.839-8.807-21.467v-254.616Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                li.appendChild(document.createElement('span')).className = 'yf-dd-item-cont';
                                li.lastChild.textContent = optionText + '\u00A0\u00A0\u00A0\u00A0';

                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('sFont', 'material-symbols-outlined');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M609.975-454.001q-11.033 0-18.657-7.418-7.625-7.418-7.625-18.384 0-10.966 7.463-18.581t18.496-7.615h215.757q11.033 0 18.658 7.418 7.624 7.418 7.624 18.384 0 10.966-7.463 18.581t-18.495 7.615H609.975Zm-403.58 79.846-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                li.lastChild.addEventListener('click', () => {
                                    var fontSizeElement = li.querySelector(YTF_SEL.DROPDOWN.FONT_SIZE);
                                    var currentFontSize = fontSizeElement.textContent ? parseFloat(fontSizeElement.textContent) : 24;
                                    if (currentFontSize > 14) {
                                        var fontSize = clampFontSize((currentFontSize - 1) + 'px');
                                        var lc = document.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                                        if (lc) lc.style.fontSize = fontSize;
                                        try { localStorage.setItem('fontSize', fontSize); } catch(e) {}
                                        chrome.runtime.sendMessage({ type: 'SAVE_FONT_SIZE', fontSize: fontSize });
                                        if (fontSizeElement) fontSizeElement.textContent = fontSize;
                                        effectiveFontSize = fontSize;
                                    }
                                });

                                li.appendChild(document.createElement('span')).className = 'yf-fontSize';
                                li.lastChild.id = 'yf-font-size';
                                var localFontSize = clampFontSize(initialFontSize || localStorage.getItem('fontSize') || '24px');
                                li.lastChild.textContent = localFontSize;

                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('sFont', 'material-symbols-outlined');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "m206.395-374.155-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Zm468.617-32.253h-82.001q-11.05 0-18.524-7.503-7.475-7.503-7.475-18.492t7.475-18.41q7.474-7.42 18.524-7.42h82.001v-81.689q0-10.984 7.418-18.609 7.418-7.624 18.384-7.624 10.966 0 18.455 7.475 7.49 7.474 7.49 18.524v82.001h82.168q11.086 0 18.585 7.478 7.498 7.479 7.498 18.534 0 11.056-7.498 18.521-7.499 7.465-18.585 7.465H743.44V-372q0 11.05-7.503 18.524-7.503 7.475-18.258 7.475-11.056 0-18.521-7.499-7.465-7.499-7.465-18.584v-82.168Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                li.lastChild.addEventListener('click', () => {
                                    var fontSizeElement = li.querySelector(YTF_SEL.DROPDOWN.FONT_SIZE);
                                    var currentFontSize = fontSizeElement.textContent ? parseFloat(fontSizeElement.textContent) : 24;
                                    if (currentFontSize < 36) {
                                        var fontSize = clampFontSize((currentFontSize + 1) + 'px');
                                        var lc = document.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                                        if (lc) lc.style.fontSize = fontSize;
                                        try { localStorage.setItem('fontSize', fontSize); } catch(e) {}
                                        chrome.runtime.sendMessage({ type: 'SAVE_FONT_SIZE', fontSize: fontSize });
                                        if (fontSizeElement) fontSizeElement.textContent = fontSize;
                                        effectiveFontSize = fontSize;
                                    }
                                });
                                break;
                            }
                            case 'Lyric Offset': {
                                var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('material-symbols-outlined', 'yf-dd-list-icon');
                                var pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M252.31-400v60h-80q-29.92 0-51.12-21.24Q100-382.48 100-412.31v-375.38q0-29.83 21.24-51.07Q142.48-860 172.31-860h375.38q29.83 0 51.07 21.24Q620-817.52 620-787.69v80h-60v-80q0-5.39-3.46-8.85t-8.85-3.46H172.31q-5.39 0-8.85 3.46t-3.46 8.85v375.38q0 5.39 3.46 8.85t8.85 3.46h80Zm160 300q-29.83 0-51.07-21.24Q340-142.48 340-172.31v-375.38q0-29.83 21.24-51.07Q382.48-620 412.31-620h375.38q29.83 0 51.07 21.24Q860-577.52 860-547.69v375.38q0 29.83-21.24 51.07Q817.52-100 787.69-100H412.31Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                li.appendChild(document.createElement('span')).className = 'yf-dd-item-cont';
                                li.lastChild.textContent = optionText;

                                const decrementBtn = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                decrementBtn.setAttribute("height", "24");
                                decrementBtn.setAttribute("viewBox", "0 -960 960 960");
                                decrementBtn.setAttribute("width", "24");
                                decrementBtn.id = 'ytf-offset-decrement';
                                decrementBtn.classList.add('sFont', 'material-symbols-outlined');
                                decrementBtn.setAttribute('title', 'Decrease offset (hold to rapidly decrease)');
                                decrementBtn.setAttribute('aria-label', 'Decrease offset');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M609.975-454.001q-11.033 0-18.657-7.418-7.625-7.418-7.625-18.384 0-10.966 7.463-18.581t18.496-7.615h215.757q11.033 0 18.658 7.418 7.624 7.418 7.624 18.384 0 10.966-7.463 18.581t-18.495 7.615H609.975Zm-403.58 79.846-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Z");
                                decrementBtn.appendChild(pathElement);
                                li.appendChild(decrementBtn);

                                const offsetInput = document.createElement('input');
                                offsetInput.className = 'yf-fontSize yf-clearInput';
                                offsetInput.id = 'yf-offset-text';
                                offsetInput.type = 'number';
                                offsetInput.step = '0.25';
                                const parsedInitialOffset = typeof offset === 'number' ? offset : (parseFloat(offset) || 0);
                                offsetInput.value = parsedInitialOffset.toFixed(2);
                                li.appendChild(offsetInput);

                                const incrementBtn = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                incrementBtn.setAttribute("height", "24");
                                incrementBtn.setAttribute("viewBox", "0 -960 960 960");
                                incrementBtn.setAttribute("width", "24");
                                incrementBtn.classList.add('sFont', 'material-symbols-outlined');
                                incrementBtn.id = 'ytf-offset-increment';
                                incrementBtn.setAttribute('title', 'Increase offset (hold to rapidly increase)');
                                incrementBtn.setAttribute('aria-label', 'Increase offset');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "m206.395-374.155-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Zm468.617-32.253h-82.001q-11.05 0-18.524-7.503-7.475-7.503-7.475-18.492t7.475-18.41q7.474-7.42 18.524-7.42h82.001v-81.689q0-10.984 7.418-18.609 7.418-7.624 18.384-7.624 10.966 0 18.455 7.475 7.49 7.474 7.49 18.524v82.001h82.168q11.086 0 18.585 7.478 7.498 7.479 7.498 18.534 0 11.056-7.498 18.521-7.499 7.465-18.585 7.465H743.44V-372q0 11.05-7.503 18.524-7.503 7.475-18.258 7.475-11.056 0-18.521-7.499-7.465-7.499-7.465-18.584v-82.168Z");
                                incrementBtn.appendChild(pathElement);
                                li.appendChild(incrementBtn);

                                const persistOffset = (newOffset) => {
                                    const targetUid = container.getAttribute('data-uid') || uid || getTargetVideoID(window.location.href);
                                    if (!targetUid || isNaN(newOffset)) return;
                                    try {
                                        chrome.runtime.sendMessage({
                                            type: 'SAVE_OFFSET',
                                            uid: targetUid,
                                            offset: newOffset
                                        });
                                    } catch (e) {}
                                };

                                const setupOffsetButton = (btn, delta) => {
                                    let pressTimer = null;
                                    let repeatInterval = null;
                                    let isHolding = false;
                                    let activePointerId = null;
                                    let intermediateSaveTimer = null;

                                    const applyStep = () => {
                                        let cur = parseFloat(mediaElem?.getAttribute('ytf-data-offset'));
                                        if (isNaN(cur)) cur = 0;
                                        const updated = Math.round((cur + delta) * 100) / 100;
                                        if (offsetInput) {
                                            offsetInput.value = updated.toFixed(2);
                                        }
                                        if (mediaElem) {
                                            mediaElem.setAttribute('ytf-data-offset', updated);
                                            if (typeof mediaElem._syncCurrentLyric === 'function') {
                                                mediaElem._syncCurrentLyric(true);
                                            }
                                        }
                                        return updated;
                                    };

                                    const triggerSave = () => {
                                        const finalVal = parseFloat(mediaElem?.getAttribute('ytf-data-offset')) || 0;
                                        persistOffset(finalVal);
                                    };

                                    const onPointerDown = (e) => {
                                        if (e.button !== undefined && e.button !== 0) return;
                                        e.preventDefault();
                                        e.stopPropagation();

                                        isHolding = true;
                                        activePointerId = e.pointerId;
                                        try {
                                            btn.setPointerCapture(e.pointerId);
                                        } catch (err) {}

                                        applyStep();

                                        clearTimeout(pressTimer);
                                        clearInterval(repeatInterval);
                                        clearTimeout(intermediateSaveTimer);

                                        pressTimer = setTimeout(() => {
                                            repeatInterval = setInterval(() => {
                                                applyStep();
                                                clearTimeout(intermediateSaveTimer);
                                                intermediateSaveTimer = setTimeout(triggerSave, 400);
                                            }, 85);
                                        }, 350);
                                    };

                                    const onPointerUp = (e) => {
                                        if (!isHolding) return;
                                        isHolding = false;
                                        clearTimeout(pressTimer);
                                        clearInterval(repeatInterval);
                                        clearTimeout(intermediateSaveTimer);

                                        if (activePointerId !== null) {
                                            try {
                                                if (btn.hasPointerCapture(activePointerId)) {
                                                    btn.releasePointerCapture(activePointerId);
                                                }
                                            } catch (err) {}
                                            activePointerId = null;
                                        }

                                        triggerSave();
                                    };

                                    btn.addEventListener('pointerdown', onPointerDown);
                                    btn.addEventListener('pointerup', onPointerUp);
                                    btn.addEventListener('pointercancel', onPointerUp);
                                    btn.addEventListener('contextmenu', (e) => e.preventDefault());
                                };

                                setupOffsetButton(decrementBtn, -0.25);
                                setupOffsetButton(incrementBtn, 0.25);

                                let inputDebounceTimer;
                                const handleInputChange = (immediate = false) => {
                                    let val = parseFloat(offsetInput.value);
                                    if (isNaN(val)) {
                                        if (immediate) {
                                            offsetInput.value = '0.00';
                                            val = 0;
                                        } else {
                                            return;
                                        }
                                    }
                                    val = Math.round(val * 100) / 100;
                                    if (immediate) {
                                        offsetInput.value = val.toFixed(2);
                                    }
                                    if (mediaElem) {
                                        mediaElem.setAttribute('ytf-data-offset', val);
                                        if (typeof mediaElem._syncCurrentLyric === 'function') {
                                            mediaElem._syncCurrentLyric(true);
                                        }
                                    }
                                    clearTimeout(inputDebounceTimer);
                                    if (immediate) {
                                        persistOffset(val);
                                    } else {
                                        inputDebounceTimer = setTimeout(() => {
                                            persistOffset(val);
                                        }, 400);
                                    }
                                };

                                offsetInput.addEventListener('input', () => handleInputChange(false));
                                offsetInput.addEventListener('change', () => handleInputChange(true));
                                break;
                            }
                            case 'Report': {
                                var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('yf-dd-list-icon', 'material-symbols-outlined');
                                var pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M479.789-311.539q11.942 0 20.23-8.078t8.288-20.019q0-11.941-8.078-20.229-8.077-8.289-20.018-8.289-11.942 0-20.23 8.078t-8.288 20.019q0 11.941 8.078 20.229 8.077 8.289 20.018 8.289Zm.014-111.23q10.966 0 18.581-7.474 7.615-7.475 7.615-18.525v-189.54q0-11.05-7.418-18.524-7.418-7.475-18.384-7.475-10.966 0-18.581 7.475-7.615 7.474-7.615 18.524v189.54q0 11.05 7.418 18.525 7.418 7.474 18.384 7.474ZM376.385-164.001q-12.855 0-24.504-4.616-11.65-4.615-21.496-14.461L183.078-331.385q-8.889-9.021-13.983-21.195-5.094-12.173-5.094-24.805v-206.23q0-12.855 4.616-24.504 4.615-11.65 14.461-21.496l147.307-147.307q9.846-9.846 21.496-14.461 11.649-4.616 24.504-4.616h207.23q12.855 0 24.504 4.616 11.65 4.615 21.496 14.461l147.307 147.307q9.846 9.846 14.461 21.496 4.616 11.649 4.616 24.504v207.23q0 12.855-4.616 24.504-4.615 11.65-14.461 21.496L628.615-183.078q-9.021 8.889-21.195 13.983-12.173 5.094-24.805 5.094h-206.23ZM371-216h218l155-155v-218L588-744H371L216-589v218l155 155Zm109-264Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                const reportLinkContainer = document.createElement('div');
                                const reportLink = document.createElement('a');
                                reportLink.setAttribute("id", "report");
                                reportLink.setAttribute("class", "yf-reportLink");
                                reportLink.setAttribute("href", "mailto:uncannyrishabh@gmail.com?subject=REPORT%20%7C%20YTF&body=%3Cdescribe_issue_here%3E%0A%3Cattach_screenshot%3E");
                                reportLink.innerText = 'Report an issue';
                                reportLinkContainer.appendChild(reportLink);
                                reportLinkContainer.className = 'yf-dd-item-cont yf-report-container';
                                li.appendChild(reportLinkContainer);
                                break;
                            }
                        }
                    });

                    yfDropdown.appendChild(ul);

                    menuSpan.addEventListener('click', () => {
                        yfDropdown.style.display = (yfDropdown.style.display === 'none' || yfDropdown.style.display === '') ? 'block' : 'none';
                    });

                    ytc?.addEventListener('mousedown', (event) => {
                        if (!yfDropdown.contains(event.target) && event.target !== menuSpan) {
                            yfDropdown.style.display = 'none';
                        }
                    });

                    var collapseBtn = document.createElement("button");
                    collapseBtn.id = "yf-collapse-btn";
                    collapseBtn.className = "yf-collapse-btn";
                    collapseBtn.title = "Collapse";
                    collapseBtn.setAttribute("aria-label", "Toggle lyrics panel");
                    collapseBtn.innerHTML = `
                        <svg class="yf-collapse-icon" viewBox="0 0 24 24" width="22" height="22">
                            <path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/>
                        </svg>
                    `;

                    const toggleCollapse = (e) => {
                        if (e) e.stopPropagation();
                        const isCollapsed = container.classList.toggle(YTF_SEL.CONTAINER.COLLAPSED_CLASS);
                        collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
                        try {
                            localStorage.setItem('ytf-collapsed', isCollapsed ? 'true' : 'false');
                        } catch (err) {}

                        const currentUid = container._currentUid || container.getAttribute('data-uid') || uid;
                        if (isCollapsed) {
                            if (currentUid) {
                                container.setAttribute('data-manually-closed-uid', currentUid);
                                try {
                                    sessionStorage.setItem('ytf-manually-closed-uid', currentUid);
                                } catch (err) {}
                            }
                        } else {
                            container.removeAttribute('data-manually-closed-uid');
                            try {
                                sessionStorage.removeItem('ytf-manually-closed-uid');
                            } catch (err) {}
                        }

                        // When icon is open (arrow up), use existing method to find out the lyric to highlight based on timestamp and highlight that lyric
                        if (!isCollapsed && mediaElem) {
                            if (typeof mediaElem._syncCurrentLyric === 'function') {
                                mediaElem._syncCurrentLyric(true);
                                requestAnimationFrame(() => {
                                    setTimeout(() => {
                                        if (typeof mediaElem._syncCurrentLyric === 'function') {
                                            mediaElem._syncCurrentLyric(true);
                                        }
                                    }, 50);
                                });
                            }
                        }
                    };

                    collapseBtn.addEventListener('click', toggleCollapse);

                    header.addEventListener('click', (e) => {
                        if (e.target.closest(YTF_SEL.DROPDOWN.ROOT) ||
                            e.target.closest(YTF_SEL.HEADER.MENU_BTN) ||
                            e.target.closest(YTF_SEL.HEADER.NOW_PLAYING_INPUT) ||
                            e.target.closest(YTF_SEL.HEADER.SEARCH_BTN) ||
                            e.target.closest(YTF_SEL.HEADER.COLLAPSE_BTN_CLASS) ||
                            e.target.closest(YTF_SEL.SEARCH.DROPDOWN) ||
                            e.target.closest('a')) {
                            return;
                        }
                        toggleCollapse(e);
                    });

                    const activeUid = uid || (new URL(window.location.href)).searchParams.get('v');
                    const manuallyClosedUid = container.getAttribute('data-manually-closed-uid') || (function () {
                        try { return sessionStorage.getItem('ytf-manually-closed-uid'); } catch (err) { return null; }
                    })();
                    const isManuallyClosedForThisVideo = Boolean(activeUid && manuallyClosedUid === activeUid);

                    if (isManuallyClosedForThisVideo || !isMusic || localStorage.getItem('ytf-collapsed') === 'true') {
                        container.classList.add(YTF_SEL.CONTAINER.COLLAPSED_CLASS);
                        collapseBtn.title = 'Expand';
                    } else {
                        collapseBtn.title = 'Collapse';
                    }

                    var headerTop = document.createElement("div");
                    headerTop.className = "yf-header-top";
                    headerTop.appendChild(logoContainerDiv);

                    var headerActions = document.createElement("div");
                    headerActions.className = "yf-header-actions";
                    headerActions.appendChild(menuSpan);
                    headerActions.appendChild(collapseBtn);
                    headerTop.appendChild(headerActions);
                    headerTop.appendChild(yfDropdown);

                    var headerBottom = document.createElement("div");
                    headerBottom.className = "yf-header-bottom";
                    headerBottom.appendChild(nowPlayingDiv);

                    header.appendChild(headerTop);
                    header.appendChild(headerBottom);

                    container.appendChild(header);

                    progressbar.id = 'ytf-progressbar';
                    progressbar.className = "pure-material-progress-linear";
                    container.appendChild(progressbar);

                    if (window.innerWidth < 1000) {
                        ytc.insertBefore(container, ytc.children[1]);
                    } else {
                        ytc.insertBefore(container, ytc.firstChild);
                    }
                }

                function openContainer() {
                    container.classList.remove(YTF_SEL.CONTAINER.COLLAPSED_CLASS);
                    var cBtn = container.querySelector(YTF_SEL.HEADER.COLLAPSE_BTN) || container.querySelector(YTF_SEL.HEADER.COLLAPSE_BTN_CLASS);
                    if (cBtn) cBtn.title = 'Collapse';
                    try {
                        localStorage.setItem('ytf-collapsed', 'false');
                    } catch (e) {}

                    if (mediaElem && typeof mediaElem._syncCurrentLyric === 'function') {
                        mediaElem._syncCurrentLyric(true);
                        requestAnimationFrame(() => {
                            setTimeout(() => {
                                if (typeof mediaElem._syncCurrentLyric === 'function') {
                                    mediaElem._syncCurrentLyric(true);
                                }
                            }, 50);
                        });
                    }
                }

                function closeContainer() {
                    container.classList.add(YTF_SEL.CONTAINER.COLLAPSED_CLASS);
                    var cBtn = container.querySelector(YTF_SEL.HEADER.COLLAPSE_BTN) || container.querySelector(YTF_SEL.HEADER.COLLAPSE_BTN_CLASS);
                    if (cBtn) cBtn.title = 'Expand';
                    try {
                        localStorage.setItem('ytf-collapsed', 'true');
                    } catch (e) {}
                }

                container._openContainer = openContainer;
                container._closeContainer = closeContainer;

                var npt = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_INPUT);
                var offsetInputElement = container.querySelector(YTF_SEL.DROPDOWN.OFFSET_TEXT);
                if (offsetInputElement) {
                    const numOffset = typeof offset === 'number' ? offset : (parseFloat(offset) || 0);
                    offsetInputElement.value = numOffset.toFixed(2);
                }

                if (npt) {
                    npt.value = title;
                    npt.setAttribute('data-current-title', title);
                    npt.placeholder = title || 'Search song or artist...';
                }

                var effectiveFontSize = clampFontSize(initialFontSize || localStorage.getItem('fontSize') || '24px');
                var fontSizeDisplay = container.querySelector(YTF_SEL.DROPDOWN.FONT_SIZE);
                if (fontSizeDisplay) {
                    fontSizeDisplay.textContent = effectiveFontSize;
                }
                var existingLyricBox = container.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                if (existingLyricBox) {
                    existingLyricBox.style.fontSize = effectiveFontSize;
                }

                let currentLyrics = lyrics;
                let currentSynced = synced;
                let currentSource = source;

                function formatDuration(sec) {
                    if (sec == null || isNaN(sec) || sec <= 0) return '--:--';
                    const totalSec = Math.round(sec);
                    const m = Math.floor(totalSec / 60);
                    const s = totalSec % 60;
                    return `${m}:${s < 10 ? '0' : ''}${s}`;
                }

                function parseLyricsfileYaml(yamlStr) {
                    if (!yamlStr || typeof yamlStr !== 'string') return [];
                    const lines = [];
                    const rawLines = yamlStr.split('\n');

                    let currentLine = null;
                    let currentWord = null;
                    let inWords = false;

                    function cleanVal(v) {
                        if (v == null) return '';
                        let s = String(v).trim();
                        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
                            s = s.slice(1, -1);
                        }
                        return s;
                    }

                    for (let i = 0; i < rawLines.length; i++) {
                        const raw = rawLines[i];
                        const trimmed = raw.trim();
                        if (!trimmed || trimmed.startsWith('#')) continue;

                        if (trimmed === 'lines:') {
                            inWords = false;
                            continue;
                        }

                        if (trimmed.startsWith('plain:') || trimmed.startsWith('version:') || trimmed.startsWith('metadata:')) {
                            inWords = false;
                            currentLine = null;
                            continue;
                        }

                        const indent = raw.search(/\S/);

                        if (trimmed.startsWith('-') && indent <= 4) {
                            inWords = false;
                            currentLine = { text: '', start_ms: 0, end_ms: 0, words: [] };
                            lines.push(currentLine);
                            currentWord = null;

                            const rest = trimmed.slice(1).trim();
                            if (rest.startsWith('text:')) {
                                currentLine.text = cleanVal(rest.slice(5));
                            }
                            continue;
                        }

                        if (trimmed === 'words:') {
                            inWords = true;
                            continue;
                        }

                        if (inWords) {
                            if (trimmed.startsWith('-')) {
                                currentWord = { text: '', start: 0, end: 0 };
                                if (currentLine) currentLine.words.push(currentWord);

                                const rest = trimmed.slice(1).trim();
                                if (rest.startsWith('text:')) {
                                    currentWord.text = cleanVal(rest.slice(5));
                                }
                                continue;
                            }

                            const colonIdx = trimmed.indexOf(':');
                            if (colonIdx !== -1) {
                                const key = trimmed.slice(0, colonIdx).trim();
                                const val = cleanVal(trimmed.slice(colonIdx + 1));
                                if (key === 'text' && currentWord) {
                                    currentWord.text = val;
                                } else if (key === 'start_ms' && currentWord) {
                                    currentWord.start = parseInt(val, 10) / 1000;
                                } else if (key === 'end_ms' && currentWord) {
                                    currentWord.end = parseInt(val, 10) / 1000;
                                }
                            }
                            continue;
                        }

                        const colonIdx = trimmed.indexOf(':');
                        if (colonIdx !== -1 && currentLine) {
                            const key = trimmed.slice(0, colonIdx).trim();
                            const val = cleanVal(trimmed.slice(colonIdx + 1));
                            if (key === 'text') {
                                currentLine.text = val;
                            } else if (key === 'start_ms') {
                                currentLine.start_ms = parseInt(val, 10);
                            } else if (key === 'end_ms') {
                                currentLine.end_ms = parseInt(val, 10);
                            }
                        }
                    }

                    return lines.map(line => {
                        const totalSec = (line.start_ms || 0) / 1000;
                        const m = Math.floor(totalSec / 60);
                        const s = (totalSec % 60).toFixed(2);
                        const ts = `${m < 10 ? '0' : ''}${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
                        return [ts, line.text || '', line.words || []];
                    });
                }

                function parseLrc(syncedLyrics) {
                    if (!syncedLyrics) return [];
                    const rawLines = syncedLyrics.replaceAll('[', '').split('\n').map(l => l.split(']'));
                    function isValidTimestamp(ts) {
                        return /^\d{2}:\d{2}\.\d{2,3}$/.test(ts);
                    }
                    const sortedLyrics = [];
                    const valid = rawLines.filter(l => l[0] && isValidTimestamp(l[0]));
                    valid.forEach(line => {
                        if (!Array.isArray(line) || line.length < 2) return;
                        const lyricText = line[line.length - 1];
                        const timestamps = line.slice(0, -1);
                        timestamps.forEach(ts => {
                            if (!isValidTimestamp(ts)) return;
                            const idx = sortedLyrics.findIndex(s => ts.localeCompare(s[0]) < 0);
                            if (idx === -1) sortedLyrics.push([ts, lyricText]);
                            else sortedLyrics.splice(idx, 0, [ts, lyricText]);
                        });
                    });
                    return sortedLyrics;
                }

                function sortResultsByDuration(results, videoDuration) {
                    return results.sort((a, b) => {
                        const aDur = typeof a.duration === 'number' && !isNaN(a.duration) ? a.duration : 0;
                        const bDur = typeof b.duration === 'number' && !isNaN(b.duration) ? b.duration : 0;

                        // If videoDuration is available and valid (> 0):
                        // Even when duration is < 59s, compare duration difference to video length
                        if (videoDuration > 0) {
                            const aDiff = aDur > 0 ? Math.abs(aDur - videoDuration) : 999999;
                            const bDiff = bDur > 0 ? Math.abs(bDur - videoDuration) : 999999;

                            if (Math.abs(aDiff - bDiff) > 2) {
                                return aDiff - bDiff;
                            }
                        }

                        // Secondary priority: prefer tracks with word sync
                        if (a.hasWordSync && !b.hasWordSync) return -1;
                        if (!a.hasWordSync && b.hasWordSync) return 1;

                        // Tertiary priority: prefer tracks with synced lyrics
                        const aHasSynced = !!(a.syncedLyrics && a.syncedLyrics.trim());
                        const bHasSynced = !!(b.syncedLyrics && b.syncedLyrics.trim());
                        if (aHasSynced && !bHasSynced) return -1;
                        if (!aHasSynced && bHasSynced) return 1;

                        // Quaternary priority: prefer tracks with plain lyrics
                        const aHasPlain = !!(a.plainLyrics && a.plainLyrics.trim());
                        const bHasPlain = !!(b.plainLyrics && b.plainLyrics.trim());
                        if (aHasPlain && !bHasPlain) return -1;
                        if (!aHasPlain && bHasPlain) return 1;

                        return 0;
                    });
                }

                function renderLyricsView(targetLyrics, targetSynced, targetSource, targetProfanity) {
                    lyricElements = [];
                    currentLyrics = targetLyrics;
                    currentSynced = targetSynced;
                    currentSource = targetSource;

                    intermediateContainer = document.createElement('div');
                    intermediateContainer.id = 'intermediateContainer';
                    intermediateContainer.className = 'intermediateContainer';

                    var lyricContainer = document.createElement('div');
                    lyricContainer.id = 'lyricContainer';
                    lyricContainer.className = 'lyricContainer lyric sizeM';
                    lyricContainer.setAttribute('data-profanity', targetProfanity);

                    var localFontSize = clampFontSize(effectiveFontSize || localStorage.getItem('fontSize') || '24px');
                    if (localFontSize) {
                        lyricContainer.style.fontSize = localFontSize;
                    }

                    let bubblesWrapper = document.createElement('div');
                    bubblesWrapper.className = 'bubbles-wrapper';
                    bubblesWrapper.innerHTML = `
                        <div id="bubble-1" class="bubble"></div>
                        <div id="bubble-2" class="bubble"></div>
                        <div id="bubble-3" class="bubble"></div>
                    `;

                    const pattern = fuzzyProfanityDictionary.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                    const re = new RegExp(`(${pattern})`, 'giu');

                    var processedLyrics = (targetLyrics || []).reduce((acc, item) => {
                        if (Array.isArray(item) ? item.length >= 2 : (item && String(item).trim())) {
                            acc.push(item);
                        }
                        return acc;
                    }, []);

                    processedLyrics.forEach((l) => {
                        var timestamp;
                        var rawText = l;
                        var words = null;
                        if (Array.isArray(l)) {
                            timestamp = l[0];
                            rawText = l[1] ? l[1] : '';
                            words = Array.isArray(l[2]) && l[2].length > 0 ? l[2] : null;
                        }

                        var isBlankInterlude = !rawText || String(rawText).trim() === '' || String(rawText).trim() === '...';
                        var d = document.createElement('span');

                        if (timestamp) {
                            d.setAttribute('data-timestamp', timestamp);
                            d.className = 'lyric-line';
                            d.addEventListener('click', function () {
                                const mElem = document.querySelector(YT_SEL.PLAYER.VIDEO);
                                var curOffset = parseFloat(mElem?.getAttribute('ytf-data-offset')) || 0;
                                const ts = this.getAttribute('data-timestamp');
                                let seconds = 0;
                                if (ts) {
                                    const parts = ts.split(':');
                                    if (parts.length === 2) {
                                        const min = parseInt(parts[0], 10);
                                        const sec = parseFloat(parts[1]) - curOffset;
                                        seconds = min * 60 + sec;
                                    }
                                }
                                if (mElem) mElem.currentTime = seconds;
                            });
                        } else {
                            d.className = 'lyric-line';
                        }

                        if (isBlankInterlude && targetSynced) {
                            d.classList.add('am-interlude-line');
                            d.innerHTML = `
                                <span class="am-interlude-dots active">
                                    <span class="am-interlude-dot"></span>
                                    <span class="am-interlude-dot"></span>
                                    <span class="am-interlude-dot"></span>
                                </span>
                            `;
                        } else if (words && words.length > 0) {
                            d.classList.add('has-word-sync');
                            words.forEach(w => {
                                var wordSpan = document.createElement('span');
                                wordSpan.className = 'yf-word yf-word-upcoming';
                                wordSpan.setAttribute('data-start', w.start);
                                wordSpan.setAttribute('data-end', w.end);
                                var wordText = w.text || '';
                                if (lyricContainer.getAttribute('data-profanity') === 'false') {
                                    wordText = String(wordText).replaceAll(re, match => {
                                        if (match.length <= 1) return '*';
                                        return match.charAt(0) + '*'.repeat(match.length - 1);
                                    });
                                }
                                wordSpan.textContent = wordText;
                                d.appendChild(wordSpan);
                            });
                        } else {
                            if (lyricContainer.getAttribute('data-profanity') === 'false') {
                                var replacedLine = String(rawText).replaceAll(re, match => {
                                    if (match.length <= 1) return '*';
                                    return match.charAt(0) + '*'.repeat(match.length - 1);
                                });
                                d.textContent = replacedLine || '...';
                            } else {
                                d.textContent = rawText || '...';
                            }
                        }

                        lyricElements.push(d);
                        lyricContainer.appendChild(d);
                    });

                    if (targetSource && targetSource.toUpperCase() === 'LRCLIB') {
                        var creditDiv = document.createElement('div');
                        creditDiv.className = 'yf-source-credit';
                        creditDiv.innerHTML = '<span>Lyrics provided by <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="yf-source-link">LRCLIB</a></span>';
                        creditDiv.addEventListener('click', (e) => e.stopPropagation());
                        lyricContainer.appendChild(creditDiv);
                    }

                    if (targetSynced) {
                        attachLyricsSync(mediaElem, processedLyrics, lyricContainer, lyricElements);
                    } else {
                        detachLyricsSync(mediaElem);
                    }

                    intermediateContainer.appendChild(bubblesWrapper);
                    intermediateContainer.appendChild(lyricContainer);

                    var existingContent = container.querySelector(YTF_SEL.CONTAINER.SWAP_TARGETS);
                    if (existingContent) {
                        container.replaceChild(intermediateContainer, existingContent);
                    } else {
                        container.appendChild(intermediateContainer);
                    }
                }

                let searchDropdown = null;

                function closeFloatingSearchDropdown() {
                    if (searchDropdown) {
                        searchDropdown.remove();
                        searchDropdown = null;
                    }
                }

                function renderFloatingSearchDropdown(results, query, videoDuration) {
                    closeFloatingSearchDropdown();

                    var bottomBar = container.querySelector(YTF_SEL.HEADER.BOTTOM_ROW);
                    if (!bottomBar) return;

                    searchDropdown = document.createElement('div');
                    searchDropdown.id = 'yf-search-dropdown';
                    searchDropdown.className = 'yf-search-dropdown';

                    var headerDiv = document.createElement('div');
                    headerDiv.className = 'yf-search-dropdown-header';

                    var headerTitle = document.createElement('span');
                    headerTitle.className = 'yf-search-dropdown-title';
                    headerTitle.textContent = results && results.length > 0 ? `Results (${results.length})` : 'Search Results';

                    var closeBtn = document.createElement('button');
                    closeBtn.className = 'yf-search-close-btn';
                    closeBtn.title = 'Close';
                    closeBtn.setAttribute('aria-label', 'Close search dropdown');
                    closeBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    `;
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        closeFloatingSearchDropdown();
                    });

                    headerDiv.appendChild(headerTitle);
                    headerDiv.appendChild(closeBtn);
                    searchDropdown.appendChild(headerDiv);

                    if (!results || results.length === 0) {
                        var noResDiv = document.createElement('div');
                        noResDiv.className = 'yf-search-status';
                        const safeQuery = query ? String(query).replace(/"/g, '&quot;') : '';
                        noResDiv.innerHTML = `
                            <svg class="yf-search-status-icon" viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                            </svg>
                            <span class="yf-search-status-title">No Lyrics Found</span>
                            <span class="yf-search-status-text">No matching lyrics found for "${safeQuery}".</span>
                            <span class="yf-search-status-hint">Tip: Try searching with "Song Title - Artist" format.</span>
                        `;
                        searchDropdown.appendChild(noResDiv);
                    } else {
                        var listDiv = document.createElement('div');
                        listDiv.className = 'yf-search-dropdown-list';

                        results.forEach((item, index) => {
                            var row = document.createElement('div');
                            row.className = 'yf-search-result-item';
                            row.setAttribute('data-index', index);

                            var infoDiv = document.createElement('div');
                            infoDiv.className = 'yf-result-info';

                            var titleSpan = document.createElement('div');
                            titleSpan.className = 'yf-result-title';
                            titleSpan.textContent = item.trackName || 'Unknown Title';

                            var artistSpan = document.createElement('div');
                            artistSpan.className = 'yf-result-artist';
                            const artistText = [item.artistName, item.albumName].filter(Boolean).join(' • ');
                            artistSpan.textContent = artistText || 'Unknown Artist';

                            infoDiv.appendChild(titleSpan);
                            infoDiv.appendChild(artistSpan);

                            var metaDiv = document.createElement('div');
                            metaDiv.className = 'yf-result-meta';

                            if (item.hasWordSync) {
                                var wsBadge = document.createElement('span');
                                wsBadge.className = 'yf-wordsync-badge';
                                wsBadge.title = 'Word-by-word synced lyrics';
                                wsBadge.innerHTML = `
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                                        <path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z"/>
                                    </svg>
                                    <span>Word Synced</span>
                                `;
                                metaDiv.appendChild(wsBadge);
                            } else if (item.syncedLyrics && item.syncedLyrics.trim()) {
                                var syncedBadge = document.createElement('span');
                                syncedBadge.className = 'yf-synced-badge';
                                syncedBadge.title = 'Time-synced lyrics';
                                syncedBadge.innerHTML = `
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                                    </svg>
                                    <span>Synced</span>
                                `;
                                metaDiv.appendChild(syncedBadge);
                            } else {
                                var plainBadge = document.createElement('span');
                                plainBadge.className = 'yf-plain-badge';
                                plainBadge.title = 'Plain text lyrics';
                                plainBadge.textContent = 'Plain';
                                metaDiv.appendChild(plainBadge);
                            }

                            var durationSpan = document.createElement('span');
                            durationSpan.className = 'yf-result-duration';
                            durationSpan.textContent = formatDuration(item.duration);
                            metaDiv.appendChild(durationSpan);

                            row.appendChild(infoDiv);
                            row.appendChild(metaDiv);

                            row.addEventListener('click', (e) => {
                                e.stopPropagation();
                                selectTrack(item);
                            });

                            listDiv.appendChild(row);
                        });

                        searchDropdown.appendChild(listDiv);
                    }

                    bottomBar.appendChild(searchDropdown);
                }

                function selectTrack(item) {
                    closeFloatingSearchDropdown();

                    const chosenTitle = `${item.trackName}${item.artistName ? ' - ' + item.artistName : ''}`;
                    if (npt) {
                        npt.value = chosenTitle;
                        npt.setAttribute('data-current-title', chosenTitle);
                        npt.placeholder = chosenTitle;
                    }

                    function applySelectedLyrics(chosenLyrics, isSynced, isWordSync) {
                        const currentUid = container.getAttribute('data-uid') || uid;
                        const currentOffset = parseFloat(mediaElem?.getAttribute('ytf-data-offset')) || 0;
                        if (currentUid) {
                            chrome.runtime.sendMessage({
                                type: 'SAVE_SELECTED_LYRICS',
                                uid: currentUid,
                                data: {
                                    lyrics: chosenLyrics,
                                    title: chosenTitle,
                                    synced: isSynced,
                                    hasWordSync: isWordSync,
                                    source: 'LRCLIB',
                                    offset: currentOffset
                                }
                            });
                        }

                        currentLyrics = chosenLyrics;
                        currentSynced = isSynced;
                        currentSource = 'LRCLIB';

                        // Explicit user track selection: clear manual collapse for this video and open container
                        container.removeAttribute('data-manually-closed-uid');
                        try {
                            sessionStorage.removeItem('ytf-manually-closed-uid');
                        } catch (e) {}

                        if (container.classList.contains(YTF_SEL.CONTAINER.COLLAPSED_CLASS)) {
                            openContainer();
                        }

                        const existingIntermediate = container.querySelector(YTF_SEL.CONTAINER.INTERMEDIATE);
                        const notFoundElem = container.querySelector(YTF_SEL.CONTAINER.NOT_FOUND);

                        if (!existingIntermediate || notFoundElem) {
                            // Container was Not Found; swap it to intermediate container with lyrics
                            renderLyricsView(chosenLyrics, isSynced, 'LRCLIB', profanityCheck);
                        } else {
                            // Only update lyrics inside the existing lyricContainer in place!
                            var lyricContainer = existingIntermediate.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                            if (lyricContainer) {
                                detachLyricsSync(mediaElem);
                                lyricElements = [];
                                lyricContainer.innerHTML = '';
                                lyricContainer.setAttribute('data-profanity', profanityCheck);
                                var localFontSize = clampFontSize(effectiveFontSize || localStorage.getItem('fontSize') || '24px');
                                if (localFontSize) {
                                    lyricContainer.style.fontSize = localFontSize;
                                }

                                const pattern = fuzzyProfanityDictionary.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                                const re = new RegExp(`(${pattern})`, 'giu');

                                var processedLyrics = (chosenLyrics || []).reduce((acc, lItem) => {
                                    if (Array.isArray(lItem) ? lItem.length >= 2 : (lItem && String(lItem).trim())) {
                                        acc.push(lItem);
                                    }
                                    return acc;
                                }, []);

                                processedLyrics.forEach((l) => {
                                    var timestamp;
                                    var rawText = l;
                                    var words = null;
                                    if (Array.isArray(l)) {
                                        timestamp = l[0];
                                        rawText = l[1] ? l[1] : '';
                                        words = Array.isArray(l[2]) && l[2].length > 0 ? l[2] : null;
                                    }

                                    var isBlankInterlude = !rawText || String(rawText).trim() === '' || String(rawText).trim() === '...';
                                    var d = document.createElement('span');

                                    if (timestamp) {
                                        d.setAttribute('data-timestamp', timestamp);
                                        d.className = 'lyric-line';
                                        d.addEventListener('click', function () {
                                            const mElem = document.querySelector(YT_SEL.PLAYER.VIDEO);
                                            var curOffset = parseFloat(mElem?.getAttribute('ytf-data-offset')) || 0;
                                            const ts = this.getAttribute('data-timestamp');
                                            let seconds = 0;
                                            if (ts) {
                                                const parts = ts.split(':');
                                                if (parts.length === 2) {
                                                    const min = parseInt(parts[0], 10);
                                                    const sec = parseFloat(parts[1]) - curOffset;
                                                    seconds = min * 60 + sec;
                                                }
                                            }
                                            if (mElem) mElem.currentTime = seconds;
                                        });
                                    } else {
                                        d.className = 'lyric-line';
                                    }

                                    if (isBlankInterlude && isSynced) {
                                        d.classList.add('am-interlude-line');
                                        d.innerHTML = `
                                            <span class="am-interlude-dots active">
                                                <span class="am-interlude-dot"></span>
                                                <span class="am-interlude-dot"></span>
                                                <span class="am-interlude-dot"></span>
                                            </span>
                                        `;
                                    } else if (words && words.length > 0) {
                                        d.classList.add('has-word-sync');
                                        words.forEach(w => {
                                            var wordSpan = document.createElement('span');
                                            wordSpan.className = 'yf-word yf-word-upcoming';
                                            wordSpan.setAttribute('data-start', w.start);
                                            wordSpan.setAttribute('data-end', w.end);
                                            var wordText = w.text || '';
                                            if (lyricContainer.getAttribute('data-profanity') === 'false') {
                                                wordText = String(wordText).replaceAll(re, match => {
                                                    if (match.length <= 1) return '*';
                                                    return match.charAt(0) + '*'.repeat(match.length - 1);
                                                });
                                            }
                                            wordSpan.textContent = wordText;
                                            d.appendChild(wordSpan);
                                        });
                                    } else {
                                        if (lyricContainer.getAttribute('data-profanity') === 'false') {
                                            var replacedLine = String(rawText).replaceAll(re, match => {
                                                if (match.length <= 1) return '*';
                                                return match.charAt(0) + '*'.repeat(match.length - 1);
                                            });
                                            d.textContent = replacedLine || '...';
                                        } else {
                                            d.textContent = rawText || '...';
                                        }
                                    }

                                    lyricElements.push(d);
                                    lyricContainer.appendChild(d);
                                });

                                var creditDiv = document.createElement('div');
                                creditDiv.className = 'yf-source-credit';
                                creditDiv.innerHTML = '<span>Lyrics provided by <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="yf-source-link">LRCLIB</a></span>';
                                creditDiv.addEventListener('click', (e) => e.stopPropagation());
                                lyricContainer.appendChild(creditDiv);

                                if (isSynced) {
                                    attachLyricsSync(mediaElem, processedLyrics, lyricContainer, lyricElements);
                                }
                                lyricContainer.scrollTop = 0;
                            } else {
                                renderLyricsView(chosenLyrics, isSynced, 'LRCLIB', profanityCheck);
                            }
                        }
                    }

                    if (item.hasWordSync) {
                        if (item.lyricsfile) {
                            const parsed = parseLyricsfileYaml(item.lyricsfile);
                            applySelectedLyrics(parsed.length > 0 ? parsed : parseLrc(item.syncedLyrics), true, parsed.length > 0);
                        } else if (item.id) {
                            chrome.runtime.sendMessage({ type: 'FETCH_LRCLIB_RECORD', id: item.id }, (resp) => {
                                if (resp && resp.success && resp.record && resp.record.lyricsfile) {
                                    const parsed = parseLyricsfileYaml(resp.record.lyricsfile);
                                    applySelectedLyrics(parsed.length > 0 ? parsed : parseLrc(item.syncedLyrics), true, parsed.length > 0);
                                } else if (item.syncedLyrics && item.syncedLyrics.trim()) {
                                    applySelectedLyrics(parseLrc(item.syncedLyrics), true, false);
                                } else {
                                    applySelectedLyrics((item.plainLyrics || '').split('\n'), false, false);
                                }
                            });
                        } else if (item.syncedLyrics && item.syncedLyrics.trim()) {
                            applySelectedLyrics(parseLrc(item.syncedLyrics), true, false);
                        } else {
                            applySelectedLyrics((item.plainLyrics || '').split('\n'), false, false);
                        }
                    } else if (item.syncedLyrics && item.syncedLyrics.trim()) {
                        applySelectedLyrics(parseLrc(item.syncedLyrics), true, false);
                    } else if (item.plainLyrics && item.plainLyrics.trim()) {
                        applySelectedLyrics(item.plainLyrics.split('\n'), false, false);
                    } else {
                        applySelectedLyrics(['[No lyrics available for this track]'], false, false);
                    }
                }

                function performSearch(query) {
                    if (!query) return;

                    container.removeAttribute('data-manually-closed-uid');
                    try {
                        sessionStorage.removeItem('ytf-manually-closed-uid');
                    } catch (e) {}

                    openContainer();

                    var progressbar = container.querySelector(YTF_SEL.HEADER.PROGRESS_BAR);
                    if (progressbar) {
                        progressbar.classList.remove("no-animate");
                        progressbar.classList.add("pure-material-progress-linear");
                    }

                    closeFloatingSearchDropdown();

                    var bottomBar = container.querySelector(YTF_SEL.HEADER.BOTTOM_ROW);
                    if (bottomBar) {
                        searchDropdown = document.createElement('div');
                        searchDropdown.id = 'yf-search-dropdown';
                        searchDropdown.className = 'yf-search-dropdown';
                        const safeQuery = String(query).replace(/"/g, '&quot;');
                        searchDropdown.innerHTML = `
                            <div class="yf-search-dropdown-header">
                                <span class="yf-search-dropdown-title">Searching...</span>
                                <button class="yf-search-close-btn" title="Close" aria-label="Close">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="yf-search-status">
                                <div class="yf-search-spinner"></div>
                                <span class="yf-search-status-text">Searching lyrics for "${safeQuery}"...</span>
                            </div>
                        `;
                        searchDropdown.querySelector('.yf-search-close-btn')?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            closeFloatingSearchDropdown();
                        });
                        bottomBar.appendChild(searchDropdown);
                    }

                    chrome.runtime.sendMessage({ type: 'SEARCH_LRCLIB', val: query }, (response) => {
                        if (progressbar) {
                            progressbar.classList.remove("pure-material-progress-linear");
                            progressbar.classList.add("no-animate");
                        }

                        if (!response || !response.success || !response.results || response.results.length === 0) {
                            renderFloatingSearchDropdown([], query, 0);
                            return;
                        }

                        // Fetch video duration from DOM (consider even when < 59s)
                        const videoElem = document.querySelector(YT_SEL.PLAYER.VIDEO);
                        const videoDuration = (videoElem && !isNaN(videoElem.duration) && videoElem.duration > 0)
                            ? videoElem.duration
                            : 0;

                        const sorted = sortResultsByDuration(response.results, videoDuration);
                        renderFloatingSearchDropdown(sorted, query, videoDuration);
                    });
                }

                // Global listener to close search dropdown when clicking outside
                document.addEventListener('mousedown', (e) => {
                    if (searchDropdown && !searchDropdown.contains(e.target)) {
                        const inputElem = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_INPUT);
                        const searchBtnElem = container.querySelector(YTF_SEL.HEADER.SEARCH_BTN);
                        if (inputElem && inputElem.contains(e.target)) return;
                        if (searchBtnElem && searchBtnElem.contains(e.target)) return;
                        closeFloatingSearchDropdown();
                    }
                });

                container._performSearch = performSearch;
                container._closeSearchResults = closeFloatingSearchDropdown;

                const hasLyrics = (message === 'OK' && lyrics && lyrics.length > 0);
                const activeUid = uid || container.getAttribute('data-uid') || (new URL(window.location.href)).searchParams.get('v');
                const manuallyClosedUid = container.getAttribute('data-manually-closed-uid') || (function () {
                    try { return sessionStorage.getItem('ytf-manually-closed-uid'); } catch (err) { return null; }
                })();
                const isManuallyClosedForThisVideo = Boolean(activeUid && manuallyClosedUid === activeUid);

                if (hasLyrics) {
                    container.setAttribute('data-uid', uid);
                    renderLyricsView(lyrics, synced, source, profanityCheck);

                    // Opens up when lyrics is found and container is closed, unless closed manually by user
                    if (!isManuallyClosedForThisVideo) {
                        if (container.classList.contains(YTF_SEL.CONTAINER.COLLAPSED_CLASS)) {
                            openContainer();
                        }
                    }
                } else if (message === 'NOK') {
                    container.setAttribute('data-uid', uid);

                    var notFoundDiv = document.createElement('div');
                    notFoundDiv.id = 'notFound';
                    notFoundDiv.className = 'not-found';

                    var notFoundIcon = document.createElement('div');
                    notFoundIcon.className = 'not-found-icon';
                    notFoundIcon.innerHTML = `
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                        </svg>
                    `;

                    var notFoundTitle = document.createElement('span');
                    notFoundTitle.className = 'not-found-title';
                    notFoundTitle.textContent = 'No Lyrics Available';

                    var notFoundSub = document.createElement('span');
                    notFoundSub.className = 'not-found-subtext';
                    notFoundSub.textContent = 'Use the search bar above to look up lyrics';

                    notFoundDiv.appendChild(notFoundIcon);
                    notFoundDiv.appendChild(notFoundTitle);
                    notFoundDiv.appendChild(notFoundSub);

                    var existingContent = container.querySelector(YTF_SEL.CONTAINER.SWAP_TARGETS);
                    if (existingContent) {
                        container.replaceChild(notFoundDiv, existingContent);
                    } else {
                        container.appendChild(notFoundDiv);
                    }
                    detachLyricsSync(mediaElem);

                    // Container remains closed if video is not a music video or closed manually
                    if (!isMusic || isManuallyClosedForThisVideo) {
                        if (!container.classList.contains(YTF_SEL.CONTAINER.COLLAPSED_CLASS)) {
                            closeContainer();
                        }
                    }
                } else {
                    container.removeAttribute('data-uid');

                    var ytc = document.querySelector(YT_SEL.LAYOUT.SECONDARY_INNER);
                    var c = ytc?.querySelector(YTF_SEL.CONTAINER.CLASS);
                    var lc = ytc?.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                    if (lc && c) {
                        c.removeChild(c.lastChild);
                    }
                    detachLyricsSync(mediaElem);

                    if (!isMusic || isManuallyClosedForThisVideo) {
                        closeContainer();
                    }
                }

                var progressbar = container.querySelector(YTF_SEL.HEADER.PROGRESS_BAR);
                if (progressbar) {
                    progressbar.classList.remove("pure-material-progress-linear");
                    progressbar.classList.add("no-animate");
                }

                function timestampToSeconds(ts) {
                    const match = ts.match(/^(\d{1,2}):(\d{1,2})\.(\d{2,3})$/);
                    if (!match) return 0;
                    const [, min, sec, ms] = match;
                    return parseInt(min, 10) * 60 + parseInt(sec, 10) + parseInt(ms, 10) / Math.pow(10, ms.length);
                }

                function findActiveLyricIndex(lyricsArr, currentTime, offset) {
                    let left = 0, right = lyricsArr.length - 1, result = 0;
                    while (left <= right) {
                        const mid = Math.floor((left + right) / 2);
                        const lyricTime = timestampToSeconds(lyricsArr[mid][0]) - (offset ? offset : 0);
                        if (lyricTime <= currentTime) {
                            result = mid;
                            left = mid + 1;
                        } else {
                            right = mid - 1;
                        }
                    }
                    return result;
                }

                var currentLyricIndex = -1;
                var currentActiveElement;

                function syncLyricsDisplay(lyricsArr, currentTime, offset, lyricElements, immediate = false) {
                    const activeIdx = findActiveLyricIndex(lyricsArr, currentTime, offset);
                    const el = lyricElements[activeIdx];

                    // Sequential 3-dot equalizer progress during instrumental interludes
                    if (el && el.classList.contains('am-interlude-line')) {
                        const startT = timestampToSeconds(lyricsArr[activeIdx][0]) - offset;
                        const endT = (activeIdx + 1 < lyricsArr.length)
                            ? timestampToSeconds(lyricsArr[activeIdx + 1][0]) - offset
                            : startT + 4;
                        const duration = Math.max(endT - startT, 0.5);
                        const progress = Math.min(Math.max((currentTime - startT) / duration, 0), 1);

                        const dotsWrap = el.querySelector('.am-interlude-dots');
                        const dots = el.querySelectorAll('.am-interlude-dot');
                        if (dots.length === 3) {
                            dots[0].classList.toggle('lit', progress >= 0.05);
                            dots[1].classList.toggle('lit', progress >= 0.36);
                            dots[2].classList.toggle('lit', progress >= 0.68);
                            if (dotsWrap) dotsWrap.classList.toggle('pulsing', progress >= 0.68);
                        }
                    }

                    // Real-time word-level synchronization for active line
                    if (el && el.classList.contains('has-word-sync')) {
                        const wordSpans = el.querySelectorAll('.yf-word');
                        for (let i = 0; i < wordSpans.length; i++) {
                            const wSpan = wordSpans[i];
                            const wStart = parseFloat(wSpan.getAttribute('data-start')) - offset;
                            const wEnd = parseFloat(wSpan.getAttribute('data-end')) - offset;
                            if (currentTime >= wEnd) {
                                if (wSpan.className !== 'yf-word yf-word-sung') wSpan.className = 'yf-word yf-word-sung';
                            } else if (currentTime >= wStart && currentTime < wEnd) {
                                if (wSpan.className !== 'yf-word yf-word-current') wSpan.className = 'yf-word yf-word-current';
                            } else {
                                if (wSpan.className !== 'yf-word yf-word-upcoming') wSpan.className = 'yf-word yf-word-upcoming';
                            }
                        }
                    }

                    if (currentLyricIndex !== activeIdx || immediate) {
                        if (currentActiveElement && currentActiveElement !== el) {
                            currentActiveElement.classList.remove('active-lyric');
                            const oldDots = currentActiveElement.querySelectorAll('.am-interlude-dot');
                            oldDots.forEach(d => d.classList.remove('lit'));
                            const oldWords = currentActiveElement.querySelectorAll('.yf-word');
                            oldWords.forEach(w => {
                                const wEnd = parseFloat(w.getAttribute('data-end')) - offset;
                                w.className = (currentTime >= wEnd) ? 'yf-word yf-word-sung' : 'yf-word yf-word-upcoming';
                            });
                        }
                        if (immediate && el?.parentElement) {
                            const prevActives = el.parentElement.querySelectorAll('.active-lyric');
                            prevActives.forEach(prev => {
                                if (prev !== el) prev.classList.remove('active-lyric');
                            });
                        }
                        currentLyricIndex = activeIdx;
                        currentActiveElement = el;
                        if (el) el.classList.add('active-lyric');

                        const parent = el?.parentElement;
                        if (parent && parent.classList.contains('lyricContainer')) {
                            const elOffsetTop = el.offsetTop;
                            const parentHeight = parent.clientHeight;
                            const scrollPosition = elOffsetTop - (parentHeight * 0.22);

                            parent.scrollTo({
                                top: scrollPosition,
                                behavior: immediate ? 'auto' : 'smooth'
                            });
                        } else if (el) {
                            el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' });
                        }
                    }
                }

                function attachLyricsSync(mediaElem, lyricsArr, lyricsContainer, lyricElements) {
                    if (!mediaElem || !lyricsArr || !lyricsContainer) return;
                    detachLyricsSync(mediaElem);

                    let isLyricsVisible = true;
                    const lyricsObserver = new IntersectionObserver((entries) => {
                        const wasVisible = isLyricsVisible;
                        isLyricsVisible = entries[0]?.isIntersecting ?? false;

                        // When coming back onto screen, immediately show and scroll to the active line
                        if (isLyricsVisible && !wasVisible && mediaElem) {
                            var offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                            syncLyricsDisplay(lyricsArr, mediaElem.currentTime, offset, lyricElements, true);
                        }
                    }, { threshold: 0.01 });

                    lyricsObserver.observe(lyricsContainer);
                    mediaElem._lyricsObserver = lyricsObserver;

                    const onVisibilityChange = () => {
                        if (document.hidden) {
                            // Document hidden, sync loop idle
                        } else if (isLyricsVisible && mediaElem) {
                            var offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                            syncLyricsDisplay(lyricsArr, mediaElem.currentTime, offset, lyricElements, true);
                        }
                    };
                    document.addEventListener('visibilitychange', onVisibilityChange);
                    mediaElem._lyricsVisibilityChange = onVisibilityChange;

                    mediaElem._syncCurrentLyric = function (immediate = true) {
                        if (!mediaElem || !lyricsArr || !lyricElements || lyricElements.length === 0) return;
                        var offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                        syncLyricsDisplay(lyricsArr, mediaElem.currentTime, offset, lyricElements, immediate);
                    };

                    mediaElem._lyricsSyncHandler = function () {
                        // Do not perform lyric sync if lyrics are not visible on screen, document is hidden, or container is collapsed
                        if (!isLyricsVisible || document.hidden || container.classList.contains(YTF_SEL.CONTAINER.COLLAPSED_CLASS)) return;
                        var offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                        syncLyricsDisplay(lyricsArr, mediaElem.currentTime, offset, lyricElements);
                    };
                    mediaElem.addEventListener('timeupdate', mediaElem._lyricsSyncHandler);

                    // If container is currently open, highlight active lyric immediately
                    if (!container.classList.contains(YTF_SEL.CONTAINER.COLLAPSED_CLASS)) {
                        mediaElem._syncCurrentLyric(true);
                    }
                }

                function detachLyricsSync(mediaElem) {
                    if (mediaElem) {
                        if (mediaElem._lyricsObserver) {
                            mediaElem._lyricsObserver.disconnect();
                            delete mediaElem._lyricsObserver;
                        }
                        if (mediaElem._lyricsVisibilityChange) {
                            document.removeEventListener('visibilitychange', mediaElem._lyricsVisibilityChange);
                            delete mediaElem._lyricsVisibilityChange;
                        }
                        if (mediaElem._lyricsSyncHandler) {
                            mediaElem.removeEventListener('timeupdate', mediaElem._lyricsSyncHandler);
                            delete mediaElem._lyricsSyncHandler;
                        }
                        if (mediaElem._syncCurrentLyric) {
                            delete mediaElem._syncCurrentLyric;
                        }
                    }
                }
            },
            args: [lyrics, message, uid, title, profanityCheck, synced, offset, fuzzyProfanityDictionary, source, YT_SELECTORS, YTF_SELECTORS, savedFontSize, isMusic]
        });

        // Apple Music Mesh Lava-Lamp Visualizer (Zero-Repaint GPU Composited)
        await chrome.scripting.executeScript({
            target: { tabId },
            function: (YTF_SEL) => {
                // Clean up any previous song's animation loop & observers to prevent leaks
                if (typeof window.__ytfVisualizerCleanup === 'function') {
                    window.__ytfVisualizerCleanup();
                }

                // Exact same predefined colors
                const colors = {
                    bubble1: '#7B68EE', // Medium Slate Blue / Violet
                    bubble2: '#FF6B6B', // Warm Coral Red
                    bubble3: '#4ECDC4', // Soft Aqua Teal
                };

                const wrapper = document.querySelector(YTF_SEL.VISUALIZER.BUBBLES_WRAPPER);
                if (!wrapper) return;

                const bubbles = YTF_SEL.VISUALIZER.BUBBLE_IDS.map(id => document.getElementById(id));
                if (!bubbles[0] || !bubbles[1] || !bubbles[2]) return;

                // Pre-feathered multi-stop radial gradients:
                // Eliminates expensive CSS `filter: blur(90px)` recalculations on every frame!
                const applyBubbleThemes = () => {
                    const isDark = document.documentElement.hasAttribute('dark');
                    if (isDark) {
                        bubbles[0].style.background = `radial-gradient(circle at 50% 50%, ${colors.bubble1}E6 0%, ${colors.bubble1}99 35%, ${colors.bubble1}26 62%, transparent 76%)`;
                        bubbles[1].style.background = `radial-gradient(circle at 50% 50%, ${colors.bubble2}E6 0%, ${colors.bubble2}99 36%, ${colors.bubble2}26 64%, transparent 78%)`;
                        bubbles[2].style.background = `radial-gradient(circle at 50% 50%, ${colors.bubble3}D9 0%, ${colors.bubble3}8C 34%, ${colors.bubble3}22 60%, transparent 75%)`;
                        bubbles.forEach(b => { b.style.opacity = '1'; });
                    } else {
                        // Soft luminous pastel blooms for light mode
                        bubbles[0].style.background = `radial-gradient(circle at 50% 50%, rgba(123, 104, 238, 0.40) 0%, rgba(123, 104, 238, 0.22) 35%, rgba(123, 104, 238, 0.06) 62%, transparent 76%)`;
                        bubbles[1].style.background = `radial-gradient(circle at 50% 50%, rgba(255, 107, 107, 0.35) 0%, rgba(255, 107, 107, 0.18) 36%, rgba(255, 107, 107, 0.05) 64%, transparent 78%)`;
                        bubbles[2].style.background = `radial-gradient(circle at 50% 50%, rgba(78, 205, 196, 0.38) 0%, rgba(78, 205, 196, 0.20) 34%, rgba(78, 205, 196, 0.05) 60%, transparent 75%)`;
                        bubbles.forEach(b => { b.style.opacity = '0.85'; });
                    }
                };

                applyBubbleThemes();

                const themeObserver = new MutationObserver(() => {
                    applyBubbleThemes();
                });
                themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });

                bubbles.forEach(b => {
                    if (b.parentElement !== wrapper) wrapper.appendChild(b);
                });

                const videoElem = document.querySelector('video');
                let viewW = 420, viewH = 560, baseSize = 520;

                const blobConfigs = [
                    {
                        homeX: 0.22, homeY: 0.28,
                        orbitX: 0.34, orbitY: 0.28,
                        speedX: 0.21, speedY: 0.16,
                        rotSpeed: 11,
                        stretchFreq: 0.27,
                        phase: 0.4
                    },
                    {
                        homeX: 0.76, homeY: 0.68,
                        orbitX: 0.36, orbitY: 0.30,
                        speedX: 0.17, speedY: 0.23,
                        rotSpeed: -14,
                        stretchFreq: 0.22,
                        phase: 2.3
                    },
                    {
                        homeX: 0.35, homeY: 0.72,
                        orbitX: 0.32, orbitY: 0.34,
                        speedX: 0.25, speedY: 0.19,
                        rotSpeed: 9,
                        stretchFreq: 0.31,
                        phase: 4.1
                    }
                ];

                class AppleMeshLobe {
                    constructor(el, cfg) {
                        this.el = el;
                        this.cfg = cfg;
                        this.t = cfg.phase;
                        this.angle = cfg.phase * 30;
                    }

                    applySize() {
                        this.el.style.width = baseSize + 'px';
                        this.el.style.height = baseSize + 'px';
                    }

                    update(dt) {
                        this.t += dt;
                        this.angle = (this.angle + this.cfg.rotSpeed * dt) % 360;

                        // Compound sine/cosine Lissajous drift for non-repeating organic paths
                        const normX = this.cfg.homeX
                            + Math.sin(this.t * this.cfg.speedX) * this.cfg.orbitX
                            + Math.cos(this.t * this.cfg.speedY * 0.6) * 0.08;
                        const normY = this.cfg.homeY
                            + Math.cos(this.t * this.cfg.speedY) * this.cfg.orbitY
                            + Math.sin(this.t * this.cfg.speedX * 0.7) * 0.08;

                        const x = (normX * viewW) - (baseSize * 0.5);
                        const y = (normY * viewH) - (baseSize * 0.5);

                        // Anisotropic elliptical stretching (simulates morphing without border-radius repaint)
                        const stretch = Math.sin(this.t * this.cfg.stretchFreq);
                        const scaleX = 1.25 + stretch * 0.28;
                        const scaleY = 1.25 - stretch * 0.22;

                        this.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${this.angle.toFixed(1)}deg) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
                    }
                }

                const lobes = bubbles.map((el, i) => new AppleMeshLobe(el, blobConfigs[i]));

                function updateDimensions() {
                    const rect = wrapper.getBoundingClientRect();
                    viewW = rect.width || 420;
                    viewH = rect.height || 560;
                    // Oversized lobes (1.35x container max dimension) so edges never show
                    baseSize = Math.round(Math.max(viewW, viewH, 420) * 1.35);
                    lobes.forEach(lobe => lobe.applySize());
                }

                updateDimensions();

                // Lock frame submission to ~30 FPS (33ms interval):
                // Visually identical for slow ambient gradients, cuts CPU/GPU wakeups by 50-75%
                const FRAME_INTERVAL = 1000 / 30;
                let isVisible = true;
                let rafId = null;
                let lastTimestamp = performance.now();

                function tick(now) {
                    if (!isVisible || document.hidden) {
                        rafId = null;
                        return;
                    }

                    rafId = requestAnimationFrame(tick);

                    const elapsed = now - lastTimestamp;
                    if (elapsed < FRAME_INTERVAL) return;

                    // Clamp delta time to avoid jumps after tab switching
                    const rawDt = Math.min(elapsed / 1000, 0.1);
                    lastTimestamp = now - (elapsed % FRAME_INTERVAL);

                    // Subtle speed modulation: lively when playing, calm idle drift when paused
                    const playbackMultiplier = (videoElem && !videoElem.paused) ? 1.0 : 0.35;
                    const dt = rawDt * playbackMultiplier;

                    for (let i = 0; i < lobes.length; i++) {
                        lobes[i].update(dt);
                    }
                }

                function startLoop() {
                    if (!rafId && isVisible && !document.hidden) {
                        lastTimestamp = performance.now();
                        rafId = requestAnimationFrame(tick);
                    }
                }

                function stopLoop() {
                    if (rafId) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }
                }

                // Render initial frame immediately
                lobes.forEach(lobe => lobe.update(0.016));

                const resizeObserver = new ResizeObserver(() => {
                    updateDimensions();
                    lobes.forEach(lobe => lobe.update(0));
                });
                resizeObserver.observe(wrapper);

                const intersectionObserver = new IntersectionObserver((entries) => {
                    isVisible = entries[0]?.isIntersecting ?? false;
                    if (isVisible) startLoop();
                    else stopLoop();
                }, { threshold: 0.01 });
                intersectionObserver.observe(wrapper);

                const onVisibilityChange = () => {
                    if (document.hidden) stopLoop();
                    else startLoop();
                };
                document.addEventListener('visibilitychange', onVisibilityChange);

                window.__ytfVisualizerCleanup = () => {
                    stopLoop();
                    if (themeObserver) themeObserver.disconnect();
                    resizeObserver.disconnect();
                    intersectionObserver.disconnect();
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                };
            },
            args: [YTF_SELECTORS]
        });
    };

	/**
	 * Checks if the current tab is playing music and extracts song metadata.
	 */
    async function getVideoMusicMetadata(tabId, uid) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                function: (expectedUid, YT_SEL) => {
                    const cleanField = (str) => str?.replace(/\b(feat|ft)\b\.?/i, '').trim() || '';

                    const watchFlexy = document.querySelector('ytd-watch-flexy:not([hidden])');
                    if (!watchFlexy) return JSON.stringify({ isMusic: false, val: '', channel: '' });
                    const domUid = watchFlexy.getAttribute('video-id');
                    if (expectedUid && domUid && domUid !== expectedUid) {
                        return JSON.stringify({ isMusic: false, val: '', channel: '' });
                    }

                    const musicBadge = watchFlexy.querySelector(YT_SEL.METADATA.MUSIC_BADGE);
                    const isMusic = musicBadge != null && musicBadge.textContent.trim() === 'Music';

                    let val = '';
                    let channel = '';

                    if (isMusic) {
                        const musicCard = watchFlexy.querySelectorAll(YT_SEL.METADATA.MUSIC_HEADER_TITLE);
                        const cardContainer = YT_SEL.METADATA.MUSIC_CARD_CONTAINERS.find(s => watchFlexy.querySelector(s) !== null);

                        if (musicCard && cardContainer) {
                            val = cleanField(watchFlexy.querySelector(cardContainer + YT_SEL.METADATA.MUSIC_CARD_TITLE_SUFFIX)?.textContent);
                            channel = cleanField(watchFlexy.querySelector(cardContainer + YT_SEL.METADATA.MUSIC_CARD_ARTIST_SUFFIX)?.textContent);
                        }

                        if (!val || !channel) {
                            val = cleanField(watchFlexy.querySelector(YT_SEL.METADATA.FALLBACK_TITLE)?.textContent);
                            channel = cleanField(watchFlexy.querySelector(YT_SEL.METADATA.FALLBACK_CHANNEL)?.textContent);
                        }
                    }

                    return JSON.stringify({ isMusic, val, channel });
                },
                args: [uid, YT_SELECTORS]
            });

            return results && results[0]?.result ? JSON.parse(results[0].result) : { isMusic: false, val: '', channel: '' };
        } catch (e) {
            console.warn('getVideoMusicMetadata error:', e);
            return { isMusic: false, val: '', channel: '' };
        }
    }

    async function musicCheck(tabId, uid) {
        const metadata = await getVideoMusicMetadata(tabId, uid);
        return metadata.isMusic;
    }

    async function findSongAndArtist(tabId, uid) {
        const metadata = await getVideoMusicMetadata(tabId, uid);
        return [{ result: JSON.stringify({ val: metadata.val, channel: metadata.channel }) }];
    }

    async function killShort(tabId, val) {
        await chrome.scripting.executeScript({
			target: { tabId },
			function: (val, YT_SEL) => {
				document.documentElement.classList.toggle(YT_SEL.SHORTS.HIDE_CLASS, Boolean(val));
            },
            args: [val, YT_SELECTORS]
		});
    }

    async function toggleProfanityFilter(tabId, bool) {
        console.log('TAB ID :: ', tabId)
        var uid = await chrome.scripting.executeScript({
            target: { tabId },
            function: (YTF_SEL) => {
                var container = document.querySelector(YTF_SEL.CONTAINER.ROOT)
                return container?.getAttribute('data-uid')
            },
            args: [YTF_SELECTORS]
        });

        if (uid[0]?.result) {
            const targetUid = uid[0].result;
            const lyricsObj = await getFromStorage(targetUid);
            await saveObject('yt-userPrefs', { profanity: (!bool).toString() });

            if (isEmpty(lyricsObj)) {
                return;
            }

            const lyrics = lyricsObj[targetUid]?.lyrics;
            const synced = lyricsObj[targetUid]?.synced;

            await chrome.scripting.executeScript({
                target: { tabId },
                function: (bool, lyrics, synced, fuzzyProfanityDictionary, YTF_SEL) => {
                    const container = document.querySelector(YTF_SEL.CONTAINER.INTERMEDIATE);
                    const lyricContainer = container?.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                    if (!lyricContainer) return;

                    const parsed = parseFloat(localStorage.getItem('fontSize') || '24px');
                    lyricContainer.style.fontSize = (!isNaN(parsed) ? Math.min(Math.max(parsed, 14), 36) : 24) + 'px';

                    const lyricLines = lyricContainer.querySelectorAll('.lyric-line');

                    if (bool) {
                        lyricContainer.setAttribute('data-profanity', 'true');
                        for (let i = 0; i < lyricLines.length; i++) {
                            if (lyricLines[i].classList.contains("am-interlude-line")) continue;
                            lyricLines[i].textContent = synced ? lyrics[i][1] : lyrics[i];
                        }
                    } else {
                        lyricContainer.setAttribute('data-profanity', 'false');

                        const pattern = fuzzyProfanityDictionary.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                        const re = new RegExp(`(${pattern})`, 'giu');

                        lyricLines.forEach(l => {
                            if (l.classList.contains("am-interlude-line")) return;
                            l.textContent = l.textContent.replaceAll(re, match => {
                                if (match.length <= 1) return '*';
                                return match.charAt(0) + '*'.repeat(match.length - 1);
                            });
                        });
                    }
                },
                args: [bool, lyrics, synced, fuzzyProfanityDictionary, YTF_SELECTORS]
            });
        }
    }

    function injectClickValidator(tabId) {
        if (!tabId) return;
        chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [YT_SELECTORS.ADS.ALL_SKIP_CLASSES],
            func: (skipButtonClasses) => {
                'use strict';

                if (window.__ytfAdBlockerInjected) {
                    console.log(':::Ad blocker already injected, skipping:::');
                    return;
                }

                function isInIframe() {
                    try {
                        console.log(':::Checking if in iframe:::');
                        return window.self !== window.top;
                    }
                    catch (e) {
                        console.log(':::Error In Iframe logic:::');
                        return true;
                    }
                }

                const getEventHandler = (listener) => function handleEvent(e) {
                    const handler = {
                        get(_, prop) {
                            console.log(':::Proxy get handler invoked:::');
                            if (prop === "isTrusted") {
                                return true;
                            }
                            if (typeof e[prop] === "function") {
                                return function (...args) {
                                    return e[prop](...args);
                                };
                            }
                            return e[prop];
                        },
                    };
                    return listener(new Proxy({}, handler));
                };
                function overrideAddEventListener() {
                    const originalAddEventListener = HTMLElement.prototype.addEventListener;
                    HTMLElement.prototype.addEventListener = function (type, listener, options) {
                        if (type === "click" && skipButtonClasses.includes(this.className)) {
                            return originalAddEventListener.call(this, type, getEventHandler(listener), options);
                        }
                        return originalAddEventListener.call(this, type, listener, options);
                    };
                }
                if (!isInIframe()) {
                    console.log(':::Youtube trusted click override injected:::')
                    overrideAddEventListener();
                }

                window.__ytfAdBlockerInjected = true;
            }
        });
    }

    function injectAdDetector() {
        chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [YT_SELECTORS],
            func: (YT_SEL) => {
                const video = document.querySelector(YT_SEL.PLAYER.VIDEO);
                var movie_player = document.querySelector(YT_SEL.PLAYER.MOVIE_PLAYER);
                if (!movie_player) {
                    return
                }
                observer = new MutationObserver(() => {
                    var adOverlay = movie_player.querySelector(YT_SEL.ADS.AD_OVERLAY);
                    if (!adOverlay) {
                        video.muted = false
                        return;
                    }
                    console.log('Ad overlay detected & muted');
                    video.muted = true;
                    if (video.paused) {
                        video.play
                    }
                    let adAttempts = 0;

                    const adCheckInterval = setInterval(() => {
                        adOverlay = document.querySelector(YT_SEL.ADS.AD_OVERLAY);

                        if (adOverlay && adAttempts < 4) {
                            if (video) {
                                video.currentTime = video.duration - 0.5;
                                console.log('ad duration ::: ' + video.duration)
                                setTimeout(() => {
                                    const skipButton = document.querySelector(YT_SEL.ADS.SKIP_BUTTON);
                                    if (skipButton) {
                                        skipButton.click();
                                        console.log('Skip ad button clicked');
                                    }
                                }, 1000);
                            }
                            adAttempts++;
                        } else {
                            clearInterval(adCheckInterval);
                        }
                    }, 900);

                });
                
                console.log(':::Observer injected:::')
                observer.observe(movie_player, {
                    childList: true,
                    subtree: true
                });

            }
        });
    }

})();

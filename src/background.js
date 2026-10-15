import { saveObject, getFromStorage, isEmpty, getVideoID, queryBuilder, getDefaultUserPrefs, fuzzyProfanityDictionary, findLyricsfromSources } from './utils.js';
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
    chrome.runtime.onMessage.addListener(async (obj, sender, sendResponse) => {
        const { type, val, action } = obj;

        if (action === 'clearUpdateBadge') {
            chrome.action.setBadgeText({ text: '' });
        }

        switch (type) {
            case 'PROFANITY_TOGGLE': {
                currentState.tabList.forEach(async (tabId) => {
                    toggleProfanityFilter(tabId, JSON.parse(val));
                });
                break;
            }
            case 'KILL_SHORTS': {
                saveObject('yt-userPrefs', { 'kill_shorts': val });
                chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
                    tabs.forEach(async tab => {
                        await killShort(tab.id, val);
                    });
                });
                currentState.tabList.forEach(async (tabId) => {
                    await killShort(tabId, val);
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
    async function main(url, tabId) {
        currentState.process = true;
        currentState.reqUrl = url;

        if (!currentState.tabList.includes(tabId)) {
            currentState.tabList.push(tabId);
        }

        if (currentState.tabList.includes(tabId)) {
            chrome.tabs.sendMessage(tabId, {
                type: "NEW_SEARCH",
                'val': getVideoID(currentState.reqUrl)
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Content script not ready yet
                }
                try {
                    runInContext(url, tabId);
                } catch (error) {
                    console.log(error);
                }
            });
        }
    }

    const runInContext = async (url, tabId) => {
        var uid = getVideoID(url);
        var obj = await getFromStorage(uid);
        let isMusic = await musicCheck(tabId);
        var prefs = await getFromStorage('yt-userPrefs');
        var profanityCheck = prefs['yt-userPrefs']?.profanity;
        let lyrics, message, title, source = '';
        let synced = false;
        let offset = 0.0;
        var skipAdsState = '';

        if (currentSearchController) {
            currentSearchController.abort('New search initiated');
        }
        currentSearchController = new AbortController();

        if (skipAdsState == 'FULL') {
            injectClickValidator();
        }

        if (isMusic) {
            let result = await findSongAndArtist(tabId);
            let { val, channel } = result && result[0]?.result ? JSON.parse(result[0].result) : { val: '', channel: '' };

            if ((!isEmpty(obj) && obj[uid]?.title && obj[uid]?.title != val) || (isEmpty(obj) && val)) {
                // Inject Searching UI state
                await chrome.scripting.executeScript({
                    target: { tabId },
                    function: (searchTitle, YT_SEL, YTF_SEL) => {
                        var ytc = document.querySelector(window.innerWidth < 1000 ? YT_SEL.LAYOUT.PRIMARY : YT_SEL.LAYOUT.SECONDARY);
                        var container = ytc?.querySelector(YTF_SEL.CONTAINER.CLASS);
                        if (!container) return;

                        var npt = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_INPUT);
                        if (npt) npt.placeholder = searchTitle || 'Searching...';
                        var nowPlaying = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_LABEL);
                        if (nowPlaying) nowPlaying.textContent = 'Searching -';

                        var progressbar = container.querySelector(YTF_SEL.HEADER.PROGRESS_BAR);
                        if (progressbar) {
                            progressbar.classList.remove("no-animate");
                            progressbar.classList.add("pure-material-progress-linear");
                        }

                        var searchingDiv = document.createElement('div');
                        searchingDiv.id = 'searchingDiv';
                        searchingDiv.className = 'not-found';
                        var searchingText = document.createElement('span');
                        searchingText.className = 'not-found-text sizeM';
                        searchingText.textContent = 'Searching...';
                        searchingDiv.appendChild(searchingText);

                        var existingContent = container.querySelector(YTF_SEL.CONTAINER.SWAP_TARGETS);
                        if (existingContent) {
                            container.replaceChild(searchingDiv, existingContent);
                        } else {
                            container.appendChild(searchingDiv);
                        }
                    },
                    args: [val, YT_SELECTORS, YTF_SELECTORS]
                });

                let result = await findLyricsfromSources(tabId, "", val, channel, currentSearchController.signal);
                let resultObject = JSON.parse(result[0]?.result);

                if (resultObject === undefined || resultObject === null || resultObject.message === 'NOK') {
                    lyrics = '';
                    message = 'NOK';
                } else {
                    lyrics = resultObject.lyrics ? resultObject.lyrics : '';
                    message = resultObject.message ? resultObject.message : '';
                    source = resultObject.source ? resultObject.source : '';
                    synced = resultObject.synced ? resultObject.synced : synced;
                    offset = resultObject.offset ? resultObject.offset : 0;
                }
                var scroll = 0;
                var timeCreated = Date.now();
                title = val;

                if (message === 'OK' && lyrics && lyrics.length > 0) {
                    saveObject(uid, { lyrics, message, scroll, timeCreated, lastAccessed: timeCreated, title, source, synced, offset });
                }
            } else if (!isEmpty(obj)) {
                lyrics = obj[uid]?.lyrics ? obj[uid]?.lyrics : '';
                message = obj[uid]?.message ? obj[uid].message : "NOK";
                title = obj[uid]?.title ? obj[uid].title : '';
                source = obj[uid]?.source ? obj[uid].source : '';
                synced = obj[uid]?.synced ? obj[uid].synced : false;
                offset = obj[uid]?.offset ? obj[uid].offset : 0;
            }
        } else {
            lyrics = obj[uid]?.lyrics ? obj[uid].lyrics : '';
            message = obj[uid]?.message ? obj[uid].message : "NOK";
            title = obj[uid]?.title ? obj[uid].title : '';
            source = obj[uid]?.source ? obj[uid].source : '';
            synced = obj[uid]?.synced ? obj[uid].synced : false;
            offset = obj[uid]?.offset ? obj[uid].offset : 0;
        }

        if (!profanityCheck || profanityCheck == undefined) {
            profanityCheck = true;
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            function: (lyrics, message, uid, title, profanityCheck, synced, offset, fuzzyProfanityDictionary, source, YT_SEL, YTF_SEL) => {
                var ytc = document.querySelector(window.innerWidth < 1000 ? YT_SEL.LAYOUT.PRIMARY : YT_SEL.LAYOUT.SECONDARY);
                var container = ytc?.querySelector(YTF_SEL.CONTAINER.CLASS);
                var intermediateContainer = ytc?.querySelector(YTF_SEL.CONTAINER.INTERMEDIATE);
                var lyricElements = [];
                const mediaElem = document.querySelector(YT_SEL.PLAYER.VIDEO);

                if (mediaElem) {
                    mediaElem.setAttribute('ytf-data-offset', offset);
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

                    var nowPlayingSpan = document.createElement("span");
                    nowPlayingSpan.className = "now-playing now-playing-text";
                    nowPlayingSpan.textContent = "Searching -";

                    var nowPlayingText = document.createElement("input");
                    nowPlayingText.setAttribute("autocomplete", "off");
                    nowPlayingText.id = "now-playing-text-input";
                    nowPlayingText.className = "now-playing-text-input";
                    nowPlayingText.textContent = title;
                    nowPlayingText.disabled = "disabled";

                    nowPlayingDiv.appendChild(nowPlayingSpan);
                    nowPlayingDiv.appendChild(nowPlayingText);

                    var menuSpan = document.createElement("span");
                    menuSpan.className = "yf-menu";
                    menuSpan.textContent = "...";

                    var yfDropdown = document.createElement('div');
                    yfDropdown.id = 'yf-dropdown';
                    yfDropdown.className = 'yf-dropdown';

                    const ul = document.createElement('ul');

                    ['Font Size', 'Lyric Offset', 'Report'].forEach((optionText) => {
                        const li = ul.appendChild(document.createElement('li'));
                        li.className = 'yf-dd-list';

                        function isEmpty(obj) {
                            return obj == null || Object.keys(obj).length === 0;
                        }

                        function getFromStorage(uid) {
                            return new Promise((resolve) => {
                                chrome.storage.local.get(uid, (result) => {
                                    if (chrome.runtime.lastError) {
                                        resolve({});
                                        return;
                                    }
                                    if (!isEmpty(result) && result[uid]?.title) {
                                        result[uid].lastAccessed = Date.now();
                                        chrome.storage.local.set({ [uid]: result[uid] });
                                    }
                                    resolve(result || {});
                                });
                            });
                        }

                        function getVideoID(url) {
                            try {
                                const urlObject = new URL(url);
                                const searchParams = new URLSearchParams(urlObject.search);
                                return searchParams.get('v');
                            } catch (e) {
                                return '';
                            }
                        }

                        async function saveObject(uid, obj) {
                            const currentPrefs = await getFromStorage(uid);
                            const updatedPrefs = { ...currentPrefs[uid], ...obj };
                            return new Promise((resolve, reject) => {
                                chrome.storage.local.set({ [uid]: updatedPrefs }, () => {
                                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                                    resolve();
                                });
                            });
                        }

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
                                    var currentFontSize = fontSizeElement.textContent ? parseFloat(fontSizeElement.textContent) : 23;
                                    if (currentFontSize > 11) {
                                        var fontSize = (currentFontSize - 1) + 'px';
                                        document.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER).style.fontSize = fontSize;
                                        localStorage.setItem('fontSize', fontSize);
                                        if (fontSizeElement) fontSizeElement.textContent = fontSize;
                                    }
                                });

                                li.appendChild(document.createElement('span')).className = 'yf-fontSize';
                                li.lastChild.id = 'yf-font-size';
                                var localFontSize = localStorage.getItem('fontSize');
                                li.lastChild.textContent = localFontSize ? localFontSize : '23px';

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
                                    var currentFontSize = fontSizeElement.textContent ? parseFloat(fontSizeElement.textContent) : 23;
                                    if (currentFontSize < 34) {
                                        var fontSize = (currentFontSize + 1) + 'px';
                                        document.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER).style.fontSize = fontSize;
                                        localStorage.setItem('fontSize', fontSize);
                                        if (fontSizeElement) fontSizeElement.textContent = fontSize;
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

                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.id = 'ytf-offset-decrement';
                                svgElement.classList.add('sFont', 'material-symbols-outlined');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M609.975-454.001q-11.033 0-18.657-7.418-7.625-7.418-7.625-18.384 0-10.966 7.463-18.581t18.496-7.615h215.757q11.033 0 18.658 7.418 7.624 7.418 7.624 18.384 0 10.966-7.463 18.581t-18.495 7.615H609.975Zm-403.58 79.846-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                li.lastChild.addEventListener('click', async () => {
                                    var offsetValueElement = li.querySelector(YTF_SEL.DROPDOWN.OFFSET_TEXT);
                                    offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                                    offset = Math.round((offset - 0.25) * 100) / 100;
                                    offsetValueElement.value = offset.toFixed(2);
                                    mediaElem.setAttribute('ytf-data-offset', offset);
                                    await saveObject(getVideoID(document.URL), { 'offset': offset });
                                });

                                li.appendChild(document.createElement('input')).className = 'yf-fontSize yf-clearInput';
                                li.lastChild.id = 'yf-offset-text';
                                li.lastChild.type = 'number';
                                li.lastChild.step = '0.25';
                                li.lastChild.value = offset ? offset : '0.00';

                                let offsetTimeout;
                                let lastOffsetValue = offset ? offset : 0;

                                li.lastChild.addEventListener('change', (e) => {
                                    let val = parseFloat(e.target.value);
                                    if (isNaN(val) || val === '') {
                                        e.target.value = '0.00';
                                        return;
                                    }
                                    val = Math.round(val * 100) / 100;
                                    e.target.value = val.toFixed(2);
                                    mediaElem.setAttribute('ytf-data-offset', val);
                                    if (val === lastOffsetValue) return;
                                    lastOffsetValue = val;
                                    clearTimeout(offsetTimeout);
                                    offsetTimeout = setTimeout(async () => {
                                        await saveObject(getVideoID(document.URL), { 'offset': val });
                                    }, 500);
                                });

                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('sFont', 'material-symbols-outlined');
                                svgElement.id = 'ytf-offset-increment';
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "m206.395-374.155-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Zm468.617-32.253h-82.001q-11.05 0-18.524-7.503-7.475-7.503-7.475-18.492t7.475-18.41q7.474-7.42 18.524-7.42h82.001v-81.689q0-10.984 7.418-18.609 7.418-7.624 18.384-7.624 10.966 0 18.455 7.475 7.49 7.474 7.49 18.524v82.001h82.168q11.086 0 18.585 7.478 7.498 7.479 7.498 18.534 0 11.056-7.498 18.521-7.499 7.465-18.585 7.465H743.44V-372q0 11.05-7.503 18.524-7.503 7.475-18.258 7.475-11.056 0-18.521-7.499-7.465-7.499-7.465-18.584v-82.168Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                li.lastChild.addEventListener('click', async () => {
                                    var offsetValueElement = li.querySelector(YTF_SEL.DROPDOWN.OFFSET_TEXT);
                                    offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                                    offset = Math.round((offset + 0.25) * 100) / 100;
                                    offsetValueElement.value = offset.toFixed(2);
                                    mediaElem.setAttribute('ytf-data-offset', offset);
                                    await saveObject(getVideoID(document.URL), { 'offset': offset });
                                });
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

                    header.appendChild(logoContainerDiv);
                    header.appendChild(nowPlayingDiv);
                    header.appendChild(menuSpan);
                    header.appendChild(yfDropdown);

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

                var npt = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_INPUT);
                var offsetInputElement = container.querySelector(YTF_SEL.DROPDOWN.OFFSET_TEXT);
                if (offsetInputElement) {
                    offsetInputElement.value = offset.toFixed(2);
                }

                if (message === 'OK') {
                    var nowPlaying = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_LABEL);
                    if (nowPlaying) nowPlaying.textContent = 'Now Playing -';

                    if (npt) npt.placeholder = title;
                    container.setAttribute('data-uid', uid);

                    intermediateContainer = document.createElement('div');
                    intermediateContainer.id = 'intermediateContainer';
                    intermediateContainer.className = 'intermediateContainer';

                    var lyricContainer = document.createElement('div');
                    lyricContainer.id = 'lyricContainer';
                    lyricContainer.className = 'lyricContainer lyric sizeM';
                    lyricContainer.setAttribute('data-profanity', profanityCheck);

                    var localFontSize = localStorage.getItem('fontSize');
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

                    lyrics = lyrics.reduce((acc, item) => {
                        if (item.length >= 2) {
                            acc.push(item);
                        }
                        return acc;
                    }, []);

                    // Populate lyrics & detect instrumental gaps for Apple Music 3-dot equalizer
                    lyrics.forEach((l, idx) => {
                        var timestamp;
                        var rawText = l;
                        if (Array.isArray(l)) {
                            timestamp = l[0];
                            rawText = l[1] ? l[1] : '';
                        }

                        var isBlankInterlude = !rawText || rawText.trim() === '' || rawText.trim() === '...';
                        var d = document.createElement('span');

                        if (timestamp) {
                            d.setAttribute('data-timestamp', timestamp);
                            d.className = 'lyric-line';
                            d.addEventListener('click', function () {
                                const mediaElem = document.querySelector('video');
                                var offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                                const ts = this.getAttribute('data-timestamp');
                                let seconds = 0;
                                if (ts) {
                                    const parts = ts.split(':');
                                    if (parts.length === 2) {
                                        const min = parseInt(parts[0], 10);
                                        const sec = parseFloat(parts[1]) - offset;
                                        seconds = min * 60 + sec;
                                    }
                                }
                                if (mediaElem) mediaElem.currentTime = seconds;
                            });
                        }

                        if (isBlankInterlude && synced) {
                            d.classList.add('am-interlude-line');
                            d.innerHTML = `
                                <span class="am-interlude-dots active">
                                    <span class="am-interlude-dot"></span>
                                    <span class="am-interlude-dot"></span>
                                    <span class="am-interlude-dot"></span>
                                </span>
                            `;
                        } else {
                            if (lyricContainer.getAttribute('data-profanity') === 'false') {
                                var replacedLine = rawText.replaceAll(re, match => {
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

                    if (source && source.toUpperCase() === 'LRCLIB') {
                        var creditDiv = document.createElement('div');
                        creditDiv.className = 'yf-source-credit';
                        creditDiv.innerHTML = '<span>Lyrics provided by <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="yf-source-link">LRCLIB</a></span>';
                        creditDiv.addEventListener('click', (e) => e.stopPropagation());
                        lyricContainer.appendChild(creditDiv);
                    }

                    if (synced) {
                        attachLyricsSync(mediaElem, lyrics, lyricContainer, lyricElements);
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
                } else if (message === 'NOK') {
                    if (npt) npt.placeholder = title;
                    container.setAttribute('data-uid', uid);

                    var nowPlaying = container.querySelector(YTF_SEL.HEADER.NOW_PLAYING_LABEL);
                    if (nowPlaying) nowPlaying.textContent = 'Now Playing -';

                    var notFoundDiv = document.createElement('div');
                    notFoundDiv.id = 'notFound';
                    notFoundDiv.className = 'not-found';

                    var notFoundText = document.createElement('span');
                    notFoundText.className = 'not-found-text sizeM';
                    notFoundText.textContent = 'Not Found';

                    notFoundDiv.appendChild(notFoundText);

                    var existingContent = container.querySelector(YTF_SEL.CONTAINER.SWAP_TARGETS);
                    if (existingContent) {
                        container.replaceChild(notFoundDiv, existingContent);
                    } else {
                        container.appendChild(notFoundDiv);
                    }
                    detachLyricsSync(mediaElem);
                } else {
                    if (npt) npt.placeholder = title;
                    container.removeAttribute('data-uid');

                    var ytc = document.querySelector(YT_SEL.LAYOUT.SECONDARY_INNER);
                    var c = ytc?.querySelector(YTF_SEL.CONTAINER.CLASS);
                    var lc = ytc?.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER);
                    if (lc && c) {
                        c.removeChild(c.lastChild);
                    }
                    detachLyricsSync(mediaElem);
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

                function syncLyricsDisplay(lyricsArr, currentTime, offset, lyricElements) {
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

                    if (currentLyricIndex !== activeIdx) {
                        if (currentActiveElement) {
                            currentActiveElement.classList.remove('active-lyric');
                            const oldDots = currentActiveElement.querySelectorAll('.am-interlude-dot');
                            oldDots.forEach(d => d.classList.remove('lit'));
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
                                behavior: 'smooth'
                            });
                        } else if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
                }

                function attachLyricsSync(mediaElem, lyricsArr, lyricsContainer, lyricElements) {
                    if (!mediaElem || !lyricsArr || !lyricsContainer) return;
                    detachLyricsSync(mediaElem);
                    mediaElem._lyricsSyncHandler = function () {
                        var offset = parseFloat(mediaElem.getAttribute('ytf-data-offset')) || 0;
                        syncLyricsDisplay(lyricsArr, mediaElem.currentTime, offset, lyricElements);
                    };
                    mediaElem.addEventListener('timeupdate', mediaElem._lyricsSyncHandler);
                }

                function detachLyricsSync(mediaElem) {
                    if (mediaElem && mediaElem._lyricsSyncHandler) {
                        mediaElem.removeEventListener('timeupdate', mediaElem._lyricsSyncHandler);
                        delete mediaElem._lyricsSyncHandler;
                    }
                }
            },
            args: [lyrics, message, uid, title, profanityCheck, synced, offset, fuzzyProfanityDictionary, source, YT_SELECTORS, YTF_SELECTORS]
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
                bubbles[0].style.background = `radial-gradient(circle at 50% 50%, ${colors.bubble1}E6 0%, ${colors.bubble1}99 35%, ${colors.bubble1}26 62%, transparent 76%)`;
                bubbles[1].style.background = `radial-gradient(circle at 50% 50%, ${colors.bubble2}E6 0%, ${colors.bubble2}99 36%, ${colors.bubble2}26 64%, transparent 78%)`;
                bubbles[2].style.background = `radial-gradient(circle at 50% 50%, ${colors.bubble3}D9 0%, ${colors.bubble3}8C 34%, ${colors.bubble3}22 60%, transparent 75%)`;

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
                    resizeObserver.disconnect();
                    intersectionObserver.disconnect();
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                };
            },
            args: [YTF_SELECTORS]
        });
    };

	/**
	 * Checks if the current tab is playing a Music
	 * @param {*} tabId 
	 * @returns 
	 */
    async function musicCheck(tabId) {
        var isMusic = await chrome.scripting.executeScript({
            target: { tabId },
            function: (YT_SEL) => {
                let music = document.querySelector(YT_SEL.METADATA.MUSIC_BADGE)
                return (music === null) || (music === undefined) ? false : (music.textContent.trim() == 'Music')
            },
            args: [YT_SELECTORS]
        });
        return isMusic[0].result;
    }

    async function killShort(tabId, val) {
        await chrome.scripting.executeScript({
			target: { tabId },
			function: (val, YT_SEL) => {
				if (val) {
                    console.log("FREEMIUM : KILLSHORT", val)
                    document.documentElement.classList.toggle(YT_SEL.SHORTS.HIDE_CLASS, true);
                }
                else {
                    console.log("FREEMIUM : KILLSHORT", val)
                    document.documentElement.classList.toggle(YT_SEL.SHORTS.HIDE_CLASS, false);
                }
            },
            args: [val, YT_SELECTORS]
		});
    }

    async function findSongAndArtist(tabId) {
        return chrome.scripting.executeScript({
            target: { tabId },
            function: (YT_SEL) => {
                //Fallback for fetching song/artist
                let val, channel
                let musicCard = document.querySelectorAll(YT_SEL.METADATA.MUSIC_HEADER_TITLE)

                const musicCardSelectors = YT_SEL.METADATA.MUSIC_CARD_CONTAINERS

                var musicCardSelectorFound = musicCardSelectors.find(selector => {
                    return document.querySelector(selector) !== null
                })

                if (musicCard && musicCardSelectorFound) {
                    val = document.querySelector(musicCardSelectorFound + YT_SEL.METADATA.MUSIC_CARD_TITLE_SUFFIX)?.textContent.trim();
                    channel = document.querySelector(musicCardSelectorFound + YT_SEL.METADATA.MUSIC_CARD_ARTIST_SUFFIX)?.textContent.trim();
                    
                    val = val?.replace(/\b(feat|ft)\b\.?/i, '').trim();
	                channel = channel?.replace(/\b(feat|ft)\b\.?/i, '').trim();

                    console.log('getSongAndArtistFromCard => Title : ' + val + ' Artist : ' + channel)
                }

                if (val == undefined || channel == undefined) {
                    val = document.querySelector(YT_SEL.METADATA.FALLBACK_TITLE)?.textContent.trim();
                    channel = document.querySelector(YT_SEL.METADATA.FALLBACK_CHANNEL)?.textContent.trim();

                    val = val?.replace(/\b(feat|ft)\b\.?/i, '').trim();
	                channel = channel?.replace(/\b(feat|ft)\b\.?/i, '').trim();

                    console.log('getVideoNameAndChannel (FALLBACK) => Title : ' + val + ' Artist : ' + channel)
                }

                return JSON.stringify({ val: val || '', channel: channel || '' });
            },
            args: [YT_SELECTORS]
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
            var lyricsObj = await getFromStorage(uid[0]?.result)
            var profanity = await getFromStorage('yt-userPrefs')
            profanity['yt-userPrefs'] = { ...profanity['yt-userPrefs'], profanity: (!bool).toString() }
            console.log(profanity)

            if (isEmpty(lyricsObj)) {
                return
            }

            var lyrics = lyricsObj[uid[0]?.result]?.lyrics
            var synced = lyricsObj[uid[0]?.result]?.synced

            await chrome.scripting.executeScript({
                target: { tabId },
                function: (bool, lyrics, synced, fuzzyProfanityDictionary, YTF_SEL) => {
                    var container = document.querySelector(YTF_SEL.CONTAINER.INTERMEDIATE)
                    var lyricContainer = container?.querySelector(YTF_SEL.CONTAINER.LYRIC_CONTAINER)
                    if (!lyricContainer) return;

                    console.log('PROFANITY CHECKPOINT !!', bool)

                    var localFontSize = localStorage.getItem('fontSize');
                    if (localFontSize)
                        lyricContainer.style.fontSize = localFontSize

                    var lyricLines = lyricContainer.querySelectorAll('.lyric-line');

                    if (bool) {
                        lyricContainer.setAttribute('data-profanity', 'true')

                        for(var i=0; i<lyricLines.length; i++){
                            if (lyricLines[i].classList.contains("am-interlude-line")) continue;
                            lyricLines[i].textContent = synced ? lyrics[i][1] : lyrics[i];
                        }

                    }
                    else {
                        lyricContainer.setAttribute('data-profanity', 'false')

                        const pattern = fuzzyProfanityDictionary.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                        const re = new RegExp(`(${pattern})`, 'giu');

                        lyricLines.forEach(l => {
                            if (l.classList.contains("am-interlude-line")) return;
                            var replacedLine = l.textContent.replaceAll(re, match => {
                                if (match.length <= 1) return '*';
                                return match.charAt(0) + '*'.repeat(match.length - 1);
                            });
                            l.textContent = replacedLine
                        })
                    }
                },
                args: [bool, lyrics, synced, fuzzyProfanityDictionary, YTF_SELECTORS]
            })
        }

    }

    function injectClickValidator() {
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

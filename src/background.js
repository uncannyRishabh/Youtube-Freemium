import { saveObject, getFromStorage, isEmpty, getVideoID, queryBuilder, generateA2ZLyricsUrl, getDefaultUserPrefs, fuzzyProfanityDictionary, searchLrclibdotnet } from './utils.js';

(() => {
    // State management
    let currentState = {
        tabTitle: undefined,
        reqUrl: '',
        complete: false,
        process: false,
        navigation: false,
        tabList: []
    };
    const ONINSTALL_REASON_INSTALL = 'install';
    const ONINSTALL_REASON_UPDATE = 'update';
    const YOUTUBE_WATCH_URL = "youtube.com/watch";
    const YOUTUBE_URL = "youtube.com";
    const CHANGE_INFO_STATUS_LOADING = 'loading';
    const CHANGE_INFO_STATUS_COMPLETE = 'complete';
    const TRANSITION_FORWARD_BACK = 'forward_back';


    /**
     * Handles extension installation/update events
	 * Reload all tabs once installed 
	 * Clear local storage on update
     */
    chrome.runtime.onInstalled.addListener(function (details) {
        let bool
		if (details.reason == ONINSTALL_REASON_INSTALL) {
			console.log("I installed the goated extension")
			bool = true
		} else if (details.reason == ONINSTALL_REASON_UPDATE) {
			console.log("Goated extension just got updated")
			chrome.storage.local.clear(function () {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError);
				} else {
					console.log("Local storage cleared successfully");
                    saveObject('yt-userPrefs', getDefaultUserPrefs());
				}
			});
			bool = false
		}

		chrome.tabs.query({ url: "*://*.youtube.com/watch?*" }, function (tabs) {
			tabs.forEach(tab => {
				var tabId = tab.id
				chrome.scripting.executeScript({
					target: { tabId },
					function: (bool) => {
						window.location.reload(JSON.parse(bool));
					},
					args: [bool]
				});
			});

		});

	});
	

    /**
     * Handles tab updates 
     */
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tabInfo) {
		// console.log(changeInfo)
		// console.log(tabInfo)

		// Search   => 1) Local Storage via uid
		//if title and channel available and not stored in local || not matching tabTitle?  
		//			   2) search again
		//else 
		//			   2) display existing

		if (tabInfo.url.includes(YOUTUBE_WATCH_URL)) {
			if (changeInfo.status && changeInfo.status === CHANGE_INFO_STATUS_LOADING) {
				currentState.complete = false
				currentState.navigation = false
			}
			if (changeInfo.status && changeInfo.status === CHANGE_INFO_STATUS_COMPLETE) {
				if (currentState.navigation) {
					currentState.navigation = false
					currentState.tabTitle = tabInfo.title
					console.log('CALL !!! MAIN FROM onUPDATE : '+CHANGE_INFO_STATUS_COMPLETE)
					main(tabInfo.url, tabId);
				}
			}
			if (changeInfo.title) {
				currentState.tabTitle = tabInfo.title
				console.log('CALL !!! MAIN FROM onUPDATE')
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
				// console.log("Tab Title: " + tabTitle + ' CALL !!! MAIN FROM onHistoryStateUpdated')
				// main(tabTitle, details.url, details.tabId);
			}
			if (details.transitionQualifiers.includes(TRANSITION_FORWARD_BACK)) {
				currentState.navigation = true
                // console.log('CALL !!! MAIN FROM onUPDATE : '+TRANSITION_FORWARD_BACK)
    			// main(details.url, details.tabId);
			}
		}
    });

    /**
     * Handles tab closure
     */
    chrome.tabs.onRemoved.addListener((tabId) => {
        if (currentState.tabList.includes(tabId)) {
            currentState.tabList = currentState.tabList.filter(id => id !== tabId);
			console.log('Detached.. ' + tabId + ' from  :' + currentState.tabList)
        }
    });

    /**
     * Handles messages from content script
     */
    chrome.runtime.onMessage.addListener(async(obj, sender, sendResponse) => {
        const { type, val } = obj;

        switch (type) {
            case 'PROFANITY_TOGGLE':{
				currentState.tabList.forEach(async (tabId) => {
					toggleProfanityFilter(tabId, JSON.parse(val))
				})
                break;
            }
            case 'KILL_SHORTS': {
                console.log('KILL SHORTS')
                console.log(obj)
                saveObject('yt-userPrefs', { 'kill_shorts': val });

                chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
                    tabs.forEach(async tab => {
                        await killShort(tab.id, val)
                    });

                });

                currentState.tabList.forEach(async (tabId) => {
                    await killShort(tabId,val)
                })
				break;
			}
            case 'SLEEP_TIMER':{

                break;
            }
            case 'NEW_UI':{

                break;
            }
            default:
                console.warn('Unknown message type:', type);
        }
    });

    /**
     * Main processing function for YouTube page changes
     */
    async function main(url, tabId) {
		console.log('TAB ID :: ', tabId)

        currentState.process = true;
        currentState.reqUrl = url;

        if (!currentState.tabList.includes(tabId)) {
            currentState.tabList.push(tabId);
        }

        if (currentState.tabList.includes(tabId)
            //  && title && title.split(' ').length > 1
            ) {
			chrome.tabs.sendMessage(tabId, {
				type: "NEW_SEARCH",
				'val': getVideoID(currentState.reqUrl)
			}, (response) => {
				if (chrome.runtime.lastError) {
					console.log('Error getting');
				}
				if (response) {
					if (response.name && response.channel) {
						console.log(response);
					}
				}
				runInContext(tabId);
			});
		}

        // if (title && title.split(' ').length > 1) {
        //     await runInContext(tabId, title);
        // }
    }

    const runInContext = async (tabId) => {

        var uid = getVideoID(currentState.reqUrl);
        var obj = await getFromStorage(uid);
        let isMusic = await musicCheck(tabId);
		let lyrics, message, title, source = '';
        let synced = false;
		
        if (isMusic) {
			let result = await findSongAndArtist(tabId);
			let { val, channel } = result && result[0]?.result ? JSON.parse(result[0].result) : { val: '', channel: '' };
	
			console.log("CHECKPOINT " + val + ' - ' + channel + ' - ' + isMusic);
			console.log(obj)

            if ((!isEmpty(obj) && obj[uid]?.title && obj[uid]?.title != val) || (isEmpty(obj) && val)) {
                let result = await findLyricsfromSources(tabId, "", val, channel)

                let resultObject = JSON.parse(result[0]?.result);
                console.log('search result : ', resultObject)
                if (resultObject === undefined || resultObject === null || resultObject.message === 'NOK') {
                    lyrics = '';
                    message = 'NOK'
                }
                else {
                    lyrics = resultObject.lyrics ? resultObject.lyrics : '';
                    message = resultObject.message ? resultObject.message : '';
                    source = resultObject.source ? resultObject.source : '';
                    synced = resultObject.synced ? resultObject.synced : synced;
                }
                var scroll = 0
                var timeCreated = Date.now()
                title = val

                if (message === 'OK' && lyrics && lyrics.length > 0) {
                    saveObject(uid, { lyrics, message, scroll, timeCreated, lastAccessed: timeCreated, title, source, synced })
                }
                else if (message === 'NOK') {
                    ;
                }
            }
            else if (!isEmpty(obj)) {
                lyrics = obj[uid]?.lyrics ? obj[uid]?.lyrics : '';
                message = obj[uid]?.message ? obj[uid].message : "NOK";
                title = obj[uid]?.title ?  obj[uid].title : '';
                synced = obj[uid]?.synced ? obj[uid].synced : false
            }
        }
        else {
            lyrics = obj[uid]?.lyrics ? obj[uid].lyrics : ''
            message = obj[uid]?.message ? obj[uid].message : "NOK"
            title = obj[uid]?.title ?  obj[uid].title : ''
            synced = obj[uid]?.synced ? obj[uid].synced : false
        }

        var prefs = await getFromStorage('yt-userPrefs')
        var profanityCheck = prefs['yt-userPrefs']?.profanity;
        console.log("Profanity : ", profanityCheck)
        if (!profanityCheck || profanityCheck == undefined) {
            profanityCheck = true
        }

        await chrome.scripting.executeScript({
            target: { tabId },
            function: (lyrics, message, uid, title, profanityCheck, synced, fuzzyProfanityDictionary) => {
                var ytc = document.querySelector(window.innerWidth < 1000 ? '#primary > #primary-inner > #below' : '#secondary > #secondary-inner');
                var container = ytc?.querySelector('.yf-container')
                var intermediateContainer = ytc?.querySelector('#intermediateContainer')
                var lyricElements = []
                const mediaElem = document.querySelector('video')

                if (container) {
                    if (intermediateContainer) {
                        container.removeChild(container.lastChild)
                    }
                }
                else {
                    var header = document.createElement('div')
                    var progressbar = document.createElement("progress");
                    container = document.createElement('div')

                    //Imports
                    // var linkElement1 = document.createElement('link');
                    // linkElement1.rel = 'stylesheet';
                    // linkElement1.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0';
                    // document.head.appendChild(linkElement1);

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
                    linkElement4.href = 'https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet';
                    document.head.appendChild(linkElement4);

                    header.id = 'header'
                    header.className = 'yf-header'

                    container.id = 'yf-container'
                    container.className = 'yf-container'
                    if (window.innerWidth < 1000) {
                        container.classList.add('ytf-container-marginTop');
                    }


                    var logoContainerDiv = document.createElement("div");
                    logoContainerDiv.className = "yf-logo-container";

                    var youtubeDiv = document.createElement("div");
                    youtubeDiv.className = "yf-youtube";

                    var fSpan = document.createElement("span");
                    fSpan.className = "yf-f";
                    fSpan.textContent = "F";

                    youtubeDiv.appendChild(fSpan);

                    var freemiumSpan = document.createElement("span");
                    freemiumSpan.className = "freemium";
                    freemiumSpan.textContent = "Free Mium";

                    logoContainerDiv.appendChild(youtubeDiv);
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
                    nowPlayingText.disabled = "disabled"; //REMOVEME

                    nowPlayingDiv.appendChild(nowPlayingSpan);
                    nowPlayingDiv.appendChild(nowPlayingText);
                    // nowPlayingDiv.appendChild(searchIcon);

                    var menuSpan = document.createElement("span");
                    menuSpan.className = "yf-menu";
                    menuSpan.textContent = "...";

                    var yfDropdown = document.createElement('div');
                    yfDropdown.id = 'yf-dropdown';
                    yfDropdown.className = 'yf-dropdown';

                    const ul = document.createElement('ul');

                    ['Font Size', 'Report'].forEach((optionText, index) => {
                        const li = ul.appendChild(document.createElement('li'));
                        li.className = 'yf-dd-list';

                        switch (optionText) {
                            case 'Font Size': {
                                //Size Icon
                                var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('material-symbols-outlined')
                                svgElement.classList.add('yf-dd-list-icon')
                                var pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M592.54-687.001H432.385q-12.628 0-21.467-8.853-8.84-8.852-8.84-21.499 0-12.646 8.84-21.646 8.839-9 21.467-9h381.307q12.628 0 21.467 8.853 8.84 8.853 8.84 21.499 0 12.647-8.84 21.646-8.839 9-21.467 9H653.537v444.693q0 12.628-8.852 21.467-8.853 8.84-21.5 8.84-12.646 0-21.646-8.952-8.999-8.952-8.999-21.74v-444.308ZM235.232-496.924h-88.924q-12.628 0-21.467-8.853-8.84-8.852-8.84-21.499 0-12.646 8.84-21.646 8.839-9 21.467-9h238.461q12.628 0 21.467 8.853 8.84 8.852 8.84 21.499 0 12.646-8.84 21.646-8.839 9-21.467 9h-88.924v254.616q0 12.628-8.853 21.467-8.852 8.84-21.499 8.84-12.646 0-21.454-8.84-8.807-8.839-8.807-21.467v-254.616Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement)


                                li.appendChild(document.createElement('span')).className = 'yf-dd-item-cont';
                                li.lastChild.textContent = optionText;


                                //Decrease Icon
                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('sFont')
                                svgElement.classList.add('material-symbols-outlined')
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M609.975-454.001q-11.033 0-18.657-7.418-7.625-7.418-7.625-18.384 0-10.966 7.463-18.581t18.496-7.615h215.757q11.033 0 18.658 7.418 7.624 7.418 7.624 18.384 0 10.966-7.463 18.581t-18.495 7.615H609.975Zm-403.58 79.846-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);


                                li.lastChild.addEventListener('click', () => {
                                    var fontSizeElement = li.querySelector('#yf-font-size');
                                    var currentFontSize = fontSizeElement.textContent ? parseFloat(fontSizeElement.textContent) : 14;
                                    var fontSize = document.querySelector('#lyricContainer').style.fontSize = (currentFontSize - 1) + 'px';
                                    if (currentFontSize > 8) {
                                        console.log(fontSizeElement.textContent)
                                        console.log(fontSize)
                                        localStorage.setItem('fontSize', fontSize);
                                        if (fontSizeElement) {
                                            fontSizeElement.textContent = fontSize;
                                        }
                                    }

                                });

                                li.appendChild(document.createElement('span')).className = 'yf-fontSize';
                                li.lastChild.id = 'yf-font-size';
                                var localFontSize = localStorage.getItem('fontSize');
                                if (localFontSize)
                                    li.lastChild.textContent = localFontSize
                                else
                                    li.lastChild.textContent = '14px'


                                //Increase Icon
                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('sFont');
                                svgElement.classList.add('material-symbols-outlined');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "m206.395-374.155-40.781 106.847q-2.846 7.154-9.546 12.23-6.701 5.077-15.653 5.077-13.975 0-22.464-11.75-8.489-11.75-2.412-25.095L275.54-693.231q3.461-7.384 9.696-12.076 6.234-4.692 14.841-4.692h19.493q8.121 0 14.467 4.692t9.808 12.076l160.399 406.022q4.909 13.44-3.293 25.324-8.203 11.884-22.177 11.884-9.466 0-16.529-4.829-7.063-4.83-10.006-13.282l-39.777-106.043H206.395Zm16.681-47.844H394.77l-83.203-219.002h-4.644l-83.847 219.002Zm468.617-32.253h-82.001q-11.05 0-18.524-7.503-7.475-7.503-7.475-18.492t7.475-18.41q7.474-7.42 18.524-7.42h82.001v-81.689q0-10.984 7.418-18.609 7.418-7.624 18.384-7.624 10.966 0 18.455 7.475 7.49 7.474 7.49 18.524v82.001h82.168q11.086 0 18.585 7.478 7.498 7.479 7.498 18.534 0 11.056-7.498 18.521-7.499 7.465-18.585 7.465H743.44V-372q0 11.05-7.503 18.524-7.503 7.475-18.258 7.475-11.056 0-18.521-7.499-7.465-7.499-7.465-18.584v-82.168Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);


                                li.lastChild.addEventListener('click', () => {
                                    var fontSizeElement = li.querySelector('#yf-font-size');
                                    var currentFontSize = fontSizeElement.textContent ? parseFloat(fontSizeElement.textContent) : 14;
                                    if (currentFontSize < 24) {
                                        var fontSize = document.querySelector('#lyricContainer').style.fontSize = (currentFontSize + 1) + 'px';
                                        localStorage.setItem('fontSize', fontSize);
                                        if (fontSizeElement) {
                                            fontSizeElement.textContent = fontSize;
                                        }
                                    }
                                });
                                break;
                            }

                            case 'Report': {
                                //Report Icon
                                svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                                svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                                svgElement.setAttribute("height", "24");
                                svgElement.setAttribute("viewBox", "0 -960 960 960");
                                svgElement.setAttribute("width", "24");
                                svgElement.classList.add('yf-dd-list-icon');
                                svgElement.classList.add('material-symbols-outlined');
                                pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                pathElement.setAttribute("d", "M479.789-311.539q11.942 0 20.23-8.078t8.288-20.019q0-11.941-8.078-20.229-8.077-8.289-20.018-8.289-11.942 0-20.23 8.078t-8.288 20.019q0 11.941 8.078 20.229 8.077 8.289 20.018 8.289Zm.014-111.23q10.966 0 18.581-7.474 7.615-7.475 7.615-18.525v-189.54q0-11.05-7.418-18.524-7.418-7.475-18.384-7.475-10.966 0-18.581 7.475-7.615 7.474-7.615 18.524v189.54q0 11.05 7.418 18.525 7.418 7.474 18.384 7.474ZM376.385-164.001q-12.855 0-24.504-4.616-11.65-4.615-21.496-14.461L183.078-331.385q-8.889-9.021-13.983-21.195-5.094-12.173-5.094-24.805v-206.23q0-12.855 4.616-24.504 4.615-11.65 14.461-21.496l147.307-147.307q9.846-9.846 21.496-14.461 11.649-4.616 24.504-4.616h207.23q12.855 0 24.504 4.616 11.65 4.615 21.496 14.461l147.307 147.307q9.846 9.846 14.461 21.496 4.616 11.649 4.616 24.504v207.23q0 12.855-4.616 24.504-4.615 11.65-14.461 21.496L628.615-183.078q-9.021 8.889-21.195 13.983-12.173 5.094-24.805 5.094h-206.23ZM371-216h218l155-155v-218L588-744H371L216-589v218l155 155Zm109-264Z");
                                svgElement.appendChild(pathElement);
                                li.appendChild(svgElement);

                                const reportLinkContainer = document.createElement('div');
                                const reportLink = document.createElement('a');
                                reportLink.setAttribute("id", "report");
                                reportLink.setAttribute("class", "yf-reportLink")
                                reportLink.setAttribute("href", "mailto:uncannyrishabh@gmail.com?subject=REPORT%20%7C%20YTF&body=%3Cdescribe_issue_here%3E%0A%3Cattach_screenshot%3E");
                                reportLink.innerText = optionText;

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
                    })

                    ytc.addEventListener('mousedown', (event) => {
                        if (!yfDropdown.contains(event.target) && event.target !== menuSpan) {
                            yfDropdown.style.display = 'none';
                        }
                    });

                    header.appendChild(logoContainerDiv);
                    header.appendChild(nowPlayingDiv);
                    header.appendChild(menuSpan);
                    header.appendChild(yfDropdown);

                    container.appendChild(header);

                    progressbar.id = 'ytf-progressbar'
                    progressbar.className = "pure-material-progress-linear";
                    container.appendChild(progressbar);

                    ytc.insertBefore(container, ytc.firstChild)
                }

                var npt = container.querySelector('.now-playing-text-input')

                if (message === 'OK') { 
                    var nowPlaying = container.querySelector('.now-playing')
                    if (nowPlaying) nowPlaying.textContent = 'Now Playing -'

                    if (npt) npt.placeholder = title
                    container.setAttribute('data-uid', uid)

                    intermediateContainer = document.createElement('div')
                    intermediateContainer.id = 'intermediateContainer'
                    intermediateContainer.className = 'intermediateContainer'

					lyricContainer = document.createElement('div')
                    lyricContainer.id = 'lyricContainer'
                    lyricContainer.className = 'lyricContainer lyric sizeM'
                    lyricContainer.setAttribute('data-profanity', profanityCheck)
                    

                    var localFontSize = localStorage.getItem('fontSize');
                    if (localFontSize)
                       	lyricContainer.style.fontSize = localFontSize

					// Add blurred bubbles background
					let bubblesWrapper = container.querySelector('.bubbles-wrapper')
					if (!bubblesWrapper) {
						bubblesWrapper = document.createElement('div');
						bubblesWrapper.className = 'bubbles-wrapper';
						bubblesWrapper.innerHTML = `
							<div id="bubble-1" class="bubble"></div>
							<div id="bubble-2" class="bubble"></div>
							<div id="bubble-3" class="bubble"></div>
						`;
					}
                    
                    const pattern = fuzzyProfanityDictionary.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                    const re = new RegExp(`(${pattern})`, 'giu');

                    lyrics.forEach(l => {
                        var timestamp; 
                        if(synced && Array.isArray(l)){
                            timestamp = l[0]
                            l = l[1]
                            
                        }
                        var d = document.createElement('span');
                        d.setAttribute('data-timestamp', timestamp)
                        d.className = 'lyric-line'
                        // var replacedLine = l.replace(censorRegex, match => '*'.repeat(match.length));
                        if (lyricContainer.getAttribute('data-profanity') === 'false') {
                            var replacedLine = l.replace(re, match => {
                                if (match.length <= 1) return '*';
                                return match.charAt(0) + '*'.repeat(match.length - 1);
                            });
                            console.log('line : ',l)
                            console.log('replacedLine',replacedLine)
                            d.textContent = replacedLine;
                        }
                        else {
                            d.textContent = l;
                        }

                        lyricElements.push(d)
                        lyricContainer.appendChild(d);
                    });

                    if(synced){
                        var lyricsElem = ytc.querySelectorAll('.lyric-line')
                        attachLyricsSync(mediaElem, lyrics, lyricContainer, lyricElements);
                    }

					intermediateContainer.appendChild(bubblesWrapper)
					intermediateContainer.appendChild(lyricContainer)
                    
					// var replacement = lyricContainer.children[0].parentNode
                    if (ytc.querySelector('#notFound')) {
                        container.replaceChild(intermediateContainer, container.lastChild);
                    }
                    else {
                        if (ytc.querySelector('#notFound')) {
                            container.replaceChild(intermediateContainer, ytc.querySelector('#lyricContainer'))
                        }
                        else {
                            container.appendChild(intermediateContainer);
                        }
                    }
                }
                else if (message === 'NOK') {
                    if (npt) npt.placeholder = title
                    container.setAttribute('data-uid', uid)

                    var nowPlaying = container.querySelector('.now-playing')
                    if (nowPlaying) nowPlaying.textContent = 'Now Playing -'

                    var notFoundDiv = document.createElement('div');
                    notFoundDiv.id = 'notFound'
                    notFoundDiv.className = 'not-found'

                    var notFoundText = document.createElement('span');
                    notFoundText.className = 'not-found-text sizeM'
                    notFoundText.textContent = 'Not Found'

                    notFoundDiv.appendChild(notFoundText);
                    if (ytc.querySelector('#lyricContainer')) {
                        container.replaceChild(notFoundDiv, container.lastChild);
                    }
                    else {
                        if (ytc.querySelector('#notFound')) {
                            container.replaceChild(notFoundDiv, ytc.querySelector('#notFound'))
                        }
                        else {
                            container.appendChild(notFoundDiv);
                        }
                    }
                    detachLyricsSync(mediaElem);
                }
                else {
                    if (npt) npt.placeholder = title
                    container.removeAttribute('data-uid')

                    console.log('Removing..')
                    var ytc = document.querySelector('#secondary > #secondary-inner')
                    var c = ytc.querySelector('.yf-container')
                    var lc = ytc.querySelector('#lyricContainer')
                    if (lc) {
                        c.removeChild(c.lastChild)
                    }
                    detachLyricsSync(mediaElem);
                }

                var progressbar = container.querySelector('#ytf-progressbar')
                if (progressbar) {
                    progressbar.classList.remove("pure-material-progress-linear");
                    progressbar.classList.add("no-animate");
                }


                /**
                 * Converts a timestamp string (e.g., '03:24.56') to total seconds (float).
                 */
                function timestampToSeconds(ts) {
                    const match = ts.match(/^(\d{2}):(\d{2})\.(\d{2})$/);
                    if (!match) return 0;
                    const [, min, sec, ms] = match;
                    return parseInt(min, 10) * 60 + parseInt(sec, 10) + parseInt(ms, 10) / 100;
                }

                /**
                 * Finds the index of the lyric line whose timestamp is <= currentTime and closest to it.
                 * Assumes lyricsArr is sorted by timestamp ascending.
                 */
                function findActiveLyricIndex(lyricsArr, currentTime) {
                    let left = 0, right = lyricsArr.length - 1, result = 0;
                    while (left <= right) {
                        const mid = Math.floor((left + right) / 2);
                        const lyricTime = timestampToSeconds(lyricsArr[mid][0]);
                        if (lyricTime <= currentTime) {
                            result = mid;
                            left = mid + 1;
                        } else {
                            right = mid - 1;
                        }
                    }
                    return result;
                }

                /**
                 * Synchronizes lyrics display with media playback.
                 * Highlights and scrolls the active lyric line.
                 */
                function syncLyricsDisplay(lyricsArr, currentTime, lyricElements) {
                    const activeIdx = findActiveLyricIndex(lyricsArr, currentTime);
                    lyricElements[activeIdx]
                    lyricElements.forEach((el, idx) => {
                        if (idx === activeIdx) {
                            el.classList.add('active-lyric');
                            const parent = el.parentElement;
                            if (parent && parent.classList.contains('lyricContainer')) {
                                const parentRect = parent.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                const scrollTop = parent.scrollTop;
                                const offset = elRect.top - parentRect.top;
                                // Center the element
                                parent.scrollTo({
                                    top: scrollTop + offset - parent.clientHeight / 2 + el.clientHeight / 2,
                                    behavior: 'smooth'
                                });
                            } else {
                                // fallback
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        } else {
                            el.classList.remove('active-lyric');
                        }
                    });
                }

                /**
                 * Attaches the timeupdate event listener for lyrics sync.
                 */
                function attachLyricsSync(mediaElem, lyricsArr, lyricsContainer, lyricElements) {
                    if (!mediaElem || !lyricsArr || !lyricsContainer) return;
                    // Prevent multiple listeners
                    detachLyricsSync(mediaElem);

                    mediaElem._lyricsSyncHandler = function () {
                        syncLyricsDisplay(lyricsArr, mediaElem.currentTime, lyricElements);
                    };
                    mediaElem.addEventListener('timeupdate', mediaElem._lyricsSyncHandler);
                }

                /**
                 * Detaches the timeupdate event listener for lyrics sync.
                 */
                function detachLyricsSync(mediaElem) {
                    if (mediaElem && mediaElem._lyricsSyncHandler) {
                        mediaElem.removeEventListener('timeupdate', mediaElem._lyricsSyncHandler);
                        delete mediaElem._lyricsSyncHandler;
                    }
                }


            },
            args: [lyrics, message, uid, title, profanityCheck, synced, fuzzyProfanityDictionary]
        });

		await chrome.scripting.executeScript({
			target: { tabId },
			function: () => {
				const colors = {
					bubble1: '#7B68EE',
					bubble2: '#FF6B6B',
					bubble3: '#4ECDC4',
				};
				const bubbles = [
					document.getElementById('bubble-1'),
					document.getElementById('bubble-2'),
					document.getElementById('bubble-3')
				];
				if (!bubbles[0] || !bubbles[1] || !bubbles[2]) return;
				bubbles[0].style.backgroundColor = colors.bubble1;
				bubbles[1].style.backgroundColor = colors.bubble2;
				bubbles[2].style.backgroundColor = colors.bubble3;
				const container = document.getElementById('lyricContainer');
				class Bubble {
					constructor(element, index) {
						this.el = element;
						this.index = index;
						this.reset();
					}
					reset() {
						const bounds = container.getBoundingClientRect();
						this.baseSize = Math.random() * (Math.min(bounds.width, bounds.height) * 0.4) + (Math.min(bounds.width, bounds.height) * 0.2);
						this.el.style.width = this.baseSize + 'px';
						this.el.style.height = this.baseSize + 'px';
						this.x = Math.random() * (bounds.width - this.baseSize);
						this.y = Math.random() * (bounds.height - this.baseSize);
						this.vx = (Math.random() - 0.5) * 1.5;
						this.vy = (Math.random() - 0.5) * 1.5;
						this.angle = Math.random() * 360;
						this.sizeFluctuation = Math.random() * 0.4 + 0.1;
					}
					update() {
						const bounds = container.getBoundingClientRect();
						this.x += this.vx;
						this.y += this.vy;
						if (this.x <= 0 || this.x + this.currentSize >= bounds.width) this.vx *= -1;
						if (this.y <= 0 || this.y + this.currentSize >= bounds.height) this.vy *= -1;
						this.angle += 0.01;
						const scale = 1 + Math.sin(this.angle) * this.sizeFluctuation;
						this.currentSize = this.baseSize * scale;
						this.el.style.width = this.currentSize + 'px';
						this.el.style.height = this.currentSize + 'px';
						this.el.style.transform = 'translate(' + this.x + 'px, ' + this.y + 'px)';
					}
				}
				const bubbleObjects = bubbles.map((el, i) => new Bubble(el, i));
				function animate() {
					bubbleObjects.forEach(bubble => bubble.update());
					requestAnimationFrame(animate);
				}
				window.addEventListener('resize', () => {
					bubbleObjects.forEach(bubble => bubble.reset());
				});
				animate();
			},
			args: []
		});

    }

	/**
	 * Checks if the current tab is playing a Music
	 * @param {*} tabId 
	 * @returns 
	 */
    async function musicCheck(tabId) {
        var isMusic = await chrome.scripting.executeScript({
            target: { tabId },
            function: () => {
                let music = document.querySelector('button-view-model a')
                return (music === null) || (music === undefined) ? false : (music.textContent == 'Music')
            }
        });
        return isMusic[0].result;
    }

    async function killShort(tabId, val) {
        await chrome.scripting.executeScript({
			target: { tabId },
			function: (val) => {
				if (val) {
                    console.log("FREEMIUM : KILLSHORT" + val)
                    document.documentElement.classList.toggle("hide-youtube-shelves", true);
                }
                else {
                    console.log("FREEMIUM : KILLSHORT" + val)
                    document.documentElement.classList.toggle("hide-youtube-shelves", false);
                }
            }
            ,
            args: [val]
		});
    }

    async function findSongAndArtist(tabId) {
        return chrome.scripting.executeScript({
            target: { tabId },
            function: () => {
                //Fallback for fetching song/artist
                let val, channel = ''
                let musicCard = document.querySelectorAll('#header-container #title')

                if (musicCard && document.querySelector('.yt-video-attribute-view-model__metadata')) {
                    val = document.querySelector('.yt-video-attribute-view-model__metadata > :nth-child(1)').textContent.trim();
                    channel = document.querySelector('.yt-video-attribute-view-model__metadata > :nth-child(2)').textContent.trim();
                    
                    val = val.replace(/\b(feat|ft)\b\.?/i, '').trim();
	                channel = channel.replace(/\b(feat|ft)\b\.?/i, '').trim();

                    console.log('getSongAndArtistFromCard => Title : ' + val + ' Channel : ' + channel)
                }

                if (val == undefined || channel == undefined) {
                    val = document.querySelector('#above-the-fold > #title').textContent.trim();
                    channel = document.querySelector('#upload-info > #channel-name > div > div').textContent.trim();

                    val = val.replace(/\b(feat|ft)\b\.?/i, '').trim();
	                channel = channel.replace(/\b(feat|ft)\b\.?/i, '').trim();

                    console.log('getVideoNameAndChannel (FALLBACK) => Title : ' + val + ' Channel : ' + channel)
                }

                return JSON.stringify({ val, channel });
            }
        });
    }

    async function findLyricsfromSources(tabId, source, val, channel) {
        var result;

        switch ('LRCLIB') {
            case 'BING': {
                result = await searchBing(tabId, val, channel)
                break;
            }
            case 'A2Z': {
                result = await searchA2Z(tabId, val, channel)
                break;
            }
            case 'LRCLIB': {
                result = await searchLRCLIB(tabId, val, channel)
                break;
            }
            default: {
                result = await searchA2Z(tabId, val, channel)
                if (isEmpty(result[0].result) || JSON.parse(result[0].result).message === 'NOK') {
                    result = await searchBing(tabId, val, channel)
                }
            }
        }

        return result;
    }

    async function searchLRCLIB(tabId, name, channel) {

        if(name.includes(channel)){
            name = name.replace(channel,'')
        }
        
        var response = await (await searchLrclibdotnet(name, channel)).text()
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
    
                if(name && name != 'TrackNotFound'){
                    message = 'OK'
                    synced = resp.syncedLyrics != null
                }
                if(message == 'OK' && synced) {
                    lyrics = resp.syncedLyrics?.replaceAll('[','').split('\n').map(line => line.split(']'))
                }
                else if(message == 'OK' && !synced) {
                    lyrics = resp.plainLyrics.split('\n')
                }
    
                var r = {lyrics, message, source, synced}
                return JSON.stringify(r)
                
            },
            args: [response]
        });
    }

    async function searchBing(tabId, name, channel) {
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
            redirect: 'follow'
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
                const doc = parser.parseFromString(resp, 'text/html');
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
                        var wd = raw.replace(/<\/?div[^>]*>/g, '');
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
                var r = { lyrics, message, source, synced}
                // console.log(r)
                return JSON.stringify(r)
            },
            args: [response]
        });
    }

    async function searchA2Z(tabId, name, channel) {
        const requestOptions = {
            method: "GET",
            redirect: "follow"
        };

        if(name.includes(channel)){
            name = name.replace(channel,'')
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
                const doc = parser.parseFromString(resp, 'text/html');

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
                    var wd = raw.replace(/<\/?div[^>]*>/g, '');
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

	async function toggleProfanityFilter(tabId, bool) {
		console.log('TAB ID :: ', tabId)
		var uid = await chrome.scripting.executeScript({
			target: { tabId },
			function: () => {
				var container = document.querySelector('#yf-container')
				return container.getAttribute('data-uid')
			}
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

			await chrome.scripting.executeScript({
				target: { tabId },
				function: (bool, lyrics, fuzzyProfanityDictionary) => {
					var container = document.querySelector('#intermediateContainer')
					var lyricContainer = container.querySelector('#lyricContainer')

					console.log('PROFANITY CHECKPOINT !!', bool)

					container.removeChild(container.lastChild)

					lyricContainer = document.createElement('div')
					lyricContainer.id = 'lyricContainer'
					lyricContainer.className = 'lyricContainer lyric sizeM'

					var localFontSize = localStorage.getItem('fontSize');
					if (localFontSize)
						lyricContainer.style.fontSize = localFontSize

					if (bool) {
						lyricContainer.setAttribute('data-profanity', 'true')

						lyrics.forEach(l => {
							var d = document.createElement('span');
							d.textContent = l;
							lyricContainer.appendChild(d);
						});
					}
					else {
						lyricContainer.setAttribute('data-profanity', 'false')

						// const censorRegex = new RegExp('\\b(?:' + fuzzyProfanityDictionary.join('|') + ')\\b', 'gi');
                        const pattern = fuzzyProfanityDictionary.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                        const re = new RegExp(`(${pattern})`, 'giu');

                        lyrics.forEach(l => {
                            var d = document.createElement('span');
                            var replacedLine = l.replace(re, match => {
                                if (match.length <= 1) return '*';
                                return match.charAt(0) + '*'.repeat(match.length - 1);
                            });
                            d.textContent = replacedLine;
                            lyricContainer.appendChild(d);
						});

					}
					container.appendChild(lyricContainer)
				},
				args: [bool, lyrics, fuzzyProfanityDictionary]
			})
		}

	}

    function removeView(tabId) {
        chrome.scripting.executeScript({
            target: { tabId },
            function: () => {
                console.log('Removing..')
                var ytc = document.querySelector('#secondary > #secondary-inner')
                var c = ytc.querySelector('.yf-container')
                var lc = ytc.querySelector('#lyricContainer')
                if (lc) {
                    c.removeChild(c.lastChild)
                }
            },
            args: []
        });
    }

})();

(() => {
	var tabTitle = undefined
	var reqUrl = ''
	var complete = false
	var process = false
	var navigation = false
	var tabList = []

	chrome.runtime.onInstalled.addListener(function (details) {
		var bool
		if (details.reason == "install") {
			console.log("I installed a goated extension")
			bool = true
		} else if (details.reason == "update") {
			console.log("Goated extension just updated")
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

	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tabInfo) {
		// console.log(changeInfo)
		// console.log(tabInfo)

		// Search   => 1) Local Storage via uid
		//if title and channel available and not stored in local || not matching tabTitle?  
		//			   2) search again
		//else 
		//			   2) display existing

		if (tabInfo.url.includes("youtube.com/watch")) {
			if (changeInfo.status && changeInfo.status === 'loading') {
				complete = false
				navigation = false
			}
			if (changeInfo.status && changeInfo.status === 'complete') {
				if (navigation) {
					navigation = false
					tabTitle = tabInfo.title
					console.log('CALL !!! MAIN FROM onUPDATE : forward_back')
					main(tabInfo.title, tabInfo.url, tabId);
				}
			}
			if (changeInfo.title) {
				tabTitle = tabInfo.title
				console.log('CALL !!! MAIN FROM onUPDATE')
				main(tabInfo.title, tabInfo.url, tabId);
			}
		}

	});

	chrome.webNavigation.onHistoryStateUpdated.addListener(function (details) {
		// console.log("transitionQualifier: " + details.transitionQualifiers, details);
		if (details.url && details.url.includes("youtube.com/watch")) {
			chrome.tabs.get(details.tabId, function (tab) {
				// console.log(tab)
				if (tab.title != 'Youtube') tabTitle = tab.title;
			});
			if (details.frameId === 0 && process != true) {
				complete = true;
				// console.log("Tab Title: " + tabTitle + ' CALL !!! MAIN FROM onHistoryStateUpdated')
				// main(tabTitle, details.url, details.tabId);
			}
			if (details.transitionQualifiers.includes('forward_back')) {
				navigation = true
			}
		}
	});

	chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
		// console.log(removeInfo)
		if (tabList.includes(tabId)) {
			tabList = tabList.filter(item => item !== tabId);
			console.log('Detached.. ' + tabId + ' from  :' + tabList)
		}

	});

	chrome.runtime.onMessage.addListener(
		function (obj, sender, sendResponse) {
			const { type, val } = obj;

			switch (type) {
				case 'PROFANITY_TOGGLE': {
					tabList.forEach(async (tabId) => {
						toggleProfanityFilter(tabId, JSON.parse(val))
					})
					break;
				}
			}
		}
	);

	function main(title, url, tabId) {
		process = true
		console.log('Detected : ' + title);
		reqUrl = url;
		if (!tabList.includes(tabId)) {
			tabList.push(tabId);
			console.log('Added.. ' + tabId + ' from  :' + tabList);
		}

		if (tabList.includes(tabId) && title && title.split(' ').length > 1) {
			chrome.tabs.sendMessage(tabId, {
				type: "NEW_SEARCH",
				'val': getVideoID(reqUrl)
			}, (response) => {
				if (chrome.runtime.lastError) {
					console.log('Error getting');
				}
				if (response) {
					if (response.name && response.channel) {
						console.log(response);
					}
				}
				runInContext(tabId, getTitleFromTabTitle(tabTitle));
			});
		}
	}

	const runInContext = async (tabId, tabTitle) => {
		// console.log('runInContext Called : ' + tabTitle)

		var uid = getVideoID(reqUrl);
		var obj = await getFromStorage(uid);
		let isMusic = await musicCheck(tabId);
		let result = await findSongAndArtist(tabId);
		let { val, channel } = JSON.parse(result[0]?.result);

		console.log("CHECKPOINT " + val + ' - ' + channel + ' - ' + isMusic);
		console.log(obj)
		let lyrics, message, title = ''

		if (isMusic) {
			if ((!isEmpty(obj) && obj[uid]?.title && obj[uid]?.title != val) || (isEmpty(obj) && val)) {
				let result = await findLyricsfromSources(tabId, "", val, channel)

				let resultObject = JSON.parse(result[0]?.result);
				console.log('search result : ', resultObject)
				if (resultObject === undefined || resultObject === null || resultObject.message === 'NOK') {
					message = 'NOK'
				}
				else {
					lyrics = resultObject.lyrics ? resultObject.lyrics : '';
					message = resultObject.message ? resultObject.message : '';
				}
				var scroll = 0
				var timestamp = Date.now()
				title = val

				if (message === 'OK' && lyrics && lyrics.length > 0) {
					saveObject(uid, { lyrics, message, tabId, scroll, timestamp, title })
				}
				else if (message === 'NOK') {

				}
			}
			else if (!isEmpty(obj)) {
				lyrics = obj[uid]?.lyrics
				message = obj[uid]?.message
				title = obj[uid]?.title
			}
		}
		else {
			lyrics = obj[uid]?.lyrics
			message = obj[uid]?.message
			title = obj[uid]?.title
		}


		var prefs = await getFromStorage('yt-userPrefs')
		var profanityCheck = prefs['yt-userPrefs']?.profanity;
		console.log("Profanity : ", profanityCheck)
		if (!profanityCheck || profanityCheck == undefined) {
			profanityCheck = false
		}

		lyrics = lyrics ? lyrics : ""
		message = message ? message : "NOK"
		title = title ? title : val

		chrome.scripting.executeScript({
			target: { tabId },
			function: (lyrics, message, uid, title, profanityCheck) => {
				var ytc = document.querySelector(window.innerWidth < 1000 ? '#primary > #primary-inner > #below' : '#secondary > #secondary-inner');
				var container = ytc.querySelector('.yf-container')
				var lyricContainer = ytc.querySelector('#lyricContainer')

				if (container) {
					if (lyricContainer) {
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

					// var spaceElement = document.createElement("span");
					// spaceElement.innerHTML = "&nbsp;";

					// var tooltip = document.createElement("span");
					// tooltip.className = "tooltiptext";
					// tooltip.textContent = title;

					var nowPlayingText = document.createElement("input");
					nowPlayingText.setAttribute("autocomplete", "off");
					nowPlayingText.id = "now-playing-text-input";
					nowPlayingText.className = "now-playing-text-input";
					nowPlayingText.textContent = title;
					nowPlayingText.disabled = "disabled"; //REMOVEME
					// nowPlayingText.appendChild(tooltip);

					// var searchIcon = document.createElement("span");
					// searchIcon.id = 'yf-search'
					// searchIcon.className = 'material-symbols-rounded yf-search'
					// searchIcon.textContent = 'search'

					// searchIcon.addEventListener('click', () => {
					// 	var input =  document.querySelector('#now-playing-text-input')
					// 	var text = input?.value.trim();
					// 	// validateAndSearch(text)
					// 	var obj = {
					// 		'type' : 'NEW_SEARCH',
					// 		'val' : [text]
					// 	}
					// 	chrome.runtime.sendMessage(obj, async (response) => {
					// 		if (chrome.runtime.lastError)
					// 			console.log('Error getting');
					// 		if (response) console.log(response)
					// 	});
					// })

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

					// yfDropdown.addEventListener('click', (event) => {
					// 	var listItem = event.target.closest('.yf-dd-list');
					// 	if (listItem) {
					// 		var optionText = listItem.querySelector('.yf-dd-item-cont').textContent;
					// 		console.log('Clicked on:', optionText);
					// 	}
					//how to
					// });

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

					lyricContainer = document.createElement('div')
					lyricContainer.id = 'lyricContainer'
					lyricContainer.className = 'lyricContainer lyric sizeM'

					if (profanityCheck) {
						lyricContainer.setAttribute('data-profanity', profanityCheck)
					}
					else {
						lyricContainer.setAttribute('data-profanity', 'false')
					}

					var localFontSize = localStorage.getItem('fontSize');
					if (localFontSize)
						lyricContainer.style.fontSize = localFontSize

					const fuzzyMatch = ['ass', 'bitch', 'bullshit', 'cunt', 'cock', 'dick', 'faggot', 'fuck', 'hoe', 'nigga', 'nigger', 'motherfuck', 'pussy', 'slut', 'shit', 'tit', 'whore', 'wanker']
					// const exactMatch = ['ass']
					const censorRegex = new RegExp('\\b(?:' + fuzzyMatch.join('|') + ')\\b', 'gi');

					lyrics.forEach(l => {
						var d = document.createElement('span');
						// var replacedLine = l.replace(censorRegex, match => '*'.repeat(match.length));
						if (lyricContainer.getAttribute('data-profanity') === 'true') {
							var replacedLine = l.replace(censorRegex, match => match[0] + '*'.repeat(match.length - 1));
							d.textContent = replacedLine;
						}
						else {
							d.textContent = l;
						}

						lyricContainer.appendChild(d);
					});

					// var replacement = lyricContainer.children[0].parentNode
					if (ytc.querySelector('#notFound')) {
						container.replaceChild(lyricContainer, container.lastChild);
					}
					else {
						if (ytc.querySelector('#notFound')) {
							container.replaceChild(lyricContainer, ytc.querySelector('#lyricContainer'))
						}
						else {
							container.appendChild(lyricContainer);
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
				}

				var progressbar = container.querySelector('#ytf-progressbar')
				if (progressbar) progressbar.style.visibility = 'hidden'

			},
			args: [lyrics, message, uid, title, profanityCheck]
		});

	}

	async function musicCheck(tabId) {
		var isMusic = await chrome.scripting.executeScript({
			target: { tabId },
			function: () => {
				let music = document.querySelector('button-view-model a')
				return (music === null) || (music === undefined) ? false : (music.textContent == 'Music')
			}
		});
		return Boolean(isMusic)
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
					console.log('getSongAndArtistFromCard => Title : ' + val + ' Channel : ' + channel)
				}

				if (val == undefined || channel == undefined) {
					val = document.querySelector('#above-the-fold > #title').textContent.trim();
					channel = document.querySelector('#upload-info > #channel-name > div > div').textContent.trim();
					console.log('getVideoNameAndChannel (FALLBACK) => Title : ' + val + ' Channel : ' + channel)
				}

				return JSON.stringify({ val, channel });
			}
		});
	}

	async function findLyricsfromSources(tabId, source, val, channel) {
		var result;

		switch (source) {
			case 'BING': {
				result = await searchBing(tabId, val, channel)
				break;
			}
			case 'A2Z': {
				result = await searchA2Z(tabId, val, channel)
				break;
			}
			default: {
				result = await searchBing(tabId, val, channel)
				if (isEmpty(result) || JSON.parse(result[0].result).message === 'NOK') {
					result = await searchA2Z(tabId, val, channel)
				}
			}
		}

		return result;
	}

	async function searchBing(tabId, name, channel) {
		var myHeaders = {
			"authority": "www.bing.com",
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en-IN;q=0.9,en;q=0.8",
			"dnt": "1",
			"sec-ch-ua": "\"Google Chrome\";v=\"119\", \"Chromium\";v=\"119\", \"Not?A_Brand\";v=\"24\"",
			"sec-ch-ua-full-version": "\"119.0.6045.123\"",
			"sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"119.0.6045.123\", \"Chromium\";v=\"119.0.6045.123\", \"Not?A_Brand\";v=\"24.0.0.0\"",
			"sec-ch-ua-mobile": "?1",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "same-origin",
			"sec-fetch-user": "?1",
			"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
		}

		var requestOptions = {
			method: 'GET',
			headers: myHeaders,
			redirect: 'follow'
		};

		var mq = queryBuilder(name, channel)
		var url = `https://www.bing.com/search?q=${mq}`
		console.log('searching : ', url)
		var response = await (await fetch(url, requestOptions)).text();

		//Handle not found
		return await chrome.scripting.executeScript({
			target: { tabId },
			function: (resp) => {
				// console.log(resp)
				var lyrics = []
				var message = ''
				const parser = new DOMParser();
				const doc = parser.parseFromString(resp, 'text/html');
				// const lContainer = doc.querySelector('#kp-wp-tab-default_tab\\:kc\\:\\/music\\/recording_cluster\\:lyrics > div > div')
				var lContainer = doc.querySelectorAll('.lyric_body .verse')
				const b_TopTitle = doc.querySelector('.b_topTitle')

				//Alternate container
				if (b_TopTitle && b_TopTitle.textContent === "Lyrics") {
					lContainer = doc.querySelector('.l_tac_facts')
				}

				if (lContainer) {
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
				var r = { lyrics, message }
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

		var url = `https://www.azlyrics.com/lyrics/${channel.replaceAll(" ", "").toLowerCase()}/${name.replaceAll(" ", "").toLowerCase()}.html`
		var response = await fetch(encodeURI(url), requestOptions)
		var page = await response.text()

		return await chrome.scripting.executeScript({
			target: { tabId },
			function: (resp) => {
				// console.log(resp)
				var lyrics = []
				var message = ''
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
				var r = { lyrics, message }
				// console.log(r)
				return JSON.stringify(r)
			},
			args: [page]
		});
	}

	async function toggleProfanityFilter(tabId, bool) {
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
			saveObject('', profanity)

			if (isEmpty(lyricsObj)) {
				return
			}

			var lyrics = lyricsObj[uid[0]?.result]?.lyrics

			await chrome.scripting.executeScript({
				target: { tabId },
				function: (bool, lyrics) => {
					var container = document.querySelector('#yf-container')
					var lyricContainer = container.querySelector('#lyricContainer')

					console.log('PROFANITY CHECKPOINT !!')

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

						const fuzzyMatch = ['ass', 'bitch', 'bullshit', 'cunt', 'cock', 'dick', 'faggot', 'fuck', 'hoe', 'nigga', 'nigger', 'motherfuck', 'pussy', 'slut', 'shit', 'tit', 'whore', 'wanker']
						// const exactMatch = ['ass']
						const censorRegex = new RegExp('\\b(?:' + fuzzyMatch.join('|') + ')\\b', 'gi');

						lyrics.forEach(l => {
							var d = document.createElement('span');
							// var replacedLine = l.replace(censorRegex, match => '*'.repeat(match.length));
							var replacedLine = l.replace(censorRegex, match => match[0] + '*'.repeat(match.length - 1));
							d.textContent = replacedLine;
							lyricContainer.appendChild(d);
						});

					}
					container.appendChild(lyricContainer)
				},
				args: [bool, lyrics]
			})
		}

	}

	const isEmpty = obj => Object.keys(obj).length === 0;

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

	function saveObject(uid, obj) {
		var v
		if (uid === '') {
			v = obj
		}
		else {
			v = { [uid]: obj }
		}
		console.log(v)
		chrome.storage.local.set(v, () => {
			if (chrome.runtime.lastError)
				reject(chrome.runtime.lastError);

			// console.log(eldoLog('I') + "Stored worker status : " + status);
		});
	}

	function getFromStorage(uid) {
		return new Promise((resolve) => {
			chrome.storage.local.get(uid, (result) => {
				if (chrome.runtime.lastError)
					console.error('Error getting');
				resolve(result ? result : {});
			});
		});
	}

	function getVideoID(url) {
		try {
			const urlObject = new URL(url);
			const searchParams = new URLSearchParams(urlObject.search);
			return searchParams.get('v');
		}
		catch (e) {
			return ''
		}
		// 	"authority": "www.google.com",
	}

	function queryBuilder(q, n) {
		try {
			q = q.trim();
			q = q.replace(/\[[^\]]*\]/g, ''); // remove [contents]
			q = q.replace(/\([^)]*\)/g, ''); // remove (contents)
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

	async function searchGoogle(name, channel) {
		var myHeaders = {
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"accept-language": "en-US,en;q=0.9",
			"cache-control": "max-age=0",
			"dnt": "1",
			"referer": "https://www.google.com/",
			"sec-fetch-dest": "document",
			"sec-fetch-mode": "navigate",
			"sec-fetch-site": "same-origin",
			"sec-fetch-user": "?1",
			"upgrade-insecure-requests": "1",
			//rotation / dynamic
			"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
		}

		var requestOptions = {
			method: 'GET',
			headers: myHeaders,
			redirect: 'follow'
		};

		var mq = queryBuilder(name, channel)
		var url = `https://www.google.com/search?q=${mq}`
		console.log('searching : ', url)
		var response = fetch(url, requestOptions)
		return response;
	}

	function getTitleFromTabTitle(tabTitle) {
		tabTitle = tabTitle.split('-')[0]
		tabTitle = tabTitle.replace(/\([^)]*\)/g, '')
		tabTitle = tabTitle.trim().replace('YouTube', '')
		return tabTitle
	}


})();

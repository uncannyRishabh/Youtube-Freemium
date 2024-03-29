(() => {
	var tabTitle = undefined
	var reqUrl = ''
	var complete = false
	var process = false
	var navigation = false
	//storage api
	var currTabId = ''
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

		let lyrics, message, title = ''
		var uid = getVideoID(reqUrl)
		var obj = await getFromStorage(uid)
		console.log(obj)

		let result = await chrome.scripting.executeScript({
			target: { tabId },
			function: () => {
				let val = document.querySelector('#above-the-fold > #title').textContent.trim();
				let channel = document.querySelector('#upload-info > #channel-name > div > div').textContent.trim();
				console.log('Title : ' + val + ' Channel : ' + channel)
				return JSON.stringify({ val, channel });
			}
		});

		let val, channel;

		if (result[0]?.result) {
			({ val, channel } = JSON.parse(result[0]?.result));
			console.log("CHECKPOINT " + val + ' - ' + channel);
		} else {
			console.log("result is undefined");
		}

		if ((!isEmpty(obj) && obj[uid]?.title && obj[uid]?.title != val) || (isEmpty(obj) && val)) {
			var resp = await (await getLyrics(val, channel)).text();

			result = await chrome.scripting.executeScript({
				target: { tabId },
				function: (resp) => {
					// console.log(resp)
					var lyrics = []
					var message = ''
					const parser = new DOMParser();
					const doc = parser.parseFromString(resp, 'text/html');
					// const lContainer = doc.querySelector('#kp-wp-tab-default_tab\\:kc\\:\\/music\\/recording_cluster\\:lyrics > div > div')
					var lContainer = doc.querySelector('#lyric_body > .lyrics')
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

						var raw = lContainer.innerHTML
						var wd = raw.replace(/<\/?div[^>]*>/g, '');
						lyrics = wd.split('<br>').map(line => line.trim()).filter(Boolean);

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
				args: [resp]
			});

			let resultObject = JSON.parse(result[0]?.result);
			console.log('search result : ', resultObject)
			if (resultObject.lyrics === null) {
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

		var prefs = await getFromStorage('yt-userPrefs')
		var profanityCheck = prefs['yt-userPrefs']?.profanity;
		console.log(profanityCheck)
		if(!profanityCheck || profanityCheck == undefined){
			profanityCheck = false
		}

		chrome.scripting.executeScript({
			target: { tabId },
			function: (lyrics, message, uid, title, profanityCheck) => {
				var ytc = document.querySelector('#secondary > #secondary-inner')
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
					var linkElement1 = document.createElement('link');
					linkElement1.rel = 'stylesheet';
					linkElement1.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0';
					document.head.appendChild(linkElement1);

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
								li.appendChild(document.createElement('span')).className = 'material-symbols-rounded yf-dd-list-icon';
								li.firstChild.textContent = 'format_size';

								li.appendChild(document.createElement('span')).className = 'yf-dd-item-cont';
								li.lastChild.textContent = optionText;

								li.appendChild(document.createElement('span')).className = 'material-symbols-rounded sFont';
								li.lastChild.textContent = 'text_decrease';

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

								li.appendChild(document.createElement('span')).className = 'material-symbols-rounded sFont';
								li.lastChild.textContent = 'text_increase';

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
								li.appendChild(document.createElement('span')).className = 'material-symbols-rounded yf-dd-list-icon';
								li.firstChild.textContent = 'report'
								li.appendChild(document.createElement('div')).className = 'yf-dd-item-cont';
								li.lastChild.textContent = optionText;
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

			if (q.split(' ').length < 2 || (q.length < 4 && !q.includes('-'))) {
				if (!q.includes(n))
					q += ' ' + n
			}
			//TODO:Append verified creator channel name only if one letter title
			return q + " lyrics"
			// return encodeURIComponent(q + "+lyrics")
		}
		catch (e) {
			console.log(e)
			return "(404) lyrics"
		}
	}

	async function getLyrics(name, channel) {
		// var myHeaders = {
		// 	"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
		// 	"accept-language": "en-US,en;q=0.9",
		// 	"cache-control": "max-age=0",
		// 	"dnt": "1",
		// 	"referer": "https://www.google.com/",
		// 	"sec-fetch-dest": "document",
		// 	"sec-fetch-mode": "navigate",
		// 	"sec-fetch-site": "same-origin",
		// 	"sec-fetch-user": "?1",
		// 	"upgrade-insecure-requests": "1",
		// 	//rotation / dynamic
		// 	"user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
		// }

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
		// var url = `https://www.google.com/search?q=${mq}`
		var url = `https://www.bing.com/search?q=${mq}`
		console.log('searching : ', mq)
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

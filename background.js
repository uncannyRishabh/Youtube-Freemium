(() => {
	var reqUrl = ''
	var ready = false
	//storage api
	var tabList = []

	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tabInfo) {
		// console.log(changeInfo)
		// console.log(tabInfo)

		// Reload   => loading , faviconUrl , title , title , title , complete , title
		// Navigate => loading , complete , faviconUrl , title , 
		// Search   => 1) Local Storage via uid
		//if title and channel available and not stored in local || not matching tabTitle?  
		//			   2) search again
		//else 
		//			   2) display existing
		//			   2) 
		//			   2) 

		if(changeInfo.status && changeInfo.status === 'complete' && tabInfo.url.includes("youtube.com/watch")){
			ready = true

		}

		if(changeInfo.title && ready){
			ready = false
			console.log('Detected : ' + tabInfo.title)
			reqUrl = tabInfo.url
			if (!tabList.includes(tabId)) {
				tabList.push(tabId)
				console.log('Added.. ' + tabId + ' from  :' + tabList)
			}
	
			if (tabList.includes(tabId) && tabInfo.title.split(' ').length > 1) {
				chrome.tabs.sendMessage(tabId, {
					type: "NEW_SEARCH",
					'uid': getVideoID(reqUrl)
				}, (response) => {
					if (chrome.runtime.lastError) {
						console.log('Error getting');
					}
					if (response) {
						if (response.name && response.channel) {
							console.log(response)
						}
					}
					runInContext(tabId)
				});
			}
		}


	});

	chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
		console.log(removeInfo)
		if (tabList.includes(tabId)) {
			tabList = tabList.filter(item => item !== tabId);
			console.log('Detached.. ' + tabId + ' from  :' + tabList)
		}

	});

	const runInContext = async (tabId) => {
		//check for tabId 
		console.log('runInContext Called')

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
			console.log(val, channel);
		} else {
			console.log("result is undefined");
		}

		// Now you can use val and channel outside the if scope
		console.log(val, channel);


		var uid = getVideoID(reqUrl)
		var obj = await getFromStorage(uid)
		console.log(obj)
		let lyrics, message, title
		const isEmpty = obj => Object.keys(obj).length === 0;

		if (isEmpty(obj) || obj[uid]?.title && obj[uid]?.title != val) {
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
					const lContainer = doc.querySelector('#lyric_body > .lyrics')
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
			lyrics = resultObject.lyrics;
			message = resultObject.message;
			var scroll = 0
			var timestamp = Date.now()
			title = val

			if (message === 'OK' && lyrics && lyrics.length > 0) {
				saveObject(uid, { lyrics, message, tabId, scroll, timestamp, title })
			}
		}
		else {
			lyrics = obj[uid]?.lyrics
			message = obj[uid]?.message
			title = obj[uid]?.title
		}

		chrome.scripting.executeScript({
			target: { tabId },
			function: (lyrics, message, uid, title) => {
				var ytc = document.querySelector('#secondary > #secondary-inner')
				var container = ytc.querySelector('.yf-container')
				var lyricContainer = ytc.querySelector('#lyricContainer')

				if (container) {
					if (lyricContainer) {
						container.removeChild(container.lastChild)
					}
				} else {
					var header = document.createElement('div')
					var progressbar = document.createElement("progress");
					container = document.createElement('div')

					header.id = 'header'
					header.className = 'yf-header'

					container.id = 'yf-contaier'
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
					nowPlayingSpan.className = "now-playing";
					nowPlayingSpan.textContent = "Now Playing -";

					var spaceElement = document.createElement("span");
					spaceElement.innerHTML = "&nbsp;";

					var tooltip = document.createElement("span");
					tooltip.className = "tooltiptext";
					tooltip.textContent = title;

					var nowPlayingText = document.createElement("div");
					nowPlayingText.className = "now-playing now-playing-text tooltip";
					nowPlayingText.textContent = title;

					nowPlayingText.appendChild(tooltip);

					nowPlayingDiv.appendChild(nowPlayingSpan);
					nowPlayingDiv.appendChild(spaceElement);
					nowPlayingDiv.appendChild(nowPlayingText);

					var menuSpan = document.createElement("span");
					menuSpan.className = "yf-menu";
					menuSpan.textContent = "...";

					menuSpan.addEventListener('onClick', () => {

					})

					header.appendChild(logoContainerDiv);
					header.appendChild(nowPlayingDiv);
					header.appendChild(menuSpan);

					container.appendChild(header);

					progressbar.id = 'ytf-progressbar'
					progressbar.className = "pure-material-progress-linear";
					container.appendChild(progressbar);

					ytc.insertBefore(container, ytc.firstChild)
				}

				var npt = container.querySelector('.now-playing.now-playing-text')

				if (message === 'OK') {
					if (npt) npt.textContent = title
					container.setAttribute('data-uid', uid)

					lyricContainer = document.createElement('div')
					lyricContainer.id = 'lyricContainer'
					lyricContainer.className = 'lyricContainer lyric sizeM'

					lyrics.forEach(l => {
						var d = document.createElement('span');
						// d.className = 'lyric sizeM'
						d.textContent = l
						lyricContainer.appendChild(d)
					})

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
					if (npt) npt.textContent = title
					container.setAttribute('data-uid', uid)

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
					if (npt) npt.textContent = title
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
			args: [lyrics, message, uid, title]
		});


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

	function saveObject(uid, obj) {
		var v = { [uid]: obj }
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
	}

	function queryMaker(q, n) {
		q = q.trim();
		q = q.replace(/\[[^\]]*\]/g, ''); // remove [contents]
		q = q.replace(/\([^)]*\)/g, ''); // remove (contents)
		q = q.replace(/\s+/g, ' '); // replace multiple spaces with a single space
		q = q.replace(/[\t\n]/g, ' '); // replace tabs and newlines with spaces
		// q = q?.replace(/[\s\t\n]/g, '+') //+

		if (q.split(' ').length < 2 || (q.length < 4 && !q.contins('-'))) {
			q += ' ' + n
		}
		//TODO:Append verified creator channel name only if one letter title
		return q + " lyrics"
		// return encodeURIComponent(q + "+lyrics")
	}

	async function getLyrics(name, channel) {
		// var myHeaders = {
		// 	"authority": "www.google.com",
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

		var mq = queryMaker(name, channel)
		// var url = `https://www.google.com/search?q=${mq}`
		var url = `https://www.bing.com/search?q=${mq}`
		console.log('searching : ', mq)
		var response = fetch(url, requestOptions)
		return response;
	}


})();

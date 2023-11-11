(() => {
	var reqUrl = ''
	var shouldSendCb = false
	//storage api
	var tabs = []

	chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
		// console.log(changeInfo)

		if (changeInfo.url) {
			if (changeInfo.url.includes("youtube.com/watch")) {
				shouldSendCb = true
				reqUrl = changeInfo.url
				if (!tabs.includes(tabId)) {
					tabs.push(tabId)
					console.log('Added.. ' + tabId + ' from  :' + tabs)
				}
			}
			else if (tabs.includes(tabId)) {
				tabs = tabs.filter(item => item !== tabId);
				console.log('Navigated.. ' + tabId + ' from  :' + tabs)
			}
		}

		if (tabs.includes(tabId) && shouldSendCb && changeInfo.title) {
			if (changeInfo.title.split(' ').length > 1) {
				shouldSendCb = false
				console.log('COMPLETE.......')
				chrome.tabs.sendMessage(tabId, {
					type: "NEW_SEARCH",
				}, (response) => {
					if (chrome.runtime.lastError)
						console.log('Error getting');
					if (response) {
						if (response.name && response.channel) {
							console.log(response)
							runInContext(tabId, reqUrl)
						}
					}
				});
			}
		}

	});

	chrome.tabs.onDetached.addListener(function (tabId, changeInfo) {
		if (tabs.includes(tabId)) {
			tabs = tabs.filter(item => item !== tabId);
			console.log('Detached.. ' + tabId + ' from  :' + tabs)
		}

	});

	const runInContext = async (tabId, updatedURL) => {
		//check for tabId 
		console.log('runInContext Called')

		let result = await chrome.scripting.executeScript({
			target: { tabId },
			function: () => {
				let val = document.querySelector('#above-the-fold > #title').textContent.trim();
				let channel = document.querySelector('#upload-info > #channel-name > div > div').textContent.trim();
				return JSON.stringify({ val, channel });
			}
		});

		let { val, channel } = JSON.parse(result[0]?.result)
		console.log(val, channel);
		var resp = await (await getLyrics(val, channel)).text();

		result = await chrome.scripting.executeScript({
			target: { tabId },
			function: (resp) => {
				// console.log(resp)
				const parser = new DOMParser();
				const doc = parser.parseFromString(resp, 'text/html');
				const lContainer = doc.querySelector('#kp-wp-tab-default_tab\\:kc\\:\\/music\\/recording_cluster\\:lyrics > div > div')

				var message = 'OK'
				var lyrics = []
				if (lContainer) {
					message = 'OK'
					lContainer.querySelectorAll('span').forEach(span => {
						lyrics.push(span.textContent.trim());
					});
					console.log(lyrics);
				}
				else {
					message = 'NOK'
				}

				//VALIDATE HERE
				var r = { lyrics, message }
				console.log(r)
				return JSON.stringify(r)
			},
			args: [resp]
		});

		let { lyrics, message } = JSON.parse(result[0]?.result)
		var uid = getVideoID(reqUrl)

		var scroll = 0
		var timestamp = Date.now()
		var title = val
		if (lyrics && message === 'OK') {
			saveObject(uid, { lyrics, message, tabId, scroll, timestamp, title })

			chrome.scripting.executeScript({
				target: { tabId },
				function: (lyrics) => {
					var lcc = document.querySelector('#secondary > #secondary-inner')
					var lyricContainer = document.createElement('div')

					lyricContainer.id = 'lyricContainer'
					lyricContainer.className = 'lyricContainer'

					lyrics.forEach(l => {
						var d = document.createElement('span');
						d.className = 'lyric sizeM'
						d.textContent = l
						lyricContainer.appendChild(d)
					})

					var lc = document.querySelector('#lyricContainer')
					if (lc) {
						lcc.removeChild(lcc.firstChild)
					}
					lcc.insertBefore(lyricContainer, lcc.firstChild);

				},
				args: [lyrics]
			});

		}
		else {
			// var lc = document.querySelector('#lyricContainer')
			// if (lc) {
			// 	lcc.removeChild(lcc.firstChild)
			// }
		}
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
		// q = q?.replace(/[\s\t\n]/g, '+') //newline tabs spaces

		if (q.split(' ').length < 2) {
			q += ' ' + n
		}
		//TODO:Append verified creator channel name only if one letter title
		return q + " lyrics"
	}

	async function getLyrics(name, channel) {
		var myHeaders = {
			"authority": "www.google.com",
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

		var mq = queryMaker(name, channel)
		var url = `https://www.google.com/search?q=${mq}`
		console.log('searching : ', mq)
		var response = fetch(url, requestOptions)
		return response;
	}


})();

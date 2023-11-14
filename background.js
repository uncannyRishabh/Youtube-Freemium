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
					'uid':getVideoID(reqUrl)
				}, (response) => {
					if (chrome.runtime.lastError) {
						console.log('Error getting');
						removeView(tabId)
					}
					if (response) {
						if (response.name && response.channel) {
							console.log(response)
							runInContext(tabId)
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

	const runInContext = async (tabId) => {
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
				// const lContainer = doc.querySelector('#kp-wp-tab-default_tab\\:kc\\:\\/music\\/recording_cluster\\:lyrics > div > div')
				const lContainer = doc.querySelector('#lyric_body > .lyrics')

				var message = 'OK'
				var lyrics = []
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

		let { lyrics, message } = JSON.parse(result[0]?.result)
		var uid = getVideoID(reqUrl)

		var scroll = 0
		var timestamp = Date.now()
		var title = val
		if (lyrics && message === 'OK') {
			saveObject(uid, { lyrics, message, tabId, scroll, timestamp, title })

			chrome.scripting.executeScript({
				target: { tabId },
				function: (lyrics, uid) => {
					var ytc = document.querySelector('#secondary > #secondary-inner')
					var container = ytc.querySelector('.yf-container')
					var lyricContainer = ytc.querySelector('#lyricContainer')

					if (container && lyricContainer) {
						container.removeChild(container.lastChild)
						
					} else {
						var header = document.createElement('div')
						container = document.createElement('div')

						header.id = 'header'
						header.className = 'header'

						container.id = 'yf-contaier'
						container.className = 'yf-container'

						container.appendChild(header);
						ytc.insertBefore(container, ytc.firstChild)
					}

					lyricContainer = document.createElement('div')

					lyricContainer.id = 'lyricContainer'
					lyricContainer.className = 'lyricContainer'
					lyricContainer.setAttribute('data-uid', uid)

					lyrics.forEach(l => {
						var d = document.createElement('span');
						d.className = 'lyric sizeM'
						d.textContent = l
						lyricContainer.appendChild(d)
					})

					container.appendChild(lyricContainer);
				},
				args: [lyrics, uid]
			});

		}
		else {
			removeView(tabId)
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

	function saveObject(uid, obj) {
		var v = { [uid]: obj }
		console.log(v)
		chrome.storage.local.set(v, () => {
			if (chrome.runtime.lastError)
				reject(chrome.runtime.lastError);

			// console.log(eldoLog('I') + "Stored worker status : " + status);
		});
	}

	function getObject(uid) {
		return new Promise((resolve) => {
			chrome.storage.local.get(uid, (result) => {
				if (chrome.runtime.lastError)
					console.error('Error getting');
				resolve(result ? result : []);
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

		if (q.split(' ').length < 2) {
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

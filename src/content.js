var player, lyricContainer, moveRequired, insidePrimary, observer
var primaryInner, secondaryInner

(async () => {
	console.log('Script Injected')
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

	moveRequired = document.querySelector(window.innerWidth < 1000
		? 'ytd-watch-flexy #primary > #primary-inner'
		: 'ytd-watch-flexy #secondary') == null;

	// player = document.querySelector('#primary video')
	// lyricContainer = document.querySelector('#columns #yf-container');

	// observer = new MutationObserver(observePlayer);
	// if(player != null){
	// observer.observe(player, { attributes: true, attributeFilter: ['style'] });
	// }

	// Watch for new elements being added
	// const observer = new MutationObserver(() => {
	// 	console.log('FROM Mutation Observer')
	// 	hideShelfRenderer();
	// });

	// observer.observe(document.querySelector('#contents'), {
	// 	childList: true,
	// 	subtree: true
	// });


	//KILL_SHORTS_PRESET


	const style = document.createElement('style');
	style.textContent = `
		.hide-youtube-shelves ytd-rich-shelf-renderer,
		.hide-youtube-shelves ytd-reel-shelf-renderer {
			display: none !important;
		}
	`;

	document.head.appendChild(style);
	if (kill_shorts) {
		document.documentElement.classList.toggle("hide-youtube-shelves");
	}


	chrome.runtime.onMessage.addListener(async (obj, sender, res) => {
		const { type, val } = obj;
		// console.log(obj)

    	var ytc = document.querySelector(window.innerWidth < 1000 ? 'ytd-watch-flexy #primary > #primary-inner' : 'ytd-watch-flexy #secondary');

		switch (type) {
			case 'NEW_SEARCH': {
				if (!ytc) {
					res({ 'name': '', 'channel': '' })
					break;
				}

				var container = ytc.querySelector('.yf-container')
				var progressbar = ytc.querySelector('#ytf-progressbar')
				var nowPlaying = ytc.querySelector('.now-playing')
				var music = document.querySelector('button-view-model a')
				var isMusic = music === null ? false : (music.textContent == 'Music')
				// player = document.querySelector('#primary video')
				// if(player != null){
				// 	observer.observe(player, { attributes: true, attributeFilter: ['style'] });
				// }

				if (container && container.getAttribute('data-uid') === val) {
					res({ 'name': '', 'channel': '' })
					break;
				}

				// console.log('DOM State 1 :: ' + document.readyState)
				// if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
					// document.addEventListener('DOMContentLoaded', () => {
					// 	console.log('DOM State 2 :: ' + document.readyState)
					// 	let title = document.querySelector('#above-the-fold > #title')?.textContent.trim();
					// 	let channel = document.querySelector('#upload-info > #channel-name > div > div')?.textContent.trim();
					// 	console.log('DOMContentLoaded :::: ' + title + " - " + channel)

					// }, { once: true });
				// }

				if (isMusic) {
					if (progressbar) {
						progressbar.style.visibility = 'visible'
						progressbar.classList.add("pure-material-progress-linear");
						progressbar.classList.remove("no-animate")
						// progressbar.setAttriprogressbar.style.backgroundColor = '#00000000'
					}
					if (nowPlaying) nowPlaying.textContent = 'Searching -'
				}
				let title = document.querySelector('#above-the-fold > #title')?.textContent.trim();
				let channel = document.querySelector('#upload-info > #channel-name > div > div')?.textContent.trim();
				console.log('Content.js :::: ' + title + " - " + channel)

				if (title && channel) {
					res({ 'name': title, 'channel': channel })
				}
				else {
					res({ 'name': '', 'channel': '' })
				}

				break;
			}
			case 'DISPLAY_LYRICS': {
				// if(currentTab.isActive){

				// }
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

// // Initial check in case it's already loaded
// hideShelfRenderer();

// function observePlayer() {
// 	if(lyricContainer == null){
// 		lyricContainer = document.querySelector(window.innerWidth < 1000 ? '#primary > #primary-inner > #below > #yf-container' : '#secondary > #secondary-inner > #yf-container');
// 	}
// 	if (insidePrimary && lyricContainer) {
// 		player.style.width = `${lyricContainer.style.width}px`;
// 	}
// }

function windowResize() {
	insidePrimary = document.querySelector('ytd-watch-flexy #primary > #primary-inner > #yf-container')
	moveRequired = document.querySelector(window.innerWidth < 1000
		? 
		'ytd-watch-flexy #primary > #primary-inner > #yf-container'
		:
		'ytd-watch-flexy #secondary > #yf-container'
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
	lyricContainer = document.querySelector('ytd-watch-flexy #secondary > #yf-container');

	if (lyricContainer) {
		lyricContainer.classList.add('ytf-container-marginTop');
		if (primaryInner == null) {
			primaryInner = document.querySelector('ytd-watch-flexy #primary > #primary-inner');
		}
		const firstChild = primaryInner.children[1];

		if (firstChild) {
			primaryInner.insertBefore(lyricContainer, firstChild);
		}
	}
}

function moveDivToSecondary() {
	lyricContainer = document.querySelector('ytd-watch-flexy #primary > #primary-inner > #yf-container');

	if (lyricContainer) {
		lyricContainer.classList.remove('ytf-container-marginTop');
		if (secondaryInner == null) {
			secondaryInner = document.querySelector('ytd-watch-flexy #secondary');
		}
		const firstChild = secondaryInner.firstChild;

		if (firstChild) {
			secondaryInner.insertBefore(lyricContainer, firstChild);
		}
	}

}

// function getAlbumArtColors() {
//   const colorThief = new ColorThief();
//   const img = document.querySelector("#items > yt-video-attribute-view-model > div > a > div.yt-video-attribute-view-model__hero-section > img");

//   if (img) {
//     img.crossOrigin = "Anonymous";
//     if (img.complete) {
//       const palette = colorThief.getPalette(img, 3);
//       console.log(palette);
//     } else {
//       img.addEventListener('load', function() {
//         const palette = colorThief.getPalette(img, 3);
//         console.log(palette);
//       });
//     }
//   }
// }

window.onresize = windowResize;

// getAlbumArtColors();

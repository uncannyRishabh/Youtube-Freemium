var player, lyricContainer, moveRequired, insidePrimary, observer
var primaryInner, secondaryInner

(async () => {
	console.log('Script Injected')
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
		? '#primary > #primary-inner > #below > #yf-container' 
		: '#secondary > #secondary-inner > #yf-container') == null;

	// player = document.querySelector('#primary video')
	// lyricContainer = document.querySelector('#columns #yf-container');

	// observer = new MutationObserver(observePlayer);
	// if(player != null){
	// observer.observe(player, { attributes: true, attributeFilter: ['style'] });
	// }

	chrome.runtime.onMessage.addListener(async (obj, sender, res) => {
		//NEW_SEARCH
		const { type, val } = obj;
		// console.log(obj)

		var ytc = document.querySelector('#secondary > #secondary-inner')

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

				if(isMusic){
					if (progressbar) progressbar.style.visibility = 'visible'
					if (nowPlaying) nowPlaying.textContent = 'Searching -'
				}
				let title = document.querySelector('#above-the-fold > #title')?.textContent.trim();
				let channel = document.querySelector('#upload-info > #channel-name > div > div')?.textContent.trim();
				console.log(title + " - " + channel)

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

})();


// function observePlayer() {
// 	if(lyricContainer == null){
// 		lyricContainer = document.querySelector(window.innerWidth < 1000 ? '#primary > #primary-inner > #below > #yf-container' : '#secondary > #secondary-inner > #yf-container');
// 	}
// 	if (insidePrimary && lyricContainer) {
// 		player.style.width = `${lyricContainer.style.width}px`;
// 	}
// }

function windowResize() {
	insidePrimary = document.querySelector('#primary > #primary-inner > #below > #yf-container')
	moveRequired = document.querySelector(window.innerWidth < 1000 
		? '#primary > #primary-inner > #below > #yf-container' 
		: '#secondary > #secondary-inner > #yf-container') == null;
	
	if(moveRequired){
		if (insidePrimary) {
			moveDivToSecondary();
		}
		else {
			moveDivToPrimary();
		}
	}

}

function moveDivToPrimary() {
	lyricContainer = document.querySelector('#secondary > #secondary-inner > #yf-container');

	if (lyricContainer) {
		lyricContainer.classList.add('ytf-container-marginTop');
		if (primaryInner == null) {
			primaryInner = document.querySelector('#primary > #primary-inner > #below');
		}
		const firstChild = primaryInner.children[2];

		if (firstChild) {
			primaryInner.insertBefore(lyricContainer, firstChild);
		}
	}
}

function moveDivToSecondary() {
	lyricContainer = document.querySelector('#primary > #primary-inner > #below > #yf-container');

	if (lyricContainer) {
		lyricContainer.classList.remove('ytf-container-marginTop');
		if (secondaryInner == null) {
			secondaryInner = document.querySelector('#secondary > #secondary-inner');
		}
		const firstChild = secondaryInner.firstChild;

		if (firstChild) {
			secondaryInner.insertBefore(lyricContainer, firstChild);
		}
	}

}

window.onresize = windowResize;
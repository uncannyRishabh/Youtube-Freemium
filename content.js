const messageHandler = (type, val, meta) => {
	chrome.runtime.sendMessage({ type, val, meta }, async (response) => {
		if (chrome.runtime.lastError)
			console.log('Error getting');
		if (response) console.log(response)
	});
}

(async () => {
	console.log('Script Injected')

	chrome.runtime.onMessage.addListener(async (obj, sender, res) => {
		//NEW_SEARCH
		const { type, uid } = obj;
		// console.log(obj)

		switch (type) {
			case 'NEW_SEARCH': {
				var ytc = document.querySelector('#secondary > #secondary-inner')
				
				if(!ytc){
					res({ 'name': '', 'channel': '' })
					break;
				}
				
				var container = ytc.querySelector('.yf-container')
				var progressbar = ytc.querySelector('#ytf-progressbar')
				var nowPlaying = ytc.querySelector('.now-playing')

				if(container && container.getAttribute('data-uid')===uid){
					res({ 'name': '', 'channel': '' })
					break;
				}

				if(progressbar) progressbar.style.visibility = 'visible'
				if(nowPlaying && nowPlaying.textContent.includes('Now Playing')) nowPlaying.textContent = 'Searching -'

				let val = document.querySelector('#above-the-fold > #title')?.textContent.trim();
				let channel = document.querySelector('#upload-info > #channel-name > div > div')?.textContent.trim();
				console.log(val + " - " + channel)

				if (val && channel) {
					res({ 'name': val, 'channel': channel })
				}
				else {
					res({ 'name': '', 'channel': '' })
				}

				break;
			}
			case 'DISPLAY_LYRICS': {
				// if(currentTab.isActive){

				// }
			}
			default: {
				console.log('cjs : Unknown command')
			}
		}

	})

	// var input = document.querySelector('.now-playing-text-input')
	// document.addEventListener('keydown', function(event) {
	// 	if(!input){
	// 		input = document.querySelector('.now-playing-text-input')
	// 	}

	// 	if(input){
	// 		if (event.target === input) {
	// 			console.log('Blocking key listener')
	// 			event.stopPropagation();
	// 			event.preventDefault();
	// 			return;
	// 		}
	// 	}
		
	// });

})();
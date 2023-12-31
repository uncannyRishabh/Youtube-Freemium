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
		const { type, val } = obj;
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

				if(container && container.getAttribute('data-uid')===val){
					res({ 'name': '', 'channel': '' })
					break;
				}

				if(progressbar) progressbar.style.visibility = 'visible'
				if(nowPlaying) nowPlaying.textContent = 'Searching -'

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
			}
			default: {
				console.log('cjs : Unknown command')
			}
		}

	})

})();
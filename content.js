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
				var lyricContainer = ytc.querySelector('#lyricContainer')
				var progressbar = ytc.querySelector('#ytf-progressbar')
				if(progressbar) progressbar.style.visibility = 'visible'

				if(lyricContainer && lyricContainer.getAttribute('data-uid')===uid){
					res({ 'name': '', 'channel': '' })
					break;
				}

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
	// var meta = {
	// 	'artist':'',
	// 	'tabId':'',
	// 	'timestamp':'',
	// 	'uidPk':'',
	// 	'scroll':''
	// }
	// messageHandler("NEW_SEARCH","PRIDE.	KENDRICK LAMAR",meta)
	// console.log("from cjs : ",meta)

	// document.addEventListener('DOMContentLoaded', () => {
	// 	console.log('FROM CJS : ',window.location.href)
	// });

})();
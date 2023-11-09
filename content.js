const messageHandler = (type, val, meta) => {
	chrome.runtime.sendMessage({ type, val, meta }, async (response) => {
		if (chrome.runtime.lastError)
			console.log('Error getting');
		if (response) console.log(response)
	});
}

(async () => {
	console.log('Script Injected')
	var vc = ""

	chrome.runtime.onMessage.addListener(async (obj, sender, res) => {
		//NEW_SEARCH
		const { type } = obj;

		switch (type) {
			case 'NEW_SEARCH': {
				let val = document.querySelector('#above-the-fold > #title')?.textContent.trim();
				let channel = document.querySelector('#upload-info > #channel-name > div > div')?.textContent.trim();
				console.log(val + " - " + channel)

				if (vc === val + '' + channel) {
					res({ 'name': '', 'channel': '' })
					return;
				}
				else {
					vc = val + '' + channel
					console.log(val + " - " + channel)
					res({ 'name': val, 'channel': channel })
				}

				break;
			}
			case 'DISPLAY_LYRICS':{
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
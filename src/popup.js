function messageHandler(type, val){
	chrome.runtime.sendMessage({ type, val }, async (response) => {
		if (chrome.runtime.lastError)
			console.log('Error getting');
		if (response) {
			console.log(response)
		}
	});
}

function saveObject(uid, obj) {
	var v
	if(uid === ''){
		v = obj
	}
	else{
		v = { [uid]: obj }
	}

	chrome.storage.local.set(v, () => {
		if (chrome.runtime.lastError)
			reject(chrome.runtime.lastError);
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

const isEmpty = obj => Object.keys(obj).length === 0;

document.addEventListener("DOMContentLoaded", async () => {
	var toggleExplicit = document.querySelector('#explicitFilter')
	var toggleExplicitText = document.querySelector('#explicitFilter > .yf-menuText')
	var clearData = document.querySelector('#clearData')
	var skipAds = document.querySelector('#skipAds > .yf-menuText')
	var skipAdsText = document.querySelector('#skipAds > .yf-menuText')

	var userPrefs = await getFromStorage('yt-userPrefs')
	console.log(userPrefs)
	if(!isEmpty(userPrefs)){
		var profanityCheck = userPrefs['yt-userPrefs']?.profanity;
		toggleExplicitText.textContent = profanityCheck && profanityCheck === 'true' ?
										'Disable profanity filter':'Enable profanity filter'
	}
	else {
		saveObject('yt-userPrefs',{'profanity':'false'})
	}

	toggleExplicit.addEventListener('click', () => {
		if(toggleExplicitText.textContent === 'Disable profanity filter'){
			toggleExplicitText.textContent = 'Enable profanity filter'
			userPrefs['yt-userPrefs'] = {...userPrefs['yt-userPrefs'], profanity: 'true'}
			saveObject('',userPrefs)
			messageHandler('PROFANITY_TOGGLE','true')
		}
		else if(toggleExplicitText.textContent === 'Enable profanity filter'){
			toggleExplicitText.textContent = 'Disable profanity filter'
			userPrefs['yt-userPrefs'] = {...userPrefs['yt-userPrefs'], profanity: 'false'}
			saveObject('',userPrefs)
			messageHandler('PROFANITY_TOGGLE','false')
		}
	})

	clearData.addEventListener('click', () => {
		console.log('Clear...')
		chrome.storage.local.clear(function () {
			if (chrome.runtime.lastError) {
			  console.error(chrome.runtime.lastError);
			} else {
			  console.log("Local storage cleared successfully");
			}
		  });
	})

})

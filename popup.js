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
	console.log("Saving : %o",v)
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

//****************************TODO****************************
//✅poc
//✅Add comms
//✅Create popup layout
//✅Create lyrics view (On both extension and on youtube page (fullscreen & desktop version))
//✅Handle music change
//✅Fix runInContext calling
//✅move to bing
//✅Handle non music content
//✅add new line parser
//✅prevent popup view toggle triggering search
//✅add header view
//✅Add linear progressbar 
//✅Display Header all times
//✅Save frequently played lyrics
//✅Fix detection algorithm
//✅Fix onRemove
//✅Add delete from local storage button
//✅Fix query builder (-channel)
//✅Fix save/search algorithm
//✅add clear storage
//✅Create menu
//✅Make font size functional
//✅Searching -> Now Playing transition
//✅Add options [clear data, profanity filter toggle, perform search only on music videos, buy coffee]
//✅Add font preload
//✅Fix font size limit
//✅Refresh on install/update
//Add AZL
//add view in section 1 when applicable
//add full screen support
//Remove preconnect stuff from popup
//Add popup light/dark modes
//Add manual search
//Add options[sources, skip ads, mute ads]
//Remove removeme in next release
//Restrict search for non music content
//handle yt -> other site navigation
//Replace chrome with browser apis
//Make container collapsible
//Add search with channel when not found
//keep track of tabs
// (upto 50 for 2 month)
//reset data attribute
//fix lyrics-uid-mapping (same song multiple videos)
//add tooltip
//:visited
//Add source
//wrap console.logs inside debugMode
//add diagnostics

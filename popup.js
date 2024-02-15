
document.addEventListener("DOMContentLoaded", async () => {
	var toggleExplicit = document.querySelector('#explicitFilter')
	var toggleExplicitText = document.querySelector('#explicitFilter > .yf-menuText')
	var clearData = document.querySelector('#clearData')
	var clearDataText = document.querySelector('#clearData > .yf-menuText')
	var skipAds = document.querySelector('#skipAds > .yf-menuText')
	var skipAdsText = document.querySelector('#skipAds > .yf-menuText')

	toggleExplicit.addEventListener('click', () => {
		if(toggleExplicitText.textContent === 'Disable explicit lyrics'){
			toggleExplicitText.textContent = 'Enable explicit lyrics'
		}
		else if(toggleExplicitText.textContent === 'Enable explicit lyrics'){
			toggleExplicitText.textContent = 'Disable explicit lyrics'
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
//Add manual search
//Restrict search for non music content
//Add options [clear data, explicit filter toggle, sources, skip ads, mute ads, buy coffee]
//Add AZL
//add full screen support
//add view in section 1 when applicable
//Make container collapsible
//Add search with channel when not found
//keep track of tabs
// (upto 50 for 2 month)
//reset data attribute
//fix lyrics-uid-mapping (same song multiple videos)
//add tooltip
//:visited
//handle yt -> other site navigation
//Add source
//Save state
//wrap console.logs inside debugMode
//Add dynamic user agent
//add diagnostics

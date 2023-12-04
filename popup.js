
document.addEventListener("DOMContentLoaded", async () => {
	var cd = document.querySelector('#clearData')
	cd.addEventListener('click', () => {
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

//********************TODO********************
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
//keep track of tabs
//Create menu
//Add manual search
//Restrict search for non music content
//Add search with channel when not found
// (upto 50 for 2 month)
//reset data attribute
//fix lyrics-uid-mapping (same song multiple videos)
//create popup view
//Add AZL
//Make container collapsible
//add view in section 1 when applicable
//add tooltip
//:visited
//handle yt -> other site navigation
//Add source
//Save state
//wrap console.logs inside debugMode
//Add dynamic user agent
//add diagnostics

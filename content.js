(async () => {
	console.log('Script Injected')

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

				if (container && container.getAttribute('data-uid') === val) {
					res({ 'name': '', 'channel': '' })
					break;
				}

				if (progressbar) progressbar.style.visibility = 'visible'
				if (nowPlaying) nowPlaying.textContent = 'Searching -'

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

document.addEventListener('DOMContentLoaded', () => {
	var preconnect1 = document.createElement("link");
	preconnect1.rel = "preconnect";
	preconnect1.href = "https://fonts.googleapis.com";
	document.head.appendChild(preconnect1);

	var preconnect2 = document.createElement("link");
	preconnect2.rel = "preconnect";
	preconnect2.href = "https://fonts.gstatic.com";
	preconnect2.crossOrigin = "";
	document.head.appendChild(preconnect2);
})

function windowResize() {
	console.log('---------RESIZE-------')
	var insidePrimary = true;
    var divToMove = document.querySelector('#primary > #primary-inner > #below > #yf-container');
	if(divToMove == null){
		insidePrimary = false
		divToMove = document.querySelector('#secondary > #secondary-inner > #yf-container');
	}
    
	if(divToMove){
		if (window.innerWidth < 1000) {
			if(!insidePrimary) {
				moveDivToPrimary(divToMove);
			}
		} else {
			if(insidePrimary){
				moveDivToSecondary(divToMove);
			} 
    	}
	}

}

function moveDivToPrimary(divToMove) {
    var primaryInner = document.querySelector('#primary > #primary-inner > #below');
	const firstChild = primaryInner.children[2];

	if (divToMove && primaryInner && firstChild) {
		primaryInner.insertBefore(divToMove, firstChild);
    }
}

function moveDivToSecondary(divToMove) {
    var secondaryInner = document.querySelector('#secondary > #secondary-inner');
    const firstChild = secondaryInner.firstChild;

	if (divToMove && secondaryInner) {
		secondaryInner.insertBefore(divToMove, firstChild);
    }
}

window.onresize = windowResize
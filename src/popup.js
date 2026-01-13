import { saveObject, getFromStorage, getDefaultUserPrefs } from './utils.js';

/**
 * Sends a message to the background script
 * @param {string} type - Message type
 * @param {any} val - Message payload
 */
function messageHandler(type, val) {
    chrome.runtime.sendMessage({ type, val }, async (response) => {
        if (chrome.runtime.lastError) {
            console.log('Error sending message:', chrome.runtime.lastError);
        }
        if (response) {
            console.log('Response received:', response);
        }
    });
}

// Initialize popup UI when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
    const toggleExplicit = document.querySelector('#explicitFilter');
    const toggleExplicitText = document.querySelector('#explicitFilter > .yf-menuText');
    const killShorts = document.querySelector('#killShorts');
    const killShortsText = document.querySelector('#killShorts > .yf-menuText');
    const clearData = document.querySelector('#clearData');
    
    // Load user preferences
    var userPrefs = await getFromStorage('yt-userPrefs');
    var profanity = userPrefs['yt-userPrefs']?.profanity;
    var kill_shorts = userPrefs['yt-userPrefs']?.kill_shorts;
    
    if (!userPrefs['yt-userPrefs']) {
        profanity = 'false'
        kill_shorts = false
        await saveObject('yt-userPrefs', { profanity });
    }

    // Set initial UI state
    toggleExplicitText.textContent = profanity === 'true' 
        ? 'Disable profanity'
        : 'Enable profanity';

    killShortsText.textContent = kill_shorts 
        ? 'Enable Shorts'
        : 'Disable Shorts'

    // Handle profanity filter toggle
    toggleExplicit.addEventListener('click', () => {
        const isEnabled = toggleExplicitText.textContent === 'Enable profanity';
        
        toggleExplicitText.textContent = isEnabled 
            ? 'Disable profanity'
            : 'Enable profanity';
            
        if(profanity === 'true'){
            profanity = 'false'
        }
        else if(profanity === 'false'){
            profanity = 'true'
        }
        
        saveObject('yt-userPrefs', {'profanity' : profanity});
        messageHandler('PROFANITY_TOGGLE', profanity);
    });

    //Handle kill shorts button
    killShorts.addEventListener('click', async() => {
        kill_shorts = !kill_shorts

        killShortsText.textContent = kill_shorts 
        ? 'Enable Shorts'
        : 'Disable Shorts'

        saveObject('yt-userPrefs', {'kill_shorts' : kill_shorts});
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        messageHandler('KILL_SHORTS',kill_shorts);
    })

    // Handle clear data button
    clearData.addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing storage:', chrome.runtime.lastError);
            } else {
                console.log("Local storage cleared successfully");
                saveObject('yt-userPrefs', getDefaultUserPrefs());
            }
        });
    });
});

/**ISSUES
* - New UI font size : deafault : 26px -ve limit : 20px +ve limit : 36px | gap : 3rem calc(var())
* - make gap clamp 2-3rem depending on text size calc(var())
* - Profanity toggle logic when not found - bug/edge
* - remove anything after FT also remove the contents within first bracket
* - Extract prominent colors from album art and use them for LAVA LAMP animation
* - Toggle for new UI
* - fix light mode issues
* - search with other identified artists when no lyrics found

* - Add sleep timer functionality
* - Forward and backward buttons do not update the popup UI.
* - Make bubble animation efficient - only run animation when tab is in focus
* - Make bubble animation take colors from album art
* - Bubbles reacting to song beats
* - Bubbles spinning when in searching mode
* - Bubbles to spread out evenly and morph shape. 
* - Search functionality with - is this correct lyrics ❌ / ✅ options
* - Font Size not updating in local storage - intermittently
* - Page refresh on clear data - on all open youtube tabs
* - Re-render popup.js on clear data when open

* - clear data after this update(for existing users) ✅
* - adjust lyrics size dynamically to avoid overlapping and remove extra space ✅
* - for only plain lyric disable video timestamp listener ✅
* - tab2 playing non music video displays lyrics (fixed ig ✅)
* - adjust lyrics to display previous lyric also ✅
* - no music card - should show no lyrics found - http://youtube.com/watch?v=0_3HVeHinDg&list=RD0_3HVeHinDg&start_radio=1p ✅
* - rename to lyric offset ✅
* - make offset input box ✅
* - reset offset counter for next video on increment/decrement ✅
* - fix offset input and increment decrement holding diff values ✅
* - long press listener on increment/decrement offset

* - add source - powered by stuff
* - add fallbacks

* - remove - now playing

* - fix main called multiple times for same page
* - re search if (source=lrclib && lastAccessed > 15 days && sync != true)
* - add bottom margin for lyrics
* - add youtube music distinction
* - fix first install issue

* - when large screen - put container bw (secondary & secondary-inner) else (primary and primary-inner) ✅
* - first line not highlighted when in sync
* - when in primary container; lyrics not syncing wrt to container height
* - keep () contents - https://www.youtube.com/watch?v=NyTkaQHdySM&list=RDbMtxZLbBkmc&index=2 - Input box
* - 
* - Clipse, Tyler, The Creator, Pusha T, Malice - P.O.V. (Official Music Video)
* - whatsnew + icon dot + 
* - remove clgs


*/


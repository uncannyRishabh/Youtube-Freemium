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
    const clearData = document.querySelector('#clearData');

    // Load user preferences
    var userPrefs = await getFromStorage('yt-userPrefs');
    var profanity = userPrefs['yt-userPrefs']?.profanity;
    
    if (!userPrefs['yt-userPrefs']) {
        profanity = 'false'
        await saveObject('yt-userPrefs', { profanity });
    }

    // Set initial UI state
    toggleExplicitText.textContent = profanity === 'true' 
        ? 'Disable profanity'
        : 'Enable profanity';
    

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
* - Popup Menu z-index issue ✅
* - Bubble wandering outside container ✅
* - Make lyrics text bigger and clearer (like apple music) ✅
* - Issue with Take me back to LA song - for a2z theweeknd is weeknd ✅ alternatively add google search 
* - remove feat/ft from name ✅
* - menu blur background-color: rgba(var(--pure-material-primary-rgb, 33, 150, 243), 0.12); ✅
* - Fix not found not displaying when no lyrics found ✅
* - Make progressbar color match the header bg color when not in use ✅
* - Make prgressbar stop animating when not in use ✅


* - Fix enable disable profanity UI defaulting to previous option ✅
* - Fix window resizing issue ✅
* - reel killer
* - remove anything after FT also remove the contents within first bracket
* - Add sleep timer functionality
* - Extract prominent colors from album art and use them for bubble animation
* - Toggle for new UI
* - New UI font size : deafault : 26px -ve limit : 20px +ve limit : 36px | gap : 3rem calc(var())
* - fix light mode issues
* - search with other identified artists when no lyrics found
* - make gap clamp 2-3rem depending on text size calc(var())

* - Profanity logic when not found 
* - The profanity filter toggle does not update the UI immediately after clicking.
* - Forward and backward buttons do not update the popup UI.
* - Make bubble animation efficient - only run animation when tab is in focus
* - Make bubble animation take colors from album art
* - Bubbles reacting to song beats
* - Bubbles spinning when in searching mode
* - Bubbles to spread out evenly and morph shape. 
* - Search functionality with - is this correct lyrics ❌ / ✅ options
* - Font Size not updating in local storage - intermittently

*/
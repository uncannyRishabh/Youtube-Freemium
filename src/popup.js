import { saveObject, getFromStorage } from './utils.js';

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
    const userPrefs = await getFromStorage('yt-userPrefs');
    const profanityCheck = userPrefs['yt-userPrefs']?.profanity;
    
    // Set initial UI state
    toggleExplicitText.textContent = profanityCheck === 'true' 
        ? 'Disable profanity filter'
        : 'Enable profanity filter';
    
    if (!userPrefs['yt-userPrefs']) {
        await saveObject('yt-userPrefs', { profanity: 'false' });
    }

    // Handle profanity filter toggle
    toggleExplicit.addEventListener('click', () => {
        const isEnabled = toggleExplicitText.textContent === 'Disable profanity filter';
        const newState = !isEnabled;
        
        toggleExplicitText.textContent = newState 
            ? 'Disable profanity filter'
            : 'Enable profanity filter';
            
        userPrefs['yt-userPrefs'] = {
            ...userPrefs['yt-userPrefs'],
            profanity: String(newState)
        };
        
        saveObject('', userPrefs);
        messageHandler('PROFANITY_TOGGLE', String(newState));
    });

    // Handle clear data button
    clearData.addEventListener('click', () => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing storage:', chrome.runtime.lastError);
            } else {
                console.log("Local storage cleared successfully");
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
* - Add sleep timer functionality
* - Extract prominent colors from album art and use them for bubble animation
* - Toggle for new UI
* - New UI font size : deafault : 26px -ve limit : 20px +ve limit : 36px | gap : 3rem calc(var())
* - fix light mode issues
* - search with other identified artists when no lyrics found
* - make gap clamp 2-3rem depending on text size calc(var())
* - 

* - The profanity filter toggle does not update the UI immediately after clicking.
* - Forward and backward buttons do not update the popup UI.
* - Make bubble animation efficient - only run animation when tab is in focus
* - Make bubble animation take colors from album art
* - Bubbles reacting to song beats
* - Bubbles spinning when in searching mode
* - Bubbles to spread out evenly and morph shape. 
* - 

*/
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


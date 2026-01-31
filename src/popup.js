import { saveObject, getFromStorage, getDefaultUserPrefs, carouselData } from './utils.js';

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
    // Clear notification badge when popup opens
    chrome.runtime.sendMessage({ action: 'clearUpdateBadge' });
    
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

    initWhatsNewCarousel()
});

function initWhatsNewCarousel() {
    const box = document.getElementById('carouselBox');
    const line = document.getElementById('progressLine');
    if (!box || !line || !carouselData.length) return;

    // 1. Dynamic Injection
    box.innerHTML = carouselData.map(item => `
        <a href="${item.link}" target="_blank" class="slide-link">
            <div class="slide-content-minimal">
                <span class="slide-header">${item.header}</span>
                <p class="slide-subtext">${item.subtext}</p>
            </div>
        </a>
    `).join('');

    // 2. Setup Progress Line Width
    const itemWidthPct = 100 / carouselData.length;
    line.style.width = `${itemWidthPct}%`;

    // 3. Optimized Scroll Listener
    const updateProgress = () => {
        // Calculate how far the user has scrolled as a ratio (0 to 1)
        const scrollRatio = box.scrollLeft / (box.scrollWidth - box.clientWidth);
        
        // The line can only move as far as the remaining width of the container
        const maxTranslate = box.clientWidth - line.clientWidth;
        const translateX = scrollRatio * maxTranslate;
        
        line.style.transform = `translateX(${translateX}px)`;
    };

    box.addEventListener('scroll', updateProgress);

    // 4. Managed Auto-slide
    let index = 0;
    let isPaused = false;

    const autoSlide = setInterval(() => {
        if (isPaused) return;
        
        index = (index + 1) % carouselData.length;
        box.scrollTo({
            left: index * box.clientWidth,
            behavior: 'smooth'
        });
    }, 5000);

    // Pause auto-slide when user interacts
    box.addEventListener('mouseenter', () => isPaused = true);
    box.addEventListener('mouseleave', () => isPaused = false);
    box.addEventListener('touchstart', () => isPaused = true);
}

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

* - long press listener on increment/decrement offset
* - add source - powered by stuff

* - remove - now playing

* - fix main called multiple times for same page
* - re search if (source=lrclib && lastAccessed > 15 days && sync != true)
* - add bottom margin for lyrics
* - add youtube music distinction
* - fix first install issue

* - first line not highlighted when in sync
* - Clipse, Tyler, The Creator, Pusha T, Malice - P.O.V. (Official Music Video)

* - make it collapsible/accordion
* - implement apple search UI for search
* - Share your experience bottom of lyric view (rating)
* - save time saved & ads skipped count
* - rename and obfuscate override code
* - (beta) Do not use with ad blocker
* - Description - this is an ad skipper & ! ad blocker. Youtube may update their site which can make it not so useful, in that case just disable it.
* - 3 step ad skipper

*/


import { saveObject, getFromStorage, getDefaultUserPrefs, carouselData } from './utils.js';
import { POPUP_SELECTORS } from './ytf-constants.js';

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
    messageHandler('clearUpdateBadge');
    
    const toggleExplicit = document.querySelector(POPUP_SELECTORS.EXPLICIT_FILTER);
    const toggleExplicitText = document.querySelector(POPUP_SELECTORS.EXPLICIT_FILTER_TEXT);
    const killShorts = document.querySelector(POPUP_SELECTORS.KILL_SHORTS);
    const killShortsText = document.querySelector(POPUP_SELECTORS.KILL_SHORTS_TEXT);
    const clearData = document.querySelector(POPUP_SELECTORS.CLEAR_DATA);
    
    // Load user preferences
    var userPrefs = await getFromStorage('yt-userPrefs');
    var profanity = userPrefs['yt-userPrefs']?.profanity;
    var kill_shorts = userPrefs['yt-userPrefs']?.kill_shorts;
    let skipAdsState = userPrefs['yt-userPrefs']?.skipAdsState;
    
    if (!userPrefs['yt-userPrefs']) {
        profanity = 'false';
        kill_shorts = false;
        skipAdsState = 'OFF';
        await saveObject('yt-userPrefs', { profanity });
    }

    // Set initial UI state
    toggleExplicitText.textContent = profanity === 'true' 
        ? 'Disable profanity'
        : 'Enable profanity';

    killShortsText.textContent = kill_shorts 
        ? 'Enable Shorts'
        : 'Disable Shorts';

    // Keyboard support helper
    const addKeyboardListener = (elem, clickHandler) => {
        if (!elem) return;
        elem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler ? clickHandler(e) : elem.click();
            }
        });
    };
    
    // Handle profanity filter toggle
    const handleProfanityToggle = () => {
        const isEnabled = toggleExplicitText.textContent === 'Enable profanity';
        
        toggleExplicitText.textContent = isEnabled 
            ? 'Disable profanity'
            : 'Enable profanity';
            
        if (profanity === 'true') {
            profanity = 'false';
        } else if (profanity === 'false') {
            profanity = 'true';
        }
        
        saveObject('yt-userPrefs', { 'profanity': profanity });
        messageHandler('PROFANITY_TOGGLE', profanity);
    };

    toggleExplicit.addEventListener('click', handleProfanityToggle);
    addKeyboardListener(toggleExplicit, handleProfanityToggle);

    // Handle kill shorts button
    const handleKillShortsToggle = async () => {
        kill_shorts = !kill_shorts;

        killShortsText.textContent = kill_shorts 
            ? 'Enable Shorts'
            : 'Disable Shorts';

        saveObject('yt-userPrefs', { 'kill_shorts': kill_shorts });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        messageHandler('KILL_SHORTS', kill_shorts);
    };

    killShorts.addEventListener('click', handleKillShortsToggle);
    addKeyboardListener(killShorts, handleKillShortsToggle);

    // Handle skip ads 3-state switch
    const skipAdsMenu = document.querySelector(POPUP_SELECTORS.SKIP_ADS_MENU);
    const skipAdsSubText = skipAdsMenu.querySelector(POPUP_SELECTORS.SKIP_ADS_SUBTEXT);
    const switchButtons = skipAdsMenu.querySelectorAll(POPUP_SELECTORS.SKIP_ADS_SWITCHES);
    
    const stateDescriptions = {
        'OFF': 'Watch ads normally',
        'PARTIAL': 'Mute & reach end',
        'FULL': 'Auto-skip ads'
    };
    
    const savedSkipAdsState = skipAdsState || 'OFF';
    skipAdsState = savedSkipAdsState;
    updateSkipAdsUI(switchButtons, skipAdsState, skipAdsSubText, stateDescriptions);

    switchButtons.forEach((button, index) => {
        const selectState = (e) => {
            e.stopPropagation();
            const states = ['OFF', 'PARTIAL', 'FULL'];
            skipAdsState = states[index];
            updateSkipAdsUI(switchButtons, skipAdsState, skipAdsSubText, stateDescriptions);
            saveObject('yt-userPrefs', { 'skipAdsState': skipAdsState });
            messageHandler('SKIP_AD', skipAdsState);
        };

        button.addEventListener('click', selectState);
        addKeyboardListener(button, selectState);
    });

    // Handle clear data button
    const handleClearData = () => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                console.error('Error clearing storage:', chrome.runtime.lastError);
            } else {
                console.log("Local storage cleared successfully");
                saveObject('yt-userPrefs', getDefaultUserPrefs());
            }
        });
    };

    clearData.addEventListener('click', handleClearData);
    addKeyboardListener(clearData, handleClearData);

    initWhatsNewCarousel();
});

function initWhatsNewCarousel() {
    const box = document.querySelector(POPUP_SELECTORS.CAROUSEL_BOX);
    const line = document.querySelector(POPUP_SELECTORS.PROGRESS_LINE);
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

function updateSkipAdsUI(switchButtons, skipAdsState, skipAdsSubText, stateDescriptions) {
    // Update active button and aria attributes
    switchButtons.forEach((btn, idx) => {
        const states = ['OFF', 'PARTIAL', 'FULL'];
        if (states[idx] === skipAdsState) {
            btn.classList.add('active');
            btn.setAttribute('aria-checked', 'true');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('aria-checked', 'false');
        }
    });

    // Update subtext with description
    skipAdsSubText.textContent = stateDescriptions[skipAdsState];
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
* - Make bubble animation efficient - only run animation when tab is in focus ✅ 
* - Make bubble animation take colors from album art
* - Bubbles reacting to song beats
* - Bubbles spinning when in searching mode
* - Page refresh on clear data - on all open youtube tabs
* - Re-render popup.js on clear data when open

* - long press listener on increment/decrement offset

* - fix main called multiple times for same page
* - re search if (source=lrclib && lastAccessed > 15 days && sync != true)
* - add youtube music distinction
* - fix first install issue

* - Clipse, Tyler, The Creator, Pusha T, Malice - P.O.V. (Official Music Video)

* - Share your experience bottom of lyric view (rating)
* - save time saved & ads skipped count
* - rename and obfuscate override code
* - (beta) Do not use with ad blocker
* - Description - this is an ad skipper & ! ad blocker. Youtube may update their site which can make it not so useful, in that case just disable it.
* - reload on disable/uninstall
* - fix incorrect lyric tagging on nav music -> non music - intermittent
* - feat : add album color based lamp 
* - feat : update artist and song name fetching method 
* - remove data this time

*/


/**
 * ytf-constants.js
 * Centralized DOM Query Selectors and UI Constants for YouTube Freemium Extension
 */

/**
 * YouTube Native DOM Selectors
 * Targets YouTube's own player, layout, metadata containers, and shelf elements.
 */
export const YT_SELECTORS = {
    LAYOUT: {
        PRIMARY: 'ytd-watch-flexy #primary > #primary-inner',
        SECONDARY: 'ytd-watch-flexy #secondary',
        SECONDARY_INNER: 'ytd-watch-flexy #secondary > #secondary-inner',
        WATCH_FLEXY: 'ytd-watch-flexy',
        /**
         * Resolves the target injection container based on viewport width
         * @param {boolean} isNarrow - True if window.innerWidth < 1000
         */
        TARGET: (isNarrow) => isNarrow
            ? 'ytd-watch-flexy #primary > #primary-inner'
            : 'ytd-watch-flexy #secondary'
    },
    PLAYER: {
        VIDEO: 'video',
        PRIMARY_VIDEO: '#primary video',
        MOVIE_PLAYER: '#movie_player'
    },
    METADATA: {
        MUSIC_BADGE: 'button-view-model a',
        MUSIC_HEADER_TITLE: '#header-container #title',
        MUSIC_CARD_CONTAINERS: [
            '.yt-video-attribute-view-model__metadata',
            '.ytVideoAttributeViewModelContentContainer'
        ],
        MUSIC_CARD_TITLE_SUFFIX: ' > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)',
        MUSIC_CARD_ARTIST_SUFFIX: ' > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)',
        FALLBACK_TITLE: '#above-the-fold > #title',
        FALLBACK_CHANNEL: '#upload-info > #channel-name > div > div'
    },
    SHORTS: {
        RICH_SHELF: 'ytd-rich-shelf-renderer',
        REEL_SHELF: 'ytd-reel-shelf-renderer',
        RICH_SECTION_SHELF: 'ytd-rich-section-renderer ytd-rich-shelf-renderer',
        ALL_SHELVES: 'ytd-rich-shelf-renderer, ytd-reel-shelf-renderer',
        HIDE_CLASS: 'hide-youtube-shelves'
    },
    ADS: {
        AD_OVERLAY: '.ytp-ad-player-overlay-layout',
        SKIP_BUTTON: '.ytp-skip-ad-button',
        ALL_SKIP_CLASSES: [
            'videoAdUiSkipButton',
            'ytp-ad-skip-button ytp-button',
            'ytp-ad-skip-button-modern ytp-button',
            'ytp-skip-ad-button'
        ]
    }
};

/**
 * YouTube Freemium Injected DOM Selectors
 * Targets elements created and managed by the extension inside the YouTube page.
 */
export const YTF_SELECTORS = {
    CONTAINER: {
        ROOT: '#yf-container',
        CLASS: '.yf-container',
        IN_PRIMARY: 'ytd-watch-flexy #primary > #primary-inner > #yf-container',
        IN_SECONDARY: 'ytd-watch-flexy #secondary > #yf-container',
        INTERMEDIATE: '#intermediateContainer',
        SEARCHING: '#searchingDiv',
        NOT_FOUND: '#notFound',
        LYRIC_CONTAINER: '#lyricContainer',
        SWAP_TARGETS: '#searchingDiv, #intermediateContainer, #lyricContainer, #notFound'
    },
    HEADER: {
        ROOT: '#header',
        NOW_PLAYING_LABEL: '.now-playing',
        NOW_PLAYING_INPUT: '.now-playing-text-input',
        NOW_PLAYING_INPUT_ID: '#now-playing-text-input',
        PROGRESS_BAR: '#ytf-progressbar',
        MENU_BTN: '.yf-menu'
    },
    DROPDOWN: {
        ROOT: '#yf-dropdown',
        FONT_SIZE: '#yf-font-size',
        OFFSET_TEXT: '#yf-offset-text',
        OFFSET_DECREMENT: '#ytf-offset-decrement',
        OFFSET_INCREMENT: '#ytf-offset-increment',
        REPORT_LINK: '#report'
    },
    VISUALIZER: {
        BUBBLES_WRAPPER: '.bubbles-wrapper',
        BUBBLE_1: 'bubble-1',
        BUBBLE_2: 'bubble-2',
        BUBBLE_3: 'bubble-3',
        BUBBLE_IDS: ['bubble-1', 'bubble-2', 'bubble-3']
    }
};

/**
 * External Lyrics Providers Scraper Selectors
 * Selectors for parsing DOM responses from external lyrics search results.
 */
export const SCRAPER_SELECTORS = {
    BING: {
        LYRIC_BODY: '.lyric_body',
        LYRIC_BODY_ALT: '#lyric_body',
        VERSES: '.lyric_body .verse',
        VERSES_ALT: '#lyric_body .verse',
        TOP_TITLE: '.b_topTitle',
        TAC_FACTS: '.l_tac_facts'
    },
    A2Z: {
        RINGTONE: '.ringtone'
    }
};

/**
 * Extension Popup UI Selectors
 * Selectors for interactive controls inside popup.html.
 */
export const POPUP_SELECTORS = {
    EXPLICIT_FILTER: '#explicitFilter',
    EXPLICIT_FILTER_TEXT: '#explicitFilter > .yf-menuText',
    KILL_SHORTS: '#killShorts',
    KILL_SHORTS_TEXT: '#killShorts > .yf-menuText',
    CLEAR_DATA: '#clearData',
    SKIP_ADS_MENU: '#skipAds',
    SKIP_ADS_SUBTEXT: '#skipAds .yf-menuSubText',
    SKIP_ADS_SWITCHES: '#skipAds .yf-switch',
    CAROUSEL_BOX: '#carouselBox',
    PROGRESS_LINE: '#progressLine'
};

/**
 * Preserved legacy helper
 */
export const menu = () => {
    var replaceableContainer = document.createElement('div');
    replaceableContainer.id = 'replaceableContainer';
    replaceableContainer.className = 'replaceable-container';
    return replaceableContainer;
};
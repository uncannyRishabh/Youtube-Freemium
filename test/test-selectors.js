/**
 * YouTube Freemium — DOM Query Selector Diagnostic Tool
 * Run this snippet directly in the DevTools Console on either:
 * - https://www.youtube.com/watch?v=... (YouTube Video Watch Page)
 * - https://music.youtube.com/watch?v=... (YouTube Music Player Page)
 */
(() => {
    console.clear();
    const headerStyle = 'background: #e21; color: white; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 13px;';
    const subheaderStyle = 'color: #3ea6ff; font-weight: bold; font-size: 11px;';
    const successStyle = 'color: #4CAF50; font-weight: bold;';
    const warnStyle = 'color: #FF9800; font-weight: bold;';
    const errorStyle = 'color: #F44336; font-weight: bold;';

    const host = window.location.hostname;
    const isYTM = host === 'music.youtube.com';
    const isYT = (host === 'www.youtube.com' || host === 'youtube.com' || (host.endsWith('.youtube.com') && !isYTM));

    if (!isYT && !isYTM) {
        console.error(`%c[YouTube Freemium] Unsupported host: "${host}". Run this script on youtube.com or music.youtube.com only.`, errorStyle);
        return { error: 'Unsupported host', host };
    }

    const platformName = isYTM ? 'YouTube Music (music.youtube.com)' : 'YouTube (youtube.com)';
    console.log(`%c[YouTube Freemium] ${platformName} Selector Diagnostics`, headerStyle);

    const isWatchPage = window.location.pathname.startsWith('/watch');
    const isNarrow = window.innerWidth < 1000;
    console.log(`%cEnvironment: %cViewport: ${window.innerWidth}px (${isNarrow ? 'Narrow / Mobile' : 'Desktop'}) | Watch Page: ${isWatchPage}`, subheaderStyle, 'color: inherit;');

    const results = [];

    function testSelector(category, name, selector, options = {}) {
        const { isOptional = false, extract = null } = options;
        const elements = document.querySelectorAll(selector);
        const count = elements.length;
        const firstEl = elements[0] || null;
        let value = null;
        let status = '❌ BROKEN';

        if (count > 0) {
            status = '✅ OK';
            if (extract && firstEl) {
                try {
                    value = extract(firstEl);
                } catch (e) {
                    value = `Error: ${e.message}`;
                    status = '⚠️ ERROR';
                }
            } else if (firstEl) {
                value = firstEl.textContent.trim().slice(0, 60);
            }
        } else if (isOptional) {
            status = '⚠️ OPTIONAL / NOT FOUND';
            value = 'Not present on this page';
        } else {
            value = 'Element missing in DOM';
        }

        results.push({
            Category: category,
            Feature: name,
            Selector: selector,
            Count: count,
            Status: status,
            SampleValue: value || '(none)'
        });

        return { count, firstEl, value, status };
    }

    // ==========================================
    // Playback / Video Elements (Common)
    // ==========================================
    testSelector('Playback', 'HTML5 Video Element', 'video', {
        extract: (el) => `src: ${el.currentSrc ? el.currentSrc.slice(0, 30) + '...' : '(blob/stream)'} | time: ${el.currentTime ? el.currentTime.toFixed(1) : 0}s`
    });
    testSelector('Playback', 'Movie Player', '#movie_player', {
        isOptional: true,
        extract: (el) => el.classList.contains('ad-showing') ? 'Ad currently playing' : 'Normal playback'
    });

    if (isYT) {
        // ==========================================
        // 1. YouTube Native Layout Targets
        // ==========================================
        testSelector('1. Layout', 'Primary Column Inner (Mobile Target)', 'ytd-watch-flexy #primary > #primary-inner', { isOptional: !isNarrow });
        testSelector('1. Layout', 'Secondary Column (Desktop Target)', 'ytd-watch-flexy #secondary', { isOptional: isNarrow });
        testSelector('1. Layout', 'Secondary Column Inner', 'ytd-watch-flexy #secondary > #secondary-inner', { isOptional: true });
        testSelector('1. Layout', 'Active Target Container', isNarrow ? 'ytd-watch-flexy #primary > #primary-inner' : 'ytd-watch-flexy #secondary');

        // ==========================================
        // 2. Music Detection (YouTube)
        // ==========================================
        testSelector('2. Music Detection', 'Category Chip/Badge', 'button-view-model a', {
            isOptional: true,
            extract: (el) => {
                const isMusic = el.textContent.trim().toLowerCase() === 'music';
                return `Badge Text: "${el.textContent.trim()}" (isMusic: ${isMusic})`;
            }
        });

        // ==========================================
        // 3. Music Card Metadata (YouTube)
        // ==========================================
        testSelector('3. Music Card', 'Music Header Title', '#header-container #title', { isOptional: true });
        testSelector('3. Music Card', 'Attributes Section Containers', 'yt-video-attributes-section-view-model, ytd-video-description-music-section-renderer, ytd-horizontal-card-list-renderer', {
            isOptional: true,
            extract: (el) => {
                const header = el.querySelector('.videoAttributesSectionViewModelTitle, .yt-video-attributes-section-view-model__title, #header-container #title, h3, h2, #title')?.textContent?.trim() || '(no header)';
                return `Section Header: "${header}"`;
            }
        });

        const cardContainers = [
            'yt-video-attribute-view-model',
            '.yt-video-attribute-view-model__metadata',
            '.ytVideoAttributeViewModelContentContainer'
        ];

        let foundCardContainer = null;
        for (const cSelector of cardContainers) {
            const res = testSelector('3. Music Card', `Container: ${cSelector}`, cSelector, { isOptional: true });
            if (res.count > 0 && !foundCardContainer) {
                foundCardContainer = cSelector;
            }
        }

        if (foundCardContainer) {
            testSelector('3. Music Card', 'Song Title (Suffix)', `${foundCardContainer} > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)`, { isOptional: true });
            testSelector('3. Music Card', 'Artist Name (Suffix)', `${foundCardContainer} > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)`, { isOptional: true });
            testSelector('3. Music Card', 'Song Title (.ytVideoAttributeViewModelTitle)', `${foundCardContainer} .ytVideoAttributeViewModelTitle`, { isOptional: true });
            testSelector('3. Music Card', 'Artist Name (.ytVideoAttributeViewModelSubtitle)', `${foundCardContainer} .ytVideoAttributeViewModelSubtitle`, { isOptional: true });
        } else {
            testSelector('3. Music Card', 'Song Title (Card)', '.ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)', { isOptional: true });
            testSelector('3. Music Card', 'Artist Name (Card)', '.ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)', { isOptional: true });
        }

        // ==========================================
        // 4. Fallback Metadata (YouTube)
        // ==========================================
        const fallbackTitleSelector = '#above-the-fold h1, ytd-watch-metadata #title, #above-the-fold #title';
        testSelector('4. Fallback Metadata', 'Video Title (Fallback)', fallbackTitleSelector, {
            extract: (el) => el.textContent.trim()
        });
        testSelector('4. Fallback Metadata', 'Channel / Artist (Fallback)', '#upload-info > #channel-name > div > div', {
            extract: (el) => el.textContent.trim()
        });

        // ==========================================
        // 5. Shorts Suppression (YouTube)
        // ==========================================
        testSelector('5. Shorts Suppression', 'Rich Shelf', 'ytd-rich-shelf-renderer', { isOptional: true });
        testSelector('5. Shorts Suppression', 'Reel Shelf', 'ytd-reel-shelf-renderer', { isOptional: true });
        testSelector('5. Shorts Suppression', 'Rich Section Shelf', 'ytd-rich-section-renderer ytd-rich-shelf-renderer', { isOptional: true });

        // ==========================================
        // 6. Ad Detection (YouTube)
        // ==========================================
        testSelector('6. Ads', 'Ad Overlay Layout', '.ytp-ad-player-overlay-layout', { isOptional: true });
        testSelector('6. Ads', 'Skip Ad Button (Standard)', '.ytp-skip-ad-button', { isOptional: true });
        testSelector('6. Ads', 'Modern / Legacy Skip Selectors', '.videoAdUiSkipButton, .ytp-ad-skip-button, .ytp-ad-skip-button-modern', { isOptional: true });

        // ==========================================
        // 7. Freemium Injected UI (YouTube)
        // ==========================================
        testSelector('7. YTF Injected UI', 'Freemium Container (#yf-container)', '#yf-container', {
            isOptional: true,
            extract: (el) => {
                const rect = el.getBoundingClientRect();
                const isCollapsed = el.classList.contains('collapsed');
                return `Collapsed: ${isCollapsed} | Height: ${Math.round(rect.height)}px`;
            }
        });
        testSelector('7. YTF Injected UI', 'Header Top Row', '.yf-header-top', { isOptional: true });
        testSelector('7. YTF Injected UI', 'Now Playing Label / Input', '.now-playing, #now-playing-text-input', {
            isOptional: true,
            extract: (el) => el.value !== undefined ? `Value: "${el.value}"` : `Text: "${el.textContent.trim()}"`
        });
        testSelector('7. YTF Injected UI', 'Header Actions & Controls', '.yf-header-actions, #yf-collapse-btn, .yf-menu, .yf-search-btn', { isOptional: true });
        testSelector('7. YTF Injected UI', 'Progress Bar (#ytf-progressbar)', '#ytf-progressbar', { isOptional: true });
        testSelector('7. YTF Injected UI', 'Active Content Surface', '#lyricContainer, #searchingDiv, #notFound, #intermediateContainer', { isOptional: true });

    } else if (isYTM) {
        // ==========================================
        // 1. YouTube Music Native Layout Targets
        // ==========================================
        testSelector('1. YTM Layout', 'Player Page', 'ytmusic-player-page#player-page');
        testSelector('1. YTM Layout', 'Main Panel (Video/Canvas)', 'ytmusic-player-page #main-panel');
        testSelector('1. YTM Layout', 'Side Panel (Lyrics/Queue)', 'ytmusic-player-page #side-panel');
        testSelector('1. YTM Layout', 'Side Panel Tab Renderer', 'ytmusic-player-page #tab-renderer');
        testSelector('1. YTM Layout', 'Side Panel Tabs Header', 'ytmusic-player-page tp-yt-paper-tab.tab-header');
        testSelector('1. YTM Layout', 'Lyrics Tab (When Active)', 'ytmusic-tab-renderer#tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"]', { isOptional: true });

        // ==========================================
        // 2. YouTube Music Persistent Player Bar
        // ==========================================
        testSelector('2. YTM Player Bar', 'Player Bar Root', 'ytmusic-player-bar');
        testSelector('2. YTM Player Bar', 'Song Title', 'ytmusic-player-bar .title', {
            extract: (el) => el.getAttribute('title') || el.textContent.trim()
        });
        testSelector('2. YTM Player Bar', 'Byline / Artist', 'ytmusic-player-bar .byline', {
            extract: (el) => el.textContent.trim()
        });
        testSelector('2. YTM Player Bar', 'Artist Link', 'ytmusic-player-bar .byline a[href*="/channel/"]', { isOptional: true });
        testSelector('2. YTM Player Bar', 'Play / Pause Button', 'ytmusic-player-bar #play-pause-button', { isOptional: true });
        testSelector('2. YTM Player Bar', 'Next Track Button', 'ytmusic-player-bar .next-button', { isOptional: true });
        testSelector('2. YTM Player Bar', 'Previous Track Button', 'ytmusic-player-bar .previous-button', { isOptional: true });

        // ==========================================
        // 3. YouTube Music Freemium UI Components
        // ==========================================
        testSelector('3. YTM Injected UI', 'Mounted Container', 'ytmusic-player-page #side-panel .yf-container[data-platform="ytmusic"]', {
            isOptional: true,
            extract: (el) => `Mode: ${el.getAttribute('data-ytm-mode') || 'freemium'} | SearchState: ${el.getAttribute('data-search-state') || 'collapsed'}`
        });
        testSelector('3. YTM Injected UI', 'M3 Pill Mode Switcher', '.yf-mode-switcher', { isOptional: true });
        testSelector('3. YTM Injected UI', 'FreeMium Pill Segment', '.yf-mode-segment.yf-mode-freemium', { isOptional: true });
        testSelector('3. YTM Injected UI', 'Default Pill Segment', '.yf-mode-segment.yf-mode-default', { isOptional: true });
        testSelector('3. YTM Injected UI', 'Bottom Dock Search Button', '.yf-header-bottom .yf-search-btn', { isOptional: true });
        testSelector('3. YTM Injected UI', 'Morphing Search Bar', '.yf-header-bottom .now-playing-div', { isOptional: true });
    }

    // Print diagnostic results table
    console.table(results);

    // Summary
    const criticalFailures = results.filter(r => r.Status.includes('❌'));
    console.group('%cDiagnostic Summary', subheaderStyle);
    if (isYT && !isWatchPage) {
        console.warn('⚠️ You are on youtube.com, but not on a watch page (/watch?v=...). Navigate to a video to test selectors accurately.');
    } else if (criticalFailures.length > 0) {
        console.error(`❌ ${criticalFailures.length} critical selector(s) failed on ${platformName}:`, criticalFailures.map(f => `${f.Feature} (${f.Selector})`));
    } else {
        console.log(`%c🎉 All essential ${platformName} selectors are WORKING correctly on this page!`, successStyle);
    }
    console.groupEnd();

    return { platform: platformName, results };
})();

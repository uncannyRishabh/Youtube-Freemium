/**
 * YouTube Freemium — DOM Query Selector Diagnostic Tool
 * Run this snippet directly in the DevTools Console on any YouTube watch page:
 * https://www.youtube.com/watch?v=...
 */
(() => {
    console.clear();
    const headerStyle = 'background: #e21; color: white; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 13px;';
    const subheaderStyle = 'color: #3ea6ff; font-weight: bold; font-size: 11px;';
    const successStyle = 'color: #4CAF50; font-weight: bold;';
    const warnStyle = 'color: #FF9800; font-weight: bold;';
    const errorStyle = 'color: #F44336; font-weight: bold;';

    console.log('%c[YouTube Freemium] Selector Health & Diagnostics Check', headerStyle);

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
    // 1. YouTube Native Layout Targets
    // ==========================================
    testSelector('1. Layout', 'Primary Column Inner (Mobile Target)', 'ytd-watch-flexy #primary > #primary-inner', { isOptional: !isNarrow });
    testSelector('1. Layout', 'Secondary Column (Desktop Target)', 'ytd-watch-flexy #secondary', { isOptional: isNarrow });
    testSelector('1. Layout', 'Secondary Column Inner', 'ytd-watch-flexy #secondary > #secondary-inner', { isOptional: true });
    testSelector('1. Layout', 'Active Target Container', isNarrow ? 'ytd-watch-flexy #primary > #primary-inner' : 'ytd-watch-flexy #secondary');

    // ==========================================
    // 2. Playback / Video Elements
    // ==========================================
    testSelector('2. Playback', 'HTML5 Video Element', 'video', {
        extract: (el) => `src: ${el.currentSrc ? el.currentSrc.slice(0, 30) + '...' : '(blob/stream)'} | time: ${el.currentTime.toFixed(1)}s`
    });
    testSelector('2. Playback', 'Movie Player', '#movie_player', {
        extract: (el) => el.classList.contains('ad-showing') ? 'Ad currently playing' : 'Normal playback'
    });

    // ==========================================
    // 3. Music Detection
    // ==========================================
    testSelector('3. Music Detection', 'Category Chip/Badge', 'button-view-model a', {
        extract: (el) => {
            const isMusic = el.textContent.trim().toLowerCase() === 'music';
            return `Badge Text: "${el.textContent.trim()}" (isMusic: ${isMusic})`;
        }
    });

    // ==========================================
    // 4. Music Card Metadata
    // ==========================================
    testSelector('4. Music Card', 'Music Header Title', '#header-container #title', { isOptional: true });
    testSelector('4. Music Card', 'Attributes Section Containers', 'yt-video-attributes-section-view-model, ytd-video-description-music-section-renderer, ytd-horizontal-card-list-renderer', {
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
        const res = testSelector('4. Music Card', `Container: ${cSelector}`, cSelector, { isOptional: true });
        if (res.count > 0 && !foundCardContainer) {
            foundCardContainer = cSelector;
        }
    }

    if (foundCardContainer) {
        // Test standard suffix from ytf-constants.js
        testSelector('4. Music Card', 'Song Title (Suffix)', `${foundCardContainer} > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)`, { isOptional: true });
        testSelector('4. Music Card', 'Artist Name (Suffix)', `${foundCardContainer} > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)`, { isOptional: true });
        // Also test direct semantic classnames
        testSelector('4. Music Card', 'Song Title (.ytVideoAttributeViewModelTitle)', `${foundCardContainer} .ytVideoAttributeViewModelTitle`, { isOptional: true });
        testSelector('4. Music Card', 'Artist Name (.ytVideoAttributeViewModelSubtitle)', `${foundCardContainer} .ytVideoAttributeViewModelSubtitle`, { isOptional: true });
    } else {
        testSelector('4. Music Card', 'Song Title (Card)', '.ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)', { isOptional: true });
        testSelector('4. Music Card', 'Artist Name (Card)', '.ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)', { isOptional: true });
    }

    // ==========================================
    // 5. Fallback Metadata (Robust Selectors)
    // ==========================================
    const fallbackTitleSelector = '#above-the-fold h1, ytd-watch-metadata #title, #above-the-fold #title';
    testSelector('5. Fallback Metadata', 'Video Title (Fallback)', fallbackTitleSelector, {
        extract: (el) => el.textContent.trim()
    });
    testSelector('5. Fallback Metadata', 'Channel / Artist (Fallback)', '#upload-info > #channel-name > div > div', {
        extract: (el) => el.textContent.trim()
    });

    // ==========================================
    // 6. Shorts Suppression
    // ==========================================
    testSelector('6. Shorts Suppression', 'Rich Shelf', 'ytd-rich-shelf-renderer', { isOptional: true });
    testSelector('6. Shorts Suppression', 'Reel Shelf', 'ytd-reel-shelf-renderer', { isOptional: true });
    testSelector('6. Shorts Suppression', 'Rich Section Shelf', 'ytd-rich-section-renderer ytd-rich-shelf-renderer', { isOptional: true });

    // ==========================================
    // 7. Ad Detection & Skipping
    // ==========================================
    testSelector('7. Ads (Beta)', 'Ad Overlay Layout', '.ytp-ad-player-overlay-layout', { isOptional: true });
    testSelector('7. Ads (Beta)', 'Skip Ad Button (Standard)', '.ytp-skip-ad-button', { isOptional: true });
    testSelector('7. Ads (Beta)', 'Modern / Legacy Skip Selectors', '.videoAdUiSkipButton, .ytp-ad-skip-button, .ytp-ad-skip-button-modern', { isOptional: true });

    // ==========================================
    // 8. Freemium Injected UI (if extension active)
    // ==========================================
    testSelector('8. YTF Injected UI', 'Freemium Container (#yf-container)', '#yf-container', {
        isOptional: true,
        extract: (el) => {
            const rect = el.getBoundingClientRect();
            const isCollapsed = el.classList.contains('collapsed');
            return `Collapsed: ${isCollapsed} | Height: ${Math.round(rect.height)}px (max-height: ${getComputedStyle(el).maxHeight})`;
        }
    });

    testSelector('8. YTF Injected UI', 'Header Top Row', '.yf-header-top', { isOptional: true });
    testSelector('8. YTF Injected UI', 'Now Playing Label / Input', '.now-playing, #now-playing-text-input', {
        isOptional: true,
        extract: (el) => el.value !== undefined ? `Value: "${el.value}"` : `Text: "${el.textContent.trim()}"`
    });
    testSelector('8. YTF Injected UI', 'Header Actions & Controls', '.yf-header-actions, #yf-collapse-btn, .yf-menu, .yf-search-btn', { isOptional: true });

    testSelector('8. YTF Injected UI', 'Progress Bar (#ytf-progressbar)', '#ytf-progressbar', {
        isOptional: true,
        extract: (el) => {
            const cs = getComputedStyle(el);
            const isNoAnimate = el.classList.contains('no-animate');
            const isLinear = el.classList.contains('pure-material-progress-linear');
            return `State: ${isNoAnimate ? 'idle (no-animate)' : (isLinear ? 'searching (linear)' : 'default')} | pos: ${cs.position} | top: ${cs.top} | h: ${cs.height} | vis: ${cs.visibility} | op: ${cs.opacity}`;
        }
    });

    testSelector('8. YTF Injected UI', 'Active Content Surface', '#lyricContainer, #searchingDiv, #notFound, #intermediateContainer', {
        isOptional: true,
        extract: (el) => `ID: #${el.id || '(none)'} | Visible: ${getComputedStyle(el).display !== 'none'}`
    });

    testSelector('8. YTF Injected UI', 'Floating Search Dropdown', '#yf-search-dropdown', {
        isOptional: true,
        extract: (el) => `display: ${getComputedStyle(el).display}`
    });

    testSelector('8. YTF Injected UI', 'Settings Dropdown Menu', '#yf-dropdown', { isOptional: true });
    testSelector('8. YTF Injected UI', 'Lava Lamp Bubbles Wrapper', '.bubbles-wrapper', { isOptional: true });

    // Print diagnostic results table
    console.table(results);

    // ==========================================
    // 9. Live Song Metadata Resolution Simulation
    // ==========================================
    function normalizeToken(str) {
        return String(str || '')
            .toLowerCase()
            .replace(/[\u2010-\u2015\u2212]/g, '-')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isMusicCardFresh(cardTitle, cardArtist, fallbackTitle, fallbackChannel) {
        if (!cardTitle) return false;
        const normCardTitle = normalizeToken(cardTitle);
        const normFallbackTitle = normalizeToken(fallbackTitle);

        if (!normCardTitle || !normFallbackTitle) return false;
        if (normFallbackTitle.includes(normCardTitle) || normCardTitle.includes(normFallbackTitle)) return true;

        const cardTokens = normCardTitle.split(/\s+/).filter(t => t.length > 2);
        if (cardTokens.length > 0) {
            const matched = cardTokens.filter(t => normFallbackTitle.includes(t));
            if (matched.length / cardTokens.length >= 0.6) return true;
        }

        const normCardArtist = normalizeToken(cardArtist);
        const normFallbackChannel = normalizeToken(fallbackChannel);
        if (normCardArtist && normFallbackChannel) {
            if (normCardArtist.includes(normFallbackChannel) || normFallbackChannel.includes(normCardArtist)) return true;
        }

        return false;
    }

    function parseFallbackMetadata(fallbackTitle, fallbackChannel) {
        const rawTitle = String(fallbackTitle || '').trim();
        const rawChannel = String(fallbackChannel || '').trim();

        const cleanedTitle = rawTitle
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\((?:official\s*(?:video|audio|music\s*video|lyric\s*video)?|lyrics?|visualizer|remastered|audio|hd|4k)\)/gi, '')
            .replace(/\b(official\s*(?:music\s*)?video|official\s*audio|lyric\s*video)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        let title = '';
        let channel = '';

        const dashMatch = cleanedTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (dashMatch) {
            const part1 = dashMatch[1].trim();
            const part2 = dashMatch[2].trim();
            const normChannel = normalizeToken(rawChannel);

            if (normChannel && normalizeToken(part1).includes(normChannel)) {
                channel = part1;
                title = part2;
            } else if (normChannel && normalizeToken(part2).includes(normChannel)) {
                channel = part2;
                title = part1;
            } else {
                channel = part1;
                title = part2;
            }
        } else {
            title = cleanedTitle;
            channel = rawChannel.replace(/\s*-\s*Topic$/i, '').trim();
        }

        return { title, channel };
    }

    console.group('%cMetadata Resolution Diagnostic', subheaderStyle);
    const rawFallbackTitleEl = document.querySelector(fallbackTitleSelector);
    const rawFallbackChannelEl = document.querySelector('#upload-info > #channel-name > div > div');
    const rawFallbackTitle = rawFallbackTitleEl?.textContent?.trim() || '';
    const rawFallbackChannel = rawFallbackChannelEl?.textContent?.trim() || '';

    let cardTitle = '';
    let cardArtist = '';
    if (foundCardContainer) {
        const titleEl = document.querySelector(`${foundCardContainer} .ytVideoAttributeViewModelTitle`) ||
            document.querySelector(`${foundCardContainer} > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(1)`);
        const artistEl = document.querySelector(`${foundCardContainer} .ytVideoAttributeViewModelSubtitle`) ||
            document.querySelector(`${foundCardContainer} > .ytVideoAttributeViewModelMetadata > :nth-child(1) > :nth-child(2)`);
        cardTitle = titleEl?.textContent?.trim() || '';
        cardArtist = artistEl?.textContent?.trim() || '';
    }

    const cardFresh = isMusicCardFresh(cardTitle, cardArtist, rawFallbackTitle, rawFallbackChannel);
    const parsedFallback = parseFallbackMetadata(rawFallbackTitle, rawFallbackChannel);

    let resolvedTitle = '';
    let resolvedArtist = '';
    let sourceStrategy = '';

    if (cardTitle && cardFresh) {
        resolvedTitle = cardTitle;
        resolvedArtist = cardArtist;
        sourceStrategy = 'Music Metadata Card (Verified Fresh)';
    } else if (parsedFallback.title) {
        resolvedTitle = parsedFallback.title;
        resolvedArtist = parsedFallback.channel;
        sourceStrategy = cardTitle && !cardFresh
            ? 'Fallback Parser (Card was Stale / Cross-video residual)'
            : 'Fallback Parser (Cleaned title & channel)';
    }

    console.log(`Raw Fallback Title:   "${rawFallbackTitle}"`);
    console.log(`Raw Fallback Channel: "${rawFallbackChannel}"`);
    console.log(`Music Card Title:     "${cardTitle || '(none)'}"`);
    console.log(`Music Card Artist:    "${cardArtist || '(none)'}"`);
    console.log(`Card Freshness Check: ${cardFresh ? '%cFRESH' : '%cSTALE / MISMATCH'}`, cardFresh ? successStyle : warnStyle);
    console.log(`Strategy Selected:    %c${sourceStrategy}`, 'font-weight: bold;');
    console.log(`Resolved Search Query: "%c${resolvedTitle} - ${resolvedArtist}%c"`, 'color: #e21; font-weight: bold;', 'color: inherit;');
    console.groupEnd();

    // ==========================================
    // 10. Summary & Actionable Verdict
    // ==========================================
    const criticalFailures = results.filter(r => r.Status.includes('❌'));
    console.group('%cDiagnostic Summary', subheaderStyle);
    if (!isWatchPage) {
        console.warn('⚠️ You are not currently on a YouTube video watch page (/watch?v=...). Navigate to a video to test selectors accurately.');
    } else if (criticalFailures.length > 0) {
        console.error(`❌ ${criticalFailures.length} critical selector(s) failed:`, criticalFailures.map(f => `${f.Feature} (${f.Selector})`));
    } else {
        console.log('%c🎉 All essential YouTube layout and metadata selectors are WORKING correctly on this page!', successStyle);
    }

    const ytfContainer = document.querySelector('#yf-container');
    if (ytfContainer) {
        console.log('%cℹ️ Freemium extension UI is active and mounted.', successStyle);
    } else {
        console.log('%cℹ️ Freemium container is not currently mounted (extension might be disabled or still injecting).', warnStyle);
    }
    console.groupEnd();

    return {
        results,
        metadata: {
            rawFallbackTitle,
            rawFallbackChannel,
            cardTitle,
            cardArtist,
            cardFresh,
            resolvedTitle,
            resolvedArtist,
            sourceStrategy
        }
    };
})();

/**
 * YouTube Freemium — DOM Query Selector Diagnostic Tool
 * Run this snippet directly in the DevTools Console on any YouTube watch page:
 * https://www.youtube.com/watch?v=...
 */
(() => {
    console.clear();
    const headerStyle = 'background: #e21; color: white; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 13px;';
    const subheaderStyle = 'color: #3ea6ff; font-weight: bold; font-size: 11px;';
    console.log('%c[YouTube Freemium] Selector Health Check', headerStyle);

    const isWatchPage = window.location.pathname.startsWith('/watch');
    const isNarrow = window.innerWidth < 1000;
    console.log(`%cEnvironment: %cViewport: ${window.innerWidth}px (${isNarrow ? 'Narrow / Mobile' : 'Desktop'}) | Watch Page: ${isWatchPage}`, subheaderStyle, 'color: inherit;');

    const results = [];

    function testSelector(category, name, selector, options = {}) {
        const { isOptional = false, extract = null, expected = null } = options;
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
                value = firstEl.textContent.trim().slice(0, 50);
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

    // 1. YouTube Layout Targets
    testSelector('1. Layout', 'Primary Inner (Mobile Target)', 'ytd-watch-flexy #primary > #primary-inner', { isOptional: !isNarrow });
    testSelector('1. Layout', 'Secondary Column (Desktop Target)', 'ytd-watch-flexy #secondary', { isOptional: isNarrow });
    testSelector('1. Layout', 'Active Injection Container', isNarrow ? 'ytd-watch-flexy #primary > #primary-inner' : 'ytd-watch-flexy #secondary');

    // 2. Playback / Video Elements
    testSelector('2. Playback', 'HTML5 Video Element', 'video', {
        extract: (el) => `src: ${el.currentSrc ? el.currentSrc.slice(0, 30) + '...' : '(blob/stream)'} | time: ${el.currentTime.toFixed(1)}s`
    });
    testSelector('2. Playback', 'Movie Player', '#movie_player', {
        extract: (el) => el.classList.contains('ad-showing') ? 'Ad currently playing' : 'Normal playback'
    });

    // 3. Music Detection
    testSelector('3. Music Detection', 'Category Chip/Badge', 'button-view-model a', {
        extract: (el) => {
            const isMusic = el.textContent.trim().toLowerCase() === 'music';
            return `Badge Text: "${el.textContent.trim()}" (Is Music: ${isMusic})`;
        }
    });

    // 4. Music Card Metadata
    testSelector('4. Music Card', 'Music Card Header', '#header-container #title', { isOptional: true });
    const cardContainers = [
        '.yt-video-attribute-view-model__metadata',
        '.ytVideoAttributeViewModelContentContainer'
    ];
    let cardFound = false;
    for (const cSelector of cardContainers) {
        const res = testSelector('4. Music Card', `Container: ${cSelector}`, cSelector, { isOptional: true });
        if (res.count > 0 && !cardFound) {
            cardFound = true;
            testSelector('4. Music Card', 'Song Title (Card)', `${cSelector} > .ytVideoAttributeViewModelMetadata > :nth-child(1)`, { isOptional: true });
            testSelector('4. Music Card', 'Artist Name (Card)', `${cSelector} > .ytVideoAttributeViewModelMetadata > :nth-child(2)`, { isOptional: true });
        }
    }

    // 5. Fallback Metadata
    testSelector('5. Fallback Metadata', 'Video Title (Fallback)', '#above-the-fold > #title', {
        extract: (el) => el.textContent.trim()
    });
    testSelector('5. Fallback Metadata', 'Channel / Artist (Fallback)', '#upload-info > #channel-name > div > div', {
        extract: (el) => el.textContent.trim()
    });

    // 6. Shorts / Feed Shelves (Kill Shorts target)
    testSelector('6. Shorts Suppression', 'Rich Section Shelf', 'ytd-rich-section-renderer ytd-rich-shelf-renderer', { isOptional: true });
    testSelector('6. Shorts Suppression', 'Reel Shelf', 'ytd-reel-shelf-renderer', { isOptional: true });

    // 7. Ad Detection & Skipping
    testSelector('7. Ads (Beta)', 'Ad Overlay Layout', '.ytp-ad-player-overlay-layout', { isOptional: true });
    testSelector('7. Ads (Beta)', 'Skip Ad Button', '.ytp-skip-ad-button', { isOptional: true });

    // 8. Extension Injected UI (if loaded)
    testSelector('8. YTF Injected UI', 'Freemium Container', '#yf-container', { isOptional: true });
    testSelector('8. YTF Injected UI', 'Lyric Container', '#lyricContainer', { isOptional: true });
    testSelector('8. YTF Injected UI', 'Progress Bar', '#ytf-progressbar', { isOptional: true });
    testSelector('8. YTF Injected UI', 'Lava Lamp Bubbles Wrapper', '.bubbles-wrapper', { isOptional: true });

    console.table(results);

    // Diagnostics & Actionable Summary
    const criticalFailures = results.filter(r => r.Status.includes('❌'));
    console.group('%cDiagnostic Summary', subheaderStyle);
    if (!isWatchPage) {
        console.warn('⚠️ You are not currently on a YouTube video watch page (/watch?v=...). Navigate to a video to test selectors accurately.');
    } else if (criticalFailures.length > 0) {
        console.error(`❌ ${criticalFailures.length} critical selector(s) failed:`, criticalFailures.map(f => `${f.Feature} (${f.Selector})`));
    } else {
        console.log('%c🎉 All essential YouTube layout and metadata selectors are WORKING correctly on this page!', 'color: #4CAF50; font-weight: bold;');
    }
    console.groupEnd();

    return results;
})();

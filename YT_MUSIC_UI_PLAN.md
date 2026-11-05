# YouTube Music UI Integration Plan: Full-Bleed Lyrics Stage, Top-Right Context Menu & Bottom M3 Expressive Dock

## 1. Architectural Overview & Spatial Layout

To eliminate nested scrollbars, header clipping under YouTube Music's sticky `UP NEXT | LYRICS | COMMENTS | RELATED` tab bar, and redundant card chrome inside the `LYRICS` tab, the YouTube Music (`music.youtube.com`) integration replaces the stacked two-row card header with a **spatial three-zone layout** inside `#yf-container`:

| Zone | Position in `LYRICS` Tab | Components | Visual Treatment |
| :--- | :--- | :--- | :--- |
| **Top-Right Context Action** | `position: absolute; top: 12px; right: 14px; z-index: 35` | Standalone `⋮` 3-Dot Menu Button (`.yf-menu`) + Context Dropdown (`#yf-dropdown`) | Circular `32px × 32px` frosted glass button (`backdrop-filter: blur(24px) saturate(180%)`); opens `Font Size`, `Lyric Offset`, and `Report an issue` anchored top-right |
| **Center Lyrics Stage** | Full-bleed (`inset: 0`, `100%` of `#tab-renderer` viewport height) | `.intermediateContainer` + `.bubbles-wrapper` + `.lyricContainer` (or `#notFound` / `#searchingDiv`) | Edge-to-edge ambient mesh lava-lamp stage in `FreeMium` mode; swaps cleanly to YouTube Music's native `ytmusic-description-shelf-renderer` in `Default` mode |
| **Bottom Coordinated Dock** | `position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 35` | Segmented Pill Switcher (`FreeMium \| Default`) + Morphing Search Bar (`.now-playing-div`) | Coordinated M3 Expressive spring choreography: tiny `[🔍]` icon in idle state; expands into full search input while translating the pill switcher out of the way |

## 2. Component Specifications

### 2.1 Segmented Pill Switcher (`FreeMium | Default`)

The switcher contrasts the two modes directly through its material treatment so users immediately see which mode carries the ambient visual effects:

| Segment | Label | Material & Surface Treatment | Active Viewport Behavior |
| :--- | :--- | :--- | :--- |
| **Left Segment** | `FreeMium` (with red `F` badge) | **Apple Music Glassmorphism Effect**: `backdrop-filter: blur(28px) saturate(200%)`, translucent luminous surface (`linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.10))`), `1px` specular inner/outer border (`rgba(255, 255, 255, 0.32)`), and soft ambient drop shadow | Shows `#yf-container`'s ambient mesh `.bubbles-wrapper` and synced `.lyricContainer`; hides native `ytmusic-description-shelf-renderer` |
| **Right Segment** | `Default` | **Flat / No Glassmorphism Effect**: `backdrop-filter: none`, `box-shadow: none`, transparent when inactive and flat solid `#212121` (`border: 1px solid rgba(255, 255, 255, 0.12)`, zero blur, zero glow) when active | Hides `.intermediateContainer` / `#notFound` and reveals YouTube Music's native static `ytmusic-description-shelf-renderer` (`LyricFind`) while keeping the bottom dock & top-right `⋮` accessible |

### 2.2 Bottom Search Bar State Machine (Tiny Idle $\rightarrow$ Pill Shift $\rightarrow$ Input Expand $\rightarrow$ Search Ready)

To prevent the search bar from distracting during passive playback, the bottom dock follows a staged **Android M3 Expressive** choreography:

1. **State 0 — Idle (`data-search-state="collapsed"`)**:
   - The bottom dock is horizontally centered (`justify-content: center; gap: 10px`).
   - The `[FreeMium | Default]` pill switcher sits on the left (`height: 38px; border-radius: 999px`).
   - Beside it on the right, the search bar is collapsed into a **tiny `38px × 38px` circular glassmorphic icon button** displaying only the `🔍` icon (`width: 38px; min-width: 38px; padding: 0; border-radius: 999px`).
   - The `<input class="now-playing-text-input">` inside has `width: 0; opacity: 0; pointer-events: none;`.
2. **State 1 — Choreographed Expansion on Click (`data-search-state="expanding"`)**:
   - Clicking the tiny `[🔍]` button triggers a two-beat M3 Expressive spring transition (`cubic-bezier(0.22, 1, 0.36, 1)`):
     - **Beat 1 (`0ms – 140ms`, Pill Movement)**: The `[FreeMium | Default]` pill smoothly shifts upward above the dock track remaining centered (`bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) scale(0.95)`).
     - **Beat 2 (`50ms – 240ms`, Search Bar Expansion)**: As the pill clears the horizontal row, `.now-playing-div` expands from `38px` to `100%` of the dock width (`border-radius: 999px`, Apple Music frosted glass `backdrop-filter: blur(28px) saturate(190%)`).
3. **State 2 — Interactive Search Ready (`data-search-state="expanded"`)**:
   - Once the expansion transition completes (`220ms`), `.now-playing-text-input` fades in (`opacity: 1; pointer-events: auto`), pre-filled with the current `Song - Artist` (or `(song name - artist)` placeholder when cleared), and receives `.focus()` + `.select()` so the user can immediately type or press `Enter` / click `🔍`.
   - Clicking `×` (`.yf-search-close-btn`), pressing `Escape`, or clicking outside collapses the search bar back to the tiny `38px × 38px` `[🔍]` circle and glides the `[FreeMium | Default]` pill back into the bottom row.
4. **State 3 — Results Dropdown Open (`.now-playing-div.dropdown-open`)**:
   - Because the search bar is docked at the bottom of the lyrics stage on YouTube Music, `#yf-search-dropdown` attaches seamlessly **upward** (`bottom: 100%; top: auto; border-radius: 14px 14px 0 0;`), while `.now-playing-div.dropdown-open` rounds its bottom corners (`border-radius: 0 0 14px 14px`) to form a single continuous glassmorphic container expanding upward from the bottom search bar.

### 2.3 Top-Right 3-Dot Context Menu (`.yf-menu` & `#yf-dropdown`)

- `.yf-header-top` is anchored at `position: absolute; top: 12px; right: 14px; z-index: 35;`.
- `.yf-logo-container` and `.yf-collapse-btn` (`^`) are hidden on YouTube Music (`display: none !important`) since the `FreeMium` badge lives in the bottom pill and tab switching (`UP NEXT | LYRICS | COMMENTS | RELATED`) already manages panel visibility.
- `.yf-menu` renders as a `32px × 32px` circular glassmorphic button (`backdrop-filter: blur(24px) saturate(180%)`).
- Clicking `.yf-menu` opens `#yf-dropdown` directly below it (`top: calc(100% + 6px); right: 0;`) with `backdrop-filter: blur(18px)` and `Font Size`, `Lyric Offset`, and `Report an issue` controls.

## 3. DOM & Event Implementation Plan (`src/content-ytm.js` & `src/background.js`)

### 3.1 Top-of-Tab Mounting (`src/content-ytm.js` & `src/background.js`)

Replace `shelf.nextSibling` insertion with first-child mounting inside `ytmusic-section-list-renderer #contents` and tag the container with `data-platform="ytmusic"`:

```javascript
const targetParent =
    document.querySelector(YTM_SELECTORS.LAYOUT.CONTENTS) ||
    document.querySelector(YTM_SELECTORS.LAYOUT.SECTION_LIST);

if (targetParent) {
    container.setAttribute('data-platform', 'ytmusic');
    if (!container.getAttribute('data-ytm-mode')) {
        container.setAttribute('data-ytm-mode', 'freemium'); // 'freemium' | 'default'
    }
    if (!container.getAttribute('data-search-state')) {
        container.setAttribute('data-search-state', 'collapsed'); // 'collapsed' | 'expanded'
    }
    if (container.parentElement !== targetParent || targetParent.firstElementChild !== container) {
        targetParent.insertBefore(container, targetParent.firstChild);
    }
    targetParent.setAttribute('data-ytf-mode', container.getAttribute('data-ytm-mode'));
}
```

### 3.2 Pill Switcher & Search Choreography (`src/background.js`)

When `isYtMusic` is true during header initialization in `src/background.js`:

```javascript
if (isYtMusic) {
    container.setAttribute('data-platform', 'ytmusic');
    container.setAttribute('data-ytm-mode', 'freemium');
    container.setAttribute('data-search-state', 'collapsed');

    const modeSwitcher = document.createElement('div');
    modeSwitcher.className = 'yf-mode-switcher';
    setSafeHTML(modeSwitcher, `
        <button type="button" class="yf-mode-segment yf-mode-freemium is-active" data-mode="freemium">
            <span class="yf-mode-dot">F</span>
            <span>FreeMium</span>
        </button>
        <button type="button" class="yf-mode-segment yf-mode-default" data-mode="default">
            <span>Default</span>
        </button>
    `);

    modeSwitcher.querySelectorAll('.yf-mode-segment').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetMode = btn.getAttribute('data-mode');
            container.setAttribute('data-ytm-mode', targetMode);
            if (container.parentElement) {
                container.parentElement.setAttribute('data-ytf-mode', targetMode);
            }
            modeSwitcher.querySelectorAll('.yf-mode-segment').forEach((b) => {
                b.classList.toggle('is-active', b === btn);
            });
            if (targetMode === 'freemium' && mediaElem?._syncCurrentLyric) {
                requestAnimationFrame(() => mediaElem._syncCurrentLyric(true));
            }
        });
    });

    headerBottom.insertBefore(modeSwitcher, nowPlayingDiv);

    // First expand searchbar & move pill, then focus input for searching
    const expandSearchBar = (e) => {
        if (container.getAttribute('data-search-state') === 'expanded') return;
        if (e) e.stopPropagation();
        container.setAttribute('data-search-state', 'expanded');
        setTimeout(() => {
            nowPlayingText.focus();
            if (nowPlayingText.value && nowPlayingText.value === nowPlayingText.getAttribute('data-current-title')) {
                nowPlayingText.select();
            }
        }, 220);
    };

    const collapseSearchBar = () => {
        closeFloatingSearchDropdown();
        container.setAttribute('data-search-state', 'collapsed');
        nowPlayingText.blur();
    };

    nowPlayingDiv.addEventListener('click', (e) => {
        if (container.getAttribute('data-search-state') !== 'expanded') {
            expandSearchBar(e);
        }
    });

    searchBtn.addEventListener('click', (e) => {
        if (container.getAttribute('data-search-state') !== 'expanded') {
            e.stopImmediatePropagation();
            expandSearchBar(e);
        }
    }, true);

    inlineCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseSearchBar();
    });
}
```

## 4. CSS Implementation Plan (`src/global.css`)

```css
/* ==========================================================================
   YOUTUBE MUSIC FULL-BLEED STAGE, TOP-RIGHT 3-DOT MENU & BOTTOM M3 DOCK
   ========================================================================== */
ytmusic-player-page #contents[data-ytf-mode="freemium"] > ytmusic-description-shelf-renderer,
ytmusic-player-page #contents[data-ytf-mode="freemium"] > ytmusic-message-renderer {
	display: none !important;
}

ytmusic-player-page .yf-container[data-platform="ytmusic"] {
	position: relative;
	width: 100%;
	height: calc(100vh - var(--ytmusic-nav-bar-height, 64px) - var(--ytmusic-player-bar-height, 72px) - 56px);
	max-height: none;
	margin: 0;
	border: none;
	border-radius: 0 0 12px 12px;
	background: transparent;
	overflow: hidden;
}

/* Default Mode: Hide Freemium stage and reveal native LyricFind shelf */
ytmusic-player-page .yf-container[data-platform="ytmusic"][data-ytm-mode="default"] .intermediateContainer,
ytmusic-player-page .yf-container[data-platform="ytmusic"][data-ytm-mode="default"] #notFound,
ytmusic-player-page .yf-container[data-platform="ytmusic"][data-ytm-mode="default"] #searchingDiv {
	display: none !important;
}

/* --- Top-Right Floating 3-Dot Context Button --- */
ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-header {
	position: static;
	padding: 0;
	background: transparent !important;
	border: none;
}

ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-logo-container,
ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-collapse-btn {
	display: none !important;
}

ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-header-top {
	position: absolute;
	top: 12px;
	right: 14px;
	width: auto;
	min-height: 0;
	z-index: 35;
}

ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-menu {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.14);
	-webkit-backdrop-filter: blur(24px) saturate(180%);
	backdrop-filter: blur(24px) saturate(180%);
	border: 1px solid rgba(255, 255, 255, 0.24);
	color: #ffffff;
}

/* --- Bottom Coordinated Floating Dock (Pill Switcher + Morphing Search Bar) --- */
ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-header-bottom {
	position: absolute;
	bottom: 16px;
	left: 16px;
	right: 16px;
	width: auto;
	z-index: 35;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	pointer-events: none;
}

ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-mode-switcher,
ytmusic-player-page .yf-container[data-platform="ytmusic"] .now-playing-div,
ytmusic-player-page .yf-container[data-platform="ytmusic"] .yf-search-btn {
	pointer-events: auto;
}

/* --- M3 Expressive Pill Switcher: FreeMium (Glassmorphism) | Default (Flat) --- */
.yf-mode-switcher {
	display: inline-flex;
	align-items: center;
	height: 38px;
	padding: 3px;
	border-radius: 999px;
	background: rgba(18, 18, 22, 0.52);
	border: 1px solid rgba(255, 255, 255, 0.14);
	box-sizing: border-box;
	gap: 2px;
	transition:
		transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
		bottom 0.28s cubic-bezier(0.22, 1, 0.36, 1),
		left 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.yf-mode-segment {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 30px;
	padding: 0 14px;
	border-radius: 999px;
	font-family: "YouTube Sans", "Roboto", sans-serif;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	border: 1px solid transparent;
	color: rgba(255, 255, 255, 0.72);
	background: transparent;
	transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

/* FreeMium Segment: Apple Music Glassmorphism Effect */
.yf-mode-freemium {
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 100%);
	-webkit-backdrop-filter: blur(28px) saturate(200%);
	backdrop-filter: blur(28px) saturate(200%);
}

.yf-mode-freemium.is-active {
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.12) 100%);
	border-color: rgba(255, 255, 255, 0.34);
	box-shadow:
		0 4px 16px rgba(123, 104, 238, 0.32),
		inset 0 1px 0 rgba(255, 255, 255, 0.38);
	color: #ffffff;
}

/* Default Segment: Pure Flat (No Glassmorphism / No Blur Effect) */
.yf-mode-default {
	-webkit-backdrop-filter: none !important;
	backdrop-filter: none !important;
	box-shadow: none !important;
	background: transparent;
}

.yf-mode-default.is-active {
	background: #212121;
	border-color: rgba(255, 255, 255, 0.12);
	color: #ffffff;
}

/* --- Search Bar States: Collapsed (Tiny) vs. Expanded --- */
ytmusic-player-page .yf-container[data-platform="ytmusic"][data-search-state="collapsed"] .now-playing-div {
	display: none;
}

ytmusic-player-page .yf-container[data-platform="ytmusic"][data-search-state="collapsed"] .yf-search-btn {
	width: 38px;
	height: 38px;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.14);
	-webkit-backdrop-filter: blur(26px) saturate(190%);
	backdrop-filter: blur(26px) saturate(190%);
	border: 1px solid rgba(255, 255, 255, 0.24);
	color: #ffffff;
	opacity: 1;
}

/* Expanded State: Pill remains centered above search bar */
ytmusic-player-page .yf-container[data-platform="ytmusic"][data-search-state="expanded"] .yf-mode-switcher {
	position: absolute;
	bottom: calc(100% + 8px);
	left: 50%;
	transform: translateX(-50%) scale(0.95);
}

ytmusic-player-page .yf-container[data-platform="ytmusic"][data-search-state="expanded"] .now-playing-div {
	display: flex;
	flex: 1 1 auto;
	height: 38px;
	padding: 0 12px;
	border-radius: 999px;
	background: rgba(24, 24, 30, 0.62);
	-webkit-backdrop-filter: blur(28px) saturate(190%);
	backdrop-filter: blur(28px) saturate(190%);
	border: 1px solid rgba(255, 255, 255, 0.28);
	animation: yf-m3-expand 0.26s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes yf-m3-expand {
	from {
		max-width: 38px;
		opacity: 0.6;
	}
	to {
		max-width: 100%;
		opacity: 1;
	}
}
```

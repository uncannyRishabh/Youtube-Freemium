# Changelog - YouTube Freemium

All notable changes to the YouTube Freemium extension are documented below.

---

## [Summer Release] - 2026-10-18

### 🚀 New Features & Enhancements

- **Collapsible Lyrics Container**:
  - Added a collapse/expand toggle button with an animated rotating chevron icon in the header.
  - Clicking the header bar or the collapse button toggles between full view and a compact header-only view (`90px`).
  - Added state persistence via `localStorage` (`ytf-collapsed`) so the panel remembers your preferred collapsed/expanded state across video navigations and sessions.
  - Automatically hides the 3-dot action menu (`.yf-menu`) with smooth opacity/visibility transitions when collapsed, and dismisses any open dropdowns.

- **Viewport & Tab-Aware Lyrics Sync (Performance Optimization)**:
  - Integrated `IntersectionObserver` on the lyrics scroll container and bound a `document.visibilitychange` listener.
  - Pauses real-time lyric sync computations and scroll triggers whenever the lyrics container is scrolled out of the viewport, the container is collapsed, or the browser tab is switched to the background.
  - Instantly snaps and highlights the current active lyric line (`behavior: 'auto'`) as soon as the container scrolls back into view or the tab becomes active again.
  - Clean lifecycle teardown of observers and listeners via `detachLyricsSync` on song transitions.

- **LRCLIB Attribution & API Compliance**:
  - Implemented LRCLIB rate-limiting and user-agent guidelines by sending proper `X-User-Agent` and `Lrclib-Client` headers with the Chrome Web Store extension URL.
  - Added attribution credit (`Lyrics provided by LRCLIB`) with an external link at the bottom of the lyrics container whenever lyrics are sourced from LRCLIB.

- **Organic Lava Lamp Visualizer**:
  - Replaced legacy bubble visualizer with a smooth, GPU-accelerated canvas mesh background utilizing Lissajous curves.
  - Clamped rendering loop to 30 FPS with subtle opacity to preserve low CPU/GPU usage during music playback.

---

### 🎨 UI & Typography Polish

- **Centering & Font Reset**:
  - Re-centered lyrics alignment and synchronized text styling with YouTube's native typography (`Roboto`, `Arial`, `sans-serif`).
  - Re-tuned font sizes and line heights across all size presets (`sizeS` to `sizeL`) for optimal readability.
  - Added animated ellipsis dots for instrumental interludes (`.am-interlude-dots`).

- **Layout & Container Padding Fixes**:
  - Fixed edge-clipping issues on narrow viewports/sidebars by enforcing `box-sizing: border-box; width: 100%` on both `.intermediateContainer` and `.lyricContainer`.
  - Added horizontal padding (`padding: 0 16px; width: 100%`) on individual lyric lines to ensure lyrics never touch the container borders.

- **Thin Scrollbar Restoration**:
  - Restored subtle, slim custom scrollbars (`4px` width) with rounded thumb and track matching YouTube's dark theme aesthetics.

---

### 🛠️ Architecture & Refactoring

- **Centralized DOM Selectors**:
  - Extracted all YouTube DOM selectors and extension UI selectors into a dedicated constant module (`src/ytf-constants.js` -> `YT_SELECTORS`, `YTF_SELECTORS`).
  - Created a browser console audit test script (`test/selector-test.js`) to rapidly verify selector validity against live YouTube layout updates.

- **Search UI & Lifecycle Improvements**:
  - Added immediate placeholder and "Searching..." UI state with an animated linear progress bar while lyrics are being fetched.
  - Clears stale lyrics immediately on new video playback to prevent outdated text flashes.
  - Improved song and artist metadata parsing and title cleaning (stripping brackets, featured artist formatting).

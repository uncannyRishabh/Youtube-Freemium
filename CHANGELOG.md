# Changelog

All notable changes to the YouTube Freemium extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.0.0] - 2026-11-06

### Added
- **YouTube Music (`music.youtube.com`) Native Support**:
  - Full-bleed Apple Music–style lyrics canvas embedded seamlessly inside YouTube Music's side-panel tab hierarchy (`LYRICS` tab).
  - Standalone top-right 3-dot context menu (`⋮`) for typography and sync controls.
  - Full-bleed ambient mesh lava-lamp stage with GPU-accelerated backdrop blur.
- **Material 3 (M3) Expressive Floating Dock**:
  - Glassmorphic segmented pill switcher allowing effortless switching between `FreeMium` ambient mode and YouTube Music's native `Default` mode.
  - Morphing search bar: compact circular search trigger that smoothly expands inline using iOS spring physics (`cubic-bezier(0.34, 1.25, 0.35, 1)`).
- **Cross-Platform Lexical Lyrics Reuse**:
  - Intelligent fuzzy lexical search across local cache that identifies matching tracks between YouTube and YouTube Music even when platform video UIDs differ.
- **Selector Diagnostic Suite Separation**:
  - Dedicated diagnostic routines in `test/test-selectors.js` that strictly execute YouTube selectors on `youtube.com` and YouTube Music selectors on `music.youtube.com`.

### Fixed
- **Fullscreen Video Overlay Fix**:
  - Resolved issue where the Freemium container stayed overlaid on top of videos during fullscreen playback on YouTube Music and YouTube. The lyrics container now hides automatically (`display: none !important`) when entering fullscreen and restores upon exit.
- **Pill Layout Shift on Mode Toggle**:
  - Balanced bottom dock layout with symmetrical spacing to ensure the `[FreeMium | Default]` mode switcher remains dead center without shifting horizontally when toggling between modes.
- **Pill Position on Search Expand**:
  - Maintained horizontal center alignment (`left: 50%; transform: translateX(-50%) scale(0.95)`) for the mode switcher above the expanded search input, preventing leftward drift when expanding search.
- **Multi-Tab Concurrency**:
  - Refactored background script to use isolated per-tab session state (`tabSessions` map) preventing cross-tab state collision.

### Documentation
- Updated `README.md` with detailed platform features, M3 floating dock details, keyboard shortcuts, and version 4.0.0 build commands.

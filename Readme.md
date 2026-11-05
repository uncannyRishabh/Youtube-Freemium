# YouTube Freemium

> Synchronized lyrics and enhanced music playback features on YouTube and YouTube Music with an Apple Music–inspired experience.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/youtube-freemium/pgafgbgnfoiookabcmhjeajkfmmbipnm)
[![Microsoft Edge Add-ons](https://img.shields.io/badge/Microsoft_Edge-Available-0078D7?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/youtube-freemium/cbfhicomoandphidakponcnjeabiofmo)
[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/uncannyRishabh/Youtube-Freemium)

---

## Download & Installation

Install the extension directly from the official web stores:

- **Chrome Web Store**: [YouTube Freemium on Chrome Web Store](https://chromewebstore.google.com/detail/youtube-freemium/pgafgbgnfoiookabcmhjeajkfmmbipnm)
- **Microsoft Edge Add-ons**: [YouTube Freemium on Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/youtube-freemium/cbfhicomoandphidakponcnjeabiofmo)

---

## Features

### 1. Dual Platform Support (YouTube & YouTube Music)
- **YouTube (`youtube.com`)**: Integrated directly into watch page layout with responsive positioning for mobile, theater, and wide views.
- **YouTube Music (`music.youtube.com`)**: Dedicated integration inside YouTube Music's side-panel tab hierarchy (`LYRICS` tab), supporting seamless switching between standard YouTube Music lyrics and Freemium mode.

### 2. Apple Music–Style Synced Lyrics
- Real-time time-synchronized lyrics with dynamic animated ambient mesh (lava-lamp) backgrounds.
- Karaoke-style word-by-word and line-by-line active verse highlighting.
- Click any lyric line to jump directly to that timestamp in the track.

### 3. Material 3 (M3) Expressive Floating Dock (YouTube Music)
- **Segmented Pill Switcher (`FreeMium | Default`)**: Symmetrically balanced dock keeping the mode switcher centered with zero layout shift during mode toggles.
- **Morphing Search Bar**: Compact circular search button that smoothly expands inline into a full search bar using iOS spring physics (`cubic-bezier(0.34, 1.25, 0.35, 1)`), elegantly retaining the pill centered above the search input.
- **Upward-Attached Dropdown**: Floating search results attach smoothly upward from the bottom dock.

### 4. Cross-Platform Lexical Lyrics Reuse
- Intelligent cross-platform caching and lexical search matching between YouTube and YouTube Music.
- When track video IDs differ across platforms, fuzzy lexical scoring matches saved lyrics instantly without requiring redundant network lookups.

### 5. Smart Non-Intrusive Video Fullscreen
- Automatically hides the Freemium container whenever video playback enters fullscreen mode on YouTube or YouTube Music.
- Restores lyrics immediately upon exiting fullscreen.

### 6. Interactive Search & Customization
- Live interactive search for songs, remixes, and alternative versions.
- Customizable typography with persistent font size controls (14px – 36px) across reloads.
- Adjustable sync offset timer (± seconds) to fine-tune lyrics synchronization.
- Optional Shorts suppression and profanity filtering.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `Enter` | Search Input | Execute lyrics search for entered song / artist |
| `Escape` | Search Input | Clear query / collapse search bar back into dock |
| `Click` on Lyric Line | Lyrics View | Seek audio/video playback to corresponding timestamp |
| `Space` / `Enter` | Popup Toggles | Toggle settings (Explicit Filter, Kill Shorts, Font Size) |

---

## Credits & Acknowledgments

- **Lyrics Data**: Lyrics are proudly powered by **[LRCLIB](https://lrclib.net/)**, the open and community-driven lyrics database providing synchronized and plain lyrics.

---

## Prerequisites (for local development)

- **CMake** (v3.10+)
- **Node.js** (v18+)
- *(Windows only)* **Ninja** build system

---

## Build Steps

### 1. Release Build (Clean Distribution)

Builds production-ready code into `out/release/` by stripping comments, removing `console.log` statements, minifying CSS/JSON, and verifying JavaScript syntax.

#### Direct Script (Recommended)

```bash
node scripts/build-release.js
```

#### macOS / Linux (CMake)

```bash
# Configure build with version (e.g., 4.0.0)
cmake -DVERSION=4.0.0 .

# Build and package release zip
make package_release
```

> **Tip:** Run `make release` if you only want to generate the unpacked folder in `out/release/` without creating a zip.

#### Windows (CMake)

```cmd
# Configure build
cmake -S . -B build -G "Ninja" -DVERSION=4.0.0

# Build and package release zip
cmake --build build --target package_release
```

The output zip will be placed in:
```
out/Chrome_Edge/youtube_freemium_<VERSION>_release.zip
```

---

### 2. Development Build

Packs raw source files directly from `src/` without modification.

#### macOS / Linux

```bash
cmake -DVERSION=4.0.0 .
make extension
```

#### Windows

```cmd
cmake -S . -B build -G "Ninja" -DVERSION=4.0.0
cmake --build build --target package_and_print
```

---

## Loading Unpacked Extension in Browser

1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
2. Enable **Developer mode** in the top-right corner.
3. Either:
   - Drag and drop the generated `.zip` file from `out/Chrome_Edge/`.
   - Or click **Load unpacked** and select `out/release/` (for production) or `src/` (for development).

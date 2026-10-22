# Youtube Freemium

> Enable synchronized lyrics and enhanced music playback features on YouTube with an Apple Music–inspired experience.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/youtube-freemium/pgafgbgnfoiookabcmhjeajkfmmbipnm)
[![Microsoft Edge Add-ons](https://img.shields.io/badge/Microsoft_Edge-Available-0078D7?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/youtube-freemium/cbfhicomoandphidakponcnjeabiofmo)

---

## Download & Installation

Install the extension directly from the official web stores:

- **Chrome Web Store**: [YouTube Freemium on Chrome Web Store](https://chromewebstore.google.com/detail/youtube-freemium/pgafgbgnfoiookabcmhjeajkfmmbipnm)
- **Microsoft Edge Add-ons**: [YouTube Freemium on Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/youtube-freemium/cbfhicomoandphidakponcnjeabiofmo)

---

## Features

- **Apple Music–Style Lyrics**: Beautiful real-time time-synced lyrics with ambient animated background effects.
- **Word-by-Word Synchronization**: Karaoke-style word highlighting for supported tracks.
- **Interactive Header Search**: Search any song or artist directly from the lyrics panel with floating search results and automatic duration matching.
- **Customizable Typography**: Persistent font size controls (14px – 36px) across reloads and new tabs.
- **Smart Collapse & Sync**: Collapsible panel that instantly snaps to and highlights the lyric matching the current video timestamp upon opening.
- **Distraction-Free**: Optional Shorts hiding and profanity filtering.

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

Builds production-ready code into `out/release/` by safely stripping comments (`//` and `/* ... */`), removing `console.log` statements, minifying CSS/JSON, and verifying JavaScript syntax.

#### macOS / Linux

```bash
# Configure build with version (e.g., 3.0.0)
cmake -DVERSION=3.0.0 .

# Build and package release zip
make package_release
```

> **Tip:** Run `make release` if you only want to generate the unpacked folder in `out/release/` without creating a zip.

#### Windows

```cmd
# Configure build
cmake -S . -B build -G "Ninja" -DVERSION=3.0.0

# Build and package release zip
cmake --build build --target package_release
```

#### Direct Script (without CMake)

```bash
node scripts/build-release.js
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
cmake -DVERSION=3.0.0 .
make extension
```

#### Windows

```cmd
cmake -S . -B build -G "Ninja" -DVERSION=3.0.0
cmake --build build --target package_and_print
```

---

## Loading Unpacked Extension in Browser

1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
2. Enable **Developer mode** in the top-right corner.
3. Either:
   - Drag and drop the generated `.zip` file from `out/Chrome_Edge/`.
   - Or click **Load unpacked** and select `out/release/` (for production) or `src/` (for development).

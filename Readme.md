<h1>Youtube Freemium</h1>

Enable lyrics and enhanced music playback features for YouTube.

---

## Prerequisites

- **CMake** (v3.10+)
- **Node.js** (v18+)
- *(Windows only)* **Ninja** build system

---

## Build Steps

### 1. Release Build (Clean, No Obfuscation)

Builds production-ready code into `out/release/` by safely stripping comments (`//` and `/* ... */`), removing `console.log` statements, minifying CSS/JSON, and verifying JavaScript syntax.

#### macOS / Linux

```bash
# Configure build with version (e.g., 2.5.0)
cmake -DVERSION=2.5.0 .

# Build and package release zip
make package_release
```

> **Tip:** Run `make release` if you only want to generate the unpacked folder in `out/release/` without creating a zip.

#### Windows

```cmd
# Configure build
cmake -S . -B build -G "Ninja" -DVERSION=2.5.0

# Build and package release zip
cmake --build build --target package_release
```

#### Direct (without CMake)

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
cmake -DVERSION=2.5.0 .
make extension
```

#### Windows

```cmd
cmake -S . -B build -G "Ninja" -DVERSION=2.5.0
cmake --build build --target package_and_print
```

---

## Installing the Extension

1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
2. Enable **Developer mode** in the top right corner.
3. Either:
   - Drag and drop the generated `.zip` file from `out/Chrome_Edge/`.
   - Or click **Load unpacked** and select `out/release/` (for production) or `src/` (for development).

---

### 2. Development Build

Packs raw source files directly from `src/` without modification.

#### macOS / Linux

```bash
cmake -DVERSION=2.5.0 .
make extension
```

#### Windows

```cmd
cmake -S . -B build -G "Ninja" -DVERSION=2.5.0
cmake --build build --target package_and_print
```

---

## Installing the Extension

1. Open `chrome://extensions` (or `edge://extensions`) in your browser.
2. Enable **Developer mode** in the top right corner.
3. Either:
   - Drag and drop the generated `.zip` file from `out/Chrome_Edge/`.
   - Or click **Load unpacked** and select `out/release/` (for production) or `src/` (for development).


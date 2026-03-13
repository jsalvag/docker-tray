# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the app in development
npm start

# Build a portable Windows executable (outputs DockerTray.exe)
npm run build

# Build to directory (faster, no installer)
npm run build:dir
```

## Architecture

This is an Electron app that monitors Docker containers from the Windows system tray.

**Process model:**
- `src/main.js` — Main process. Creates the tray icon, manages the `BrowserWindow`, communicates with Docker via `dockerode`, and handles IPC. Uses named pipe `//./pipe/docker_engine` on Windows.
- `src/preload.js` — Preload script with `contextBridge` that exposes `window.electronAPI` to the renderer. The bridge exposes `getContainers`, `toggleContainer`, and `onContainersUpdated`.
- `src/index.html` — Renderer process (single file, inline CSS + JS). Communicates with main only through `window.electronAPI`.

**IPC channels:**
- `get-containers` (invoke) → fetches and returns current container list
- `toggle-container` (invoke, arg: containerId) → starts or stops a container
- `containers-updated` (push from main) → sent after any state change

**Window behavior:** The popup window is frameless, always-on-top, positioned bottom-right. It auto-hides on blur and is shown/hidden via tray click. Only one instance is allowed (`requestSingleInstanceLock`).

**Logging:** Appended to a log file at `app.getPath('userData')/docker-tray.log`.

**Build output:** `npm run build` produces `DockerTray.exe` (portable, no install required) via `electron-builder`.

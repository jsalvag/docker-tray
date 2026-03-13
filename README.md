# 🐳 Docker Tray

A lightweight Windows system tray application for managing Docker containers. Monitor, start, stop, and hide containers directly from your taskbar without opening Docker Desktop.

## ✨ Features

- **Quick Access**: View all Docker containers in the system tray
- **Container Management**: Start/Stop containers with one click
- **View Logs**: Read container logs in a modal dialog
- **Multi-Select**: Select multiple containers and hide them in bulk
- **Persistent Filtering**: Hide containers by name and remember your preferences across restarts
- **Minimal UI**: Clean, distraction-free interface with just the essentials
- **Status Indicators**: Visual indicators for running, stopped, and exited containers
- **Auto-Refresh**: Containers list updates automatically every 10 seconds

## 🚀 Installation

### Option 1: Download Executable (Easiest)

1. Go to [Releases](https://github.com/jsalvag/docker-tray/releases)
2. Download the latest `DockerTray.exe`
3. Run it - no installation needed, it's portable

### Option 2: Build from Source

Requirements:
- Node.js 16+ and npm
- Docker running on your system

```bash
# Clone the repository
git clone https://github.com/jsalvag/docker-tray.git
cd docker-tray

# Install dependencies
npm install

# Run in development mode
npm start

# Build executable
npm run build
# Output: dist/DockerTray.exe
```

## 📖 Usage

1. **Launch** the app (it runs in system tray)
2. **Click the tray icon** to open the container list
3. **Interact with containers**:
   - Click a container to select/deselect it
   - Click the menu button (⋮) for options:
     - Start/Stop container
     - View logs
     - Hide container
   - Use toolbar to Select all, Clear selection, or Hide selected

4. **Filter containers**: Type in the search box to filter by name

5. **Hidden containers**: Click "Ocultar" or "Hide" to exclude containers from view (persists across restarts)

## 🛠️ Development

### Project Structure

```
src/
├── main.js          # Electron main process, Docker integration
├── preload.js       # IPC bridge exposing safe APIs to renderer
└── index.html       # UI (renderer process), all CSS and JS inline
```

### Available Scripts

```bash
npm start           # Run in development
npm run build       # Build Windows executable
npm run build:dir   # Build to directory (faster)
```

### Architecture

- **Process Model**: Main process (Node.js) communicates with Docker via `dockerode`
- **IPC Channels**:
  - `get-containers` - Fetch container list
  - `toggle-container` - Start/stop a container
  - `get-hidden-containers` - Retrieve hidden containers list
  - `add-to-hidden` / `remove-from-hidden` - Manage hidden containers
  - `get-container-logs` - Fetch container logs
- **Storage**: Configuration stored in `%APPDATA%/docker-tray/` with electron-store
- **Window**: Frameless, always-on-top popup with auto-hide on blur

## 📋 Requirements

- Windows 10+
- Docker Desktop or Docker Engine running
- ~150MB disk space (for portable .exe)

## 🔧 Configuration

Hidden containers and preferences are stored in:
```
%APPDATA%\docker-tray\docker-tray-config.json
```

Delete this file to reset to defaults.

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

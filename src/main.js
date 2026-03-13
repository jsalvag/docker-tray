const { app, Tray, Menu, nativeImage, ipcMain, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');
const Store = require('electron-store');

const logFile = path.join(app.getPath('userData'), 'docker-tray.log');

function log(...args) {
  const msg = new Date().toISOString() + ' ' + args.join(' ');
  console.log(msg);
  try {
    fs.appendFileSync(logFile, msg + '\n');
  } catch {}
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let tray = null;
let docker = null;
let containers = [];
let mainWindow = null;
const store = new Store({ name: 'docker-tray-config' });

function getDocker() {
  if (!docker) {
    const dockerHost = process.env.DOCKER_HOST;
    if (dockerHost && dockerHost.startsWith('npipe://')) {
      docker = new Docker({ 
        socketPath: '//./pipe/docker_engine',
        timeout: 5000
      });
    } else if (process.platform === 'win32') {
      docker = new Docker({ 
        socketPath: '//./pipe/docker_engine',
        timeout: 5000
      });
    } else {
      docker = new Docker();
    }
  }
  return docker;
}

async function getContainers() {
  log('Getting containers, DOCKER_HOST:', process.env.DOCKER_HOST);
  let lastError = null;
  for (let i = 0; i < 3; i++) {
    try {
      const docker = getDocker();
      log('Docker instance created, pinging...');
      await docker.ping();
      log('Docker ping successful');
      const containerList = await docker.listContainers({ all: true });
      log('Containers found:', containerList.length);
      return containerList.map(c => ({
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, '') || 'unnamed',
        status: c.State,
        image: c.Image,
        ports: c.Ports
      }));
    } catch (err) {
      lastError = err;
      log('Docker attempt', i + 1, 'error:', err.message);
      if (i < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError || new Error('Failed to connect to Docker');
}

function createTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4, 0);

  // Draw a simple Docker whale icon (blue #2496ED on transparent)
  const B = [0x24, 0x96, 0xED, 0xFF]; // Docker blue
  const W = [0xFF, 0xFF, 0xFF, 0xFF]; // White
  const T = [0, 0, 0, 0];             // Transparent

  // 16x16 pixel art: simplified whale with containers
  const pixels = [
    //0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T], // 0
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T], // 1
    [T, T, T, W, T, W, T, W, T, T, T, T, T, T, T, T], // 2
    [T, T, W, W, W, W, W, W, W, T, T, T, T, T, T, T], // 3
    [T, T, W, B, W, B, W, B, W, T, T, T, T, T, T, T], // 4
    [T, T, W, W, W, W, W, W, W, T, T, T, T, T, T, T], // 5
    [T, T, W, B, W, B, W, B, W, T, T, T, T, T, T, T], // 6
    [T, B, W, W, W, W, W, W, W, W, B, B, B, T, T, T], // 7
    [T, B, B, B, B, B, B, B, B, B, B, B, B, B, T, T], // 8
    [T, T, B, B, B, B, B, B, B, B, B, B, B, T, T, T], // 9
    [T, T, T, B, B, B, B, B, B, B, B, B, T, T, T, T], // 10
    [T, T, T, T, B, B, B, B, B, B, B, T, T, T, T, T], // 11
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T], // 12
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T], // 13
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T], // 14
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T], // 15
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const color = pixels[y][x];
      buf[offset] = color[0];     // R
      buf[offset + 1] = color[1]; // G
      buf[offset + 2] = color[2]; // B
      buf[offset + 3] = color[3]; // A
    }
  }

  try {
    return nativeImage.createFromBuffer(buf, { width: size, height: size });
  } catch {
    return nativeImage.createEmpty();
  }
}

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 350,
    height: 450,
    x: screenWidth - 370,
    y: screenHeight - 500,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function updateTray() {
  containers = await getContainers();
  
  const runningCount = containers.filter(c => c.status === 'running').length;
  
  if (tray) {
    tray.setToolTip(`Docker: ${runningCount} running`);
  }
}

async function toggleContainer(container) {
  try {
    const docker = getDocker();
    const c = docker.getContainer(container.id);
    
    if (container.status === 'running') {
      await c.stop();
    } else {
      await c.start();
    }
    
    await updateTray();
    
    if (mainWindow) {
      mainWindow.webContents.send('containers-updated', containers);
    }
  } catch (err) {
    log('Error toggling container:', err.message);
  }
}

async function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  
  tray.setToolTip('Docker Tray');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: createWindow },
    { type: 'separator' },
    { label: 'Refresh', click: updateTray },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on('click', createWindow);
  
  await updateTray();
  
  setInterval(updateTray, 10000);
}

app.whenReady().then(createTray);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createTray();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('get-containers', async () => {
  await updateTray();
  return containers;
});

ipcMain.handle('toggle-container', async (event, containerId) => {
  const container = containers.find(c => c.id === containerId);
  if (container) {
    await toggleContainer(container);
  }
  return containers;
});

ipcMain.handle('get-hidden-containers', () => {
  return store.get('hiddenContainers', []);
});

ipcMain.handle('add-to-hidden', (event, containerId) => {
  const hidden = store.get('hiddenContainers', []);
  if (!hidden.includes(containerId)) {
    hidden.push(containerId);
    store.set('hiddenContainers', hidden);
    log('Container hidden:', containerId);
  }
  return hidden;
});

ipcMain.handle('remove-from-hidden', (event, containerId) => {
  const hidden = store.get('hiddenContainers', []);
  const index = hidden.indexOf(containerId);
  if (index > -1) {
    hidden.splice(index, 1);
    store.set('hiddenContainers', hidden);
    log('Container unhidden:', containerId);
  }
  return hidden;
});

ipcMain.handle('get-container-logs', async (event, containerId) => {
  try {
    const docker = getDocker();
    const container = docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100
    });
    return logs.toString();
  } catch (err) {
    log('Error getting logs:', err.message);
    return 'Error: ' + err.message;
  }
});

const { app, Tray, Menu, nativeImage, ipcMain, BrowserWindow, screen } = require('electron');
const path = require('path');
const Docker = require('dockerode');

let tray = null;
let docker = null;
let containers = [];
let mainWindow = null;

function getDocker() {
  if (!docker) {
    docker = new Docker();
  }
  return docker;
}

async function getContainers() {
  try {
    const docker = getDocker();
    const containerList = await docker.listContainers({ all: true });
    return containerList.map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || 'unnamed',
      status: c.State,
      image: c.Image,
      ports: c.Ports
    }));
  } catch (err) {
    console.error('Docker error:', err.message);
    return [];
  }
}

function createTrayIcon() {
  const iconPath = path.join(__dirname, 'icon.png');
  let icon;
  
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }
  
  return icon;
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
    show: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
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
    console.error('Error toggling container:', err.message);
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

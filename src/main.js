const { app, Tray, Menu, nativeImage, ipcMain, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');

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
  const iconBase64 = `iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKxSURBVFiF7ZdNaBNBGIbfmd1NNtlNYpqmrVpbW6u2ilZRUPEgHkQQvAheBBE8eBXxJF68eBIPIkQQvHnz4kUQPAgiIIKAIq2t1to0aWKaTZpkM+PuDAlZNptNcofCfzYzO+95n/d5z/sC/zcig8FgMBgMBoPB8N/AMC0Gg8FgMBgMBoPBYDAY/jei0SiapiHLMqlUinA4jNfr/er+yWSScDhMLBYjEAhQXFz8xZjRaJRQKEQkEsHv91NYWPjFmMlkklAoRDgcxu/3U1hY+MWYaDRKKBSiqKiIwsJCCgsLKRQKlEolSqUSpVKJUqlEqVSiVCpRKpUolUqUSiVKpRKlUolSqUSlUlEoFCgUChQKBUqlEqVSSaFQoFAoUCgUKBQKFAoFCoUChUKBQqFAoVCgUChQKBQoFAoUCgUKhQKFQoFCoUChUKBQKFAoFCgUChQKBQqFApVKRT6fJZfLkcvlyGazZLNZstks2WyWTCZDJpMhk8mQzWZJp9Ok02nS6TSpVIpUKkUymSSRSJBIJEgkEsTjceLxOLFYTGrx4x+p1+t1ut1u/X4/4XBYvwxJklxJkhxA2wHqANoAugB6ATYBdAP0APQC9AP0AwwADAMMA4wAjAKMAowBjAOMh+V3A3wA4AcEfwIQAPgBgB8Q/A0gCPABgD8A+AMgBVACJElSpFarpalUqlgqlSoWi8ViqVCoJBKJBJFIRBKJRIJIJCJFIpFIEIlEJBKJBJFIRBKJRBKJRCQSiUQikUgkEolEIpFIJBKJRCKRSCQSiUQikUgkEolEIpFIJBKJRCKRSCQSiUQikUgkEolEIpFIJBKJRCKRSCQSiUQikUgkEolEIpFIJBKJRCKRSCQSiUQikUgkEolEIpFIJBKJRCKRSCQSiUQikUgkEolEIpFIJBKJRCKRSCR+AP4A6xVgjqUAAAAASUVORK5CYII=`;
  
  try {
    return nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getContainers: () => ipcRenderer.invoke('get-containers'),
  toggleContainer: (id) => ipcRenderer.invoke('toggle-container', id),
  onContainersUpdated: (callback) => {
    ipcRenderer.on('containers-updated', (event, containers) => callback(containers));
  }
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getContainers: () => ipcRenderer.invoke('get-containers'),
  toggleContainer: (id) => ipcRenderer.invoke('toggle-container', id),
  getHiddenContainers: () => ipcRenderer.invoke('get-hidden-containers'),
  addToHidden: (id) => ipcRenderer.invoke('add-to-hidden', id),
  removeFromHidden: (id) => ipcRenderer.invoke('remove-from-hidden', id),
  getContainerLogs: (id) => ipcRenderer.invoke('get-container-logs', id),
  onContainersUpdated: (callback) => {
    ipcRenderer.on('containers-updated', (event, containers) => callback(containers));
  }
});

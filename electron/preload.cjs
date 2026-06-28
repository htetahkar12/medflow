const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMachineId: () => ipcRenderer.invoke('get-machine-uuid'),
  getMachineUuid: () => ipcRenderer.invoke('get-machine-uuid')
});

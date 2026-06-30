const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: (options) => ipcRenderer.invoke("dialog:openFile", options),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});

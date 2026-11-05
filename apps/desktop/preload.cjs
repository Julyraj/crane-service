const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cranego", {
  getConfig: () => ipcRenderer.invoke("cranego:get-config"),
  saveConfig: (cfg) => ipcRenderer.invoke("cranego:save-config", cfg),
  retry: () => ipcRenderer.invoke("cranego:retry"),
});

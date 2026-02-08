"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Store operations
    storeGet: (key) => electron_1.ipcRenderer.invoke('store-get', key),
    storeSet: (key, value) => electron_1.ipcRenderer.invoke('store-set', key, value),
    storeDelete: (key) => electron_1.ipcRenderer.invoke('store-delete', key),
    // File operations
    selectImage: () => electron_1.ipcRenderer.invoke('select-image'),
    exportPrompts: (data) => electron_1.ipcRenderer.invoke('export-prompts', data),
    importPrompts: () => electron_1.ipcRenderer.invoke('import-prompts'),
    // Network operations
    proxyFetch: (url, options) => electron_1.ipcRenderer.invoke('proxy-fetch', url, options),
});

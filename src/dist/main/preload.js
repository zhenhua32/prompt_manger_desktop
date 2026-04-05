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
    saveImage: (imageSource) => electron_1.ipcRenderer.invoke('save-image', imageSource),
    exportPrompts: (data) => electron_1.ipcRenderer.invoke('export-prompts', data),
    importPrompts: () => electron_1.ipcRenderer.invoke('import-prompts'),
    // Image file storage (base64 → local file → app-image:// ref)
    storeImageFile: (dataUrl) => electron_1.ipcRenderer.invoke('store-image-file', dataUrl),
    deleteImageFile: (imageRef) => electron_1.ipcRenderer.invoke('delete-image-file', imageRef),
    openImagesFolder: () => electron_1.ipcRenderer.invoke('open-images-folder'),
    // Network operations
    proxyFetch: (url, options) => electron_1.ipcRenderer.invoke('proxy-fetch', url, options),
});

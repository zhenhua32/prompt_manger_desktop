import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Store operations
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store-set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store-delete', key),
  
  // File operations
  selectImage: () => ipcRenderer.invoke('select-image'),
  exportPrompts: (data: string) => ipcRenderer.invoke('export-prompts', data),
  importPrompts: () => ipcRenderer.invoke('import-prompts'),
  
  // Network operations
  proxyFetch: (url: string, options: any) => ipcRenderer.invoke('proxy-fetch', url, options),
});

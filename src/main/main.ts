import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import Store from 'electron-store';

const store = new Store();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1f2937'
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for data persistence
ipcMain.handle('store-get', (_, key: string) => {
  return store.get(key);
});

ipcMain.handle('store-set', (_, key: string, value: any) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-delete', (_, key: string) => {
  store.delete(key);
  return true;
});

// File dialog for image selection - convert to base64 data URL
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const fs = require('fs');
    const filePath = result.filePaths[0];
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const imageBuffer = fs.readFileSync(filePath);
    const base64 = imageBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }
  return null;
});

// Save image to local file
ipcMain.handle('save-image', async (_, imageSource: string) => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
      { name: 'WebP Image', extensions: ['webp'] },
    ]
  });

  if (result.canceled || !result.filePath) return false;

  const fs = require('fs');
  try {
    if (imageSource.startsWith('data:')) {
      const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
    } else {
      const response = await fetch(imageSource);
      if (!response.ok) return false;
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(result.filePath, buffer);
    }
    return true;
  } catch {
    return false;
  }
});

// Export prompts to file
ipcMain.handle('export-prompts', async (_, data: string) => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    const fs = require('fs');
    fs.writeFileSync(result.filePath, data, 'utf-8');
    return true;
  }
  return false;
});

// Import prompts from file
ipcMain.handle('import-prompts', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const fs = require('fs');
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(data);
  }
  return null;
});

// Proxy fetch request to bypass CORS
ipcMain.handle('proxy-fetch', async (_, url: string, options: any) => {
  try {
    const response = await fetch(url, options);
    
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.startsWith('image/')) {
      // Return image as base64 data URL
      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = contentType.split(';')[0].trim();
      data = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else {
      data = await response.text();
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: data
    };
  } catch (error: any) {
    console.error('Proxy fetch error:', error);
    return {
      ok: false,
      status: 0,
      statusText: error.message || 'Network Error',
      data: null
    };
  }
});

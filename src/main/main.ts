import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { pathToFileURL } from 'url';
import Store from 'electron-store';

const store = new Store();

let mainWindow: BrowserWindow | null = null;
let imagesDir: string;

// Register custom protocol scheme BEFORE app.ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-image', privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

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

app.whenReady().then(() => {
  // Initialize images directory
  imagesDir = path.join(app.getPath('userData'), 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Register protocol handler to serve local images
  protocol.handle('app-image', (request) => {
    const filename = decodeURIComponent(request.url.replace('app-image://', ''));
    const filePath = path.join(imagesDir, path.basename(filename));
    // Security: ensure resolved path is within imagesDir
    if (!path.resolve(filePath).startsWith(path.resolve(imagesDir))) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).href);
  });

  createWindow();
});

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

// File dialog for image selection - save to local file, return app-image:// ref
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const ext = (filePath.split('.').pop()?.toLowerCase() || 'png').replace('jpeg', 'jpg');
    const filename = `${crypto.randomUUID()}.${ext}`;
    const destPath = path.join(imagesDir, filename);
    fs.copyFileSync(filePath, destPath);
    return `app-image://${filename}`;
  }
  return null;
});

// Store a base64 data URL or download a remote URL to local file
ipcMain.handle('store-image-file', async (_, dataUrl: string) => {
  if (!dataUrl) return null;

  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
    if (!match) return null;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(match[2], 'base64'));
    return `app-image://${filename}`;
  }

  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/png';
      const ext = (contentType.split('/')[1]?.split(';')[0] || 'png').replace('jpeg', 'jpg');
      const filename = `${crypto.randomUUID()}.${ext}`;
      fs.writeFileSync(path.join(imagesDir, filename), buffer);
      return `app-image://${filename}`;
    } catch {
      return null;
    }
  }

  return null;
});

// Delete a stored image file
ipcMain.handle('delete-image-file', async (_, imageRef: string) => {
  if (!imageRef || !imageRef.startsWith('app-image://')) return false;
  const filename = path.basename(imageRef.replace('app-image://', ''));
  const filePath = path.join(imagesDir, filename);
  if (!path.resolve(filePath).startsWith(path.resolve(imagesDir))) return false;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
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

  try {
    if (imageSource.startsWith('data:')) {
      const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
    } else if (imageSource.startsWith('app-image://')) {
      // Copy from our local store
      const filename = path.basename(imageSource.replace('app-image://', ''));
      const srcPath = path.join(imagesDir, filename);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, result.filePath);
      } else {
        return false;
      }
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

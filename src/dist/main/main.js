"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const url_1 = require("url");
const electron_store_1 = __importDefault(require("electron-store"));
const store = new electron_store_1.default();
let mainWindow = null;
let imagesDir;
// Register custom protocol scheme BEFORE app.ready
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'app-image', privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } }
]);
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    // Initialize images directory
    imagesDir = path.join(electron_1.app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
    // Register protocol handler to serve local images
    electron_1.protocol.handle('app-image', (request) => {
        const filename = decodeURIComponent(request.url.replace('app-image://', ''));
        const filePath = path.join(imagesDir, path.basename(filename));
        // Security: ensure resolved path is within imagesDir
        if (!path.resolve(filePath).startsWith(path.resolve(imagesDir))) {
            return new Response('Forbidden', { status: 403 });
        }
        return electron_1.net.fetch((0, url_1.pathToFileURL)(filePath).href);
    });
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// IPC handlers for data persistence
electron_1.ipcMain.handle('store-get', (_, key) => {
    return store.get(key);
});
electron_1.ipcMain.handle('store-set', (_, key, value) => {
    store.set(key, value);
    return true;
});
electron_1.ipcMain.handle('store-delete', (_, key) => {
    store.delete(key);
    return true;
});
// File dialog for image selection - save to local file, return app-image:// ref
electron_1.ipcMain.handle('select-image', async () => {
    const result = await electron_1.dialog.showOpenDialog({
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
electron_1.ipcMain.handle('store-image-file', async (_, dataUrl) => {
    if (!dataUrl)
        return null;
    if (dataUrl.startsWith('data:')) {
        const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
        if (!match)
            return null;
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const filename = `${crypto.randomUUID()}.${ext}`;
        fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(match[2], 'base64'));
        return `app-image://${filename}`;
    }
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok)
                return null;
            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType = response.headers.get('content-type') || 'image/png';
            const ext = (contentType.split('/')[1]?.split(';')[0] || 'png').replace('jpeg', 'jpg');
            const filename = `${crypto.randomUUID()}.${ext}`;
            fs.writeFileSync(path.join(imagesDir, filename), buffer);
            return `app-image://${filename}`;
        }
        catch {
            return null;
        }
    }
    return null;
});
// Delete a stored image file
electron_1.ipcMain.handle('delete-image-file', async (_, imageRef) => {
    if (!imageRef || !imageRef.startsWith('app-image://'))
        return false;
    const filename = path.basename(imageRef.replace('app-image://', ''));
    const filePath = path.join(imagesDir, filename);
    if (!path.resolve(filePath).startsWith(path.resolve(imagesDir)))
        return false;
    try {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
        return true;
    }
    catch {
        return false;
    }
});
// Open images folder in system file explorer
electron_1.ipcMain.handle('open-images-folder', async () => {
    electron_1.shell.openPath(imagesDir);
});
// Save image to local file
electron_1.ipcMain.handle('save-image', async (_, imageSource) => {
    const result = await electron_1.dialog.showSaveDialog({
        filters: [
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
            { name: 'WebP Image', extensions: ['webp'] },
        ]
    });
    if (result.canceled || !result.filePath)
        return false;
    try {
        if (imageSource.startsWith('data:')) {
            const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
        }
        else if (imageSource.startsWith('app-image://')) {
            // Copy from our local store
            const filename = path.basename(imageSource.replace('app-image://', ''));
            const srcPath = path.join(imagesDir, filename);
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, result.filePath);
            }
            else {
                return false;
            }
        }
        else {
            const response = await fetch(imageSource);
            if (!response.ok)
                return false;
            const buffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(result.filePath, buffer);
        }
        return true;
    }
    catch {
        return false;
    }
});
// Helper: read an app-image:// ref back as a data URL
function appImageToDataUrl(imageRef) {
    if (!imageRef || !imageRef.startsWith('app-image://'))
        return null;
    const filename = path.basename(imageRef.replace('app-image://', ''));
    const filePath = path.join(imagesDir, filename);
    if (!path.resolve(filePath).startsWith(path.resolve(imagesDir)))
        return null;
    try {
        if (!fs.existsSync(filePath))
            return null;
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filename).replace('.', '').toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
        return `data:${mime};base64,${buf.toString('base64')}`;
    }
    catch {
        return null;
    }
}
// Helper: save a base64 data URL to images dir, return app-image:// ref
function dataUrlToAppImage(dataUrl) {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
    if (!match)
        return null;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `${crypto.randomUUID()}.${ext}`;
    try {
        fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(match[2], 'base64'));
        return `app-image://${filename}`;
    }
    catch {
        return null;
    }
}
// Export prompts to file (convert app-image:// refs to embedded base64)
electron_1.ipcMain.handle('export-prompts', async (_, data) => {
    const result = await electron_1.dialog.showSaveDialog({
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    });
    if (!result.canceled && result.filePath) {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed.prompts)) {
                for (const p of parsed.prompts) {
                    if (p.previewImage?.startsWith('app-image://')) {
                        p.previewImage = appImageToDataUrl(p.previewImage) || p.previewImage;
                    }
                    if (p.referenceImage?.startsWith('app-image://')) {
                        p.referenceImage = appImageToDataUrl(p.referenceImage) || p.referenceImage;
                    }
                }
            }
            fs.writeFileSync(result.filePath, JSON.stringify(parsed, null, 2), 'utf-8');
        }
        catch {
            fs.writeFileSync(result.filePath, data, 'utf-8');
        }
        return true;
    }
    return false;
});
// Import prompts from file (convert embedded base64 images to app-image:// refs)
electron_1.ipcMain.handle('import-prompts', async () => {
    const result = await electron_1.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.prompts)) {
            for (const p of parsed.prompts) {
                if (p.previewImage?.startsWith('data:image/')) {
                    p.previewImage = dataUrlToAppImage(p.previewImage) || p.previewImage;
                }
                if (p.referenceImage?.startsWith('data:image/')) {
                    p.referenceImage = dataUrlToAppImage(p.referenceImage) || p.referenceImage;
                }
            }
        }
        return parsed;
    }
    return null;
});
// Proxy fetch request to bypass CORS
electron_1.ipcMain.handle('proxy-fetch', async (_, url, options) => {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
            data = await response.json();
        }
        else if (contentType.startsWith('image/')) {
            // Return image as base64 data URL
            const buffer = Buffer.from(await response.arrayBuffer());
            const mimeType = contentType.split(';')[0].trim();
            data = `data:${mimeType};base64,${buffer.toString('base64')}`;
        }
        else {
            data = await response.text();
        }
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            data: data
        };
    }
    catch (error) {
        console.error('Proxy fetch error:', error);
        return {
            ok: false,
            status: 0,
            statusText: error.message || 'Network Error',
            data: null
        };
    }
});

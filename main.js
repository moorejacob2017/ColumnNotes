// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;
let fileSelectionWindow;

// Utility to create a new BrowserWindow
function createWindow(options, loadFile, devTools = false) {
    const win = new BrowserWindow(options);
    win.loadFile(loadFile);

    if (!options.webPreferences?.nodeIntegration) {
        win.setMenu(null); // Hide toolbar
    }

    if (devTools) {
        win.webContents.openDevTools();
    }

    win.on('closed', () => {
        if (win === fileSelectionWindow) fileSelectionWindow = null;
        if (win === mainWindow) mainWindow = null;
    });

    return win;
}

// Create the file selection window
function createFileSelectionWindow() {
    if (fileSelectionWindow) {
        fileSelectionWindow.focus();
        return;
    }

    fileSelectionWindow = createWindow(
        {
            width: 375,
            height: 160,
            icon: path.join(__dirname, 'icons/icon.png'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: true,
            },
        },
        'file_selection.html',
        false // Dev Panel
    );

    fileSelectionWindow.setMenu(null);
}

// Create the main editing window
function createEditingWindow(filePath = null) {
    if (mainWindow) {
        mainWindow.focus();
        return;
    }

    mainWindow = createWindow(
        {
            width: 800,
            height: 600,
            icon: path.join(__dirname, 'icon.png'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: true,
            },
        },
        'index.html',
        false // Dev Panel
    );

    mainWindow.setMenu(null);

    mainWindow.webContents.once('did-finish-load', () => {
        if (filePath) {
            mainWindow.webContents.send('file-path-selected', filePath);
        }
    });
}

// IPC Handlers
ipcMain.on('open-file-selection', createFileSelectionWindow);

ipcMain.on('file-selected', (_, filePath) => {
    createEditingWindow(filePath);
    if (fileSelectionWindow) fileSelectionWindow.close();
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Notebook Files', extensions: ['cnb'] }]
    });
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

ipcMain.handle('create-new-file', async () => {
    const result = await dialog.showSaveDialog({
        title: 'Create New File',
        defaultPath: path.join(app.getPath('documents'), 'NewNotebook.cnb'),
        filters: [{ name: 'Notebook Files', extensions: ['cnb'] }],
    });

    if (!result.canceled && result.filePath) {
        createEditingWindow();
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('initialize-new-file', result.filePath);
        });
        return result.filePath;
    }
    return null;
});

// App Lifecycle
app.whenReady().then(createFileSelectionWindow);

app.on('activate', () => {
    if (!fileSelectionWindow && !mainWindow) createFileSelectionWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

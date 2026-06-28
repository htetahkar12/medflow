const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

function createWindow() {
  const resIcon = path.join(process.resourcesPath, 'icon.ico');
  const iconPath = fs.existsSync(resIcon)
    ? resIcon
    : (fs.existsSync(path.join(__dirname, 'icon.ico')) ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'logo.png'));

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    title: "Medflow Clinic",
    icon: iconPath
  });

  // Remove default menu bar
  mainWindow.removeMenu();

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Motherboard UUID retrieval
ipcMain.handle('get-machine-uuid', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('powershell -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', (err, stdout) => {
        if (err || !stdout.trim()) {
          // Fallback to macaddress/wmic if Get-CimInstance fails
          exec('wmic csproduct get uuid', (err2, stdout2) => {
            if (err2) {
              resolve('unknown-windows-uuid');
            } else {
              const lines = stdout2.trim().split('\n');
              resolve(lines.length > 1 ? lines[1].trim() : 'unknown-windows-uuid');
            }
          });
        } else {
          resolve(stdout.trim());
        }
      });
    } else {
      resolve('non-windows-machine');
    }
  });
});

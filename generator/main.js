
const {app, BrowserWindow, BrowserView, ipcMain} = require('electron');
const electronLocalshortcut = require('electron-localshortcut');
const fs = require('fs');
const env = require('./env.js');

let win;

function createWindow() {
  win = new BrowserWindow({
    title: 'Card Generator',
    width: 595,
    height: 854,
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      devTools: true,
      zoomFactor: 0.8
    }
  });
  win.setMenu(null);
  win.webContents.session.clearCache(() => {});
  win.webContents.loadFile('cards.html');

  ipcMain.handle('render', async (event, path, width, height, split) => {
    return await capture(path, width, height, split);
  })

  electronLocalshortcut.register(win, 'Ctrl+Shift+I', () => {
    if (env.release) {
      win.webContents.toggleDevTools();
    } else {
      win.setBounds({x: 0, y: 0, width: 700, height: 500});
      win.webContents.openDevTools();
    }
  });

  electronLocalshortcut.register(win, 'H', () => {
    if (win.getBrowserView()) win.setBrowserView(null)
    else win.setBrowserView(view);
  });

  win.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  win.on('closed', () => {
    win = null;
  });
}

function capture(path, width, height, split) {
  const zoomFactor = win.webContents.zoomFactor;
  win.webContents.zoomFactor = 1.0;

  const initialSize = win.getSize();
  win.setContentSize(parseInt(width), parseInt(height));
  win.webContents.capturePage().then(data => {
    fs.writeFile(path, data.toPNG(), (error) => {
      if (error) throw error;
      console.log('image saved');

      if (!split) {
        win.webContents.send('saved');
        return;
      }

      // split image
      const sharp = require('sharp');
      const originalImage = path;
      const ext = path.substr(path.lastIndexOf('.'));
      let doneCount = 0;
      for (let r = 0; r < 2; r++){
        for(let c = 0; c < 3; c++) {
          const outputImage = originalImage.replace(ext, `-${r * 3 + c + 1}${ext}`);
          sharp(originalImage)
            .resize(parseInt(width), parseInt(height))
            .extract({ width: 744 * 3, height: 1038 * 3, left: 744 * 3 * c, top: 1038 * 3 * r })
            .extend({ top: 197, bottom: 197, left: 124, right: 124, background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .toFile(outputImage)
            .then(function(new_file_info) {
              console.log("Image cropped and saved: " + outputImage);
            })
            .catch(function(err) {
              console.log("An error occured");
            })
            .finally(function() {
              if (++doneCount == 6) {
                win.webContents.send('saved');
              }
            });
        }
      }
    });
  }).catch(error => {
    console.log(error)
  });;
  win.setSize(initialSize[0], initialSize[1]);

  win.webContents.zoomFactor = zoomFactor;
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // support macOS standard to keep application running until quit explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // support macOS standard to open a new window when none is present
  if (win === null) {
    createWindow();
  }
});

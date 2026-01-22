const { app, BrowserWindow, ipcMain, nativeTheme, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');

const botRestituicao = require('../backend/bots/restituicao-fianca');
const profiles = require('../../config/profiles.json');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.loadFile(path.join(__dirname, '../frontend/index.html'));
  win.webContents.openDevTools(); // Descomente para debug
  win.removeMenu()
}

ipcMain.handle('dark-mode:toggle', () => {
  if (nativeTheme.shouldUseDarkColors) {
    nativeTheme.themeSource = 'light'
  } else {
    nativeTheme.themeSource = 'dark'
  }
  return nativeTheme.shouldUseDarkColors
})

ipcMain.handle('dark-mode:system', () => {
  nativeTheme.themeSource = 'system'
})

app.whenReady().then(() => {
  // 1. Handler para Selecionar Arquivo
  ipcMain.handle('dialog:openFile', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });
      if (canceled) return null;
      return filePaths[0];
  });

  // 2. Handler para Iniciar o Bot
  ipcMain.handle('bot:iniciar', async (event, dadosExecucao) => {
      const { perfilId, caminhoArquivo } = dadosExecucao;
      
      // Encontra a configuração do perfil selecionado
      const configPerfil = profiles.perfis.find(p => p.id === perfilId);
      const dirSaida = profiles.diretorio_saida_padrao;

      if (!configPerfil) return { sucesso: false, erro: 'Perfil não encontrado' };

      // Função de callback para enviar logs para a janela
      const enviarLog = (mensagem) => {
          event.sender.send('bot:log', mensagem);
      };

      // Roda o Bot
      if (perfilId === 'restituicao-fianca') {
          return await botRestituicao.executar(configPerfil, caminhoArquivo, dirSaida, enviarLog);
      }
      
      return { sucesso: false, erro: 'Bot não implementado para este perfil' };
  });

  createWindow()

  app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
const { app, BrowserWindow, ipcMain, nativeTheme, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');

const botRestituicaoFianca = require('../backend/bots/restituicao-fianca');
const botRestituicaoIPVA = require('../backend/bots/restituicao-ipva');
// Caminho absoluto para o profiles.json
const caminhoProfiles = path.join(__dirname, '../../config/profiles.json');
let profiles = require(caminhoProfiles);

// Objeto de controle global para o bot
let controleExecucao = { abortar: false };

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
  //win.webContents.openDevTools(); // Descomente para debug
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
          return await botRestituicaoFianca.executarRestituicaoFianca(configPerfil, caminhoArquivo, dirSaida, enviarLog, controleExecucao);
      }
      if (perfilId === 'restituicao-ipva') {
          return await botRestituicaoIPVA.executarRestituicaoIPVA(configPerfil, caminhoArquivo, dirSaida, enviarLog, controleExecucao);
      }
      
      return { sucesso: false, erro: 'Bot não implementado para este perfil' };
  });

  // Handler: PARAR
  ipcMain.handle('bot:parar', async () => {
      controleExecucao.abortar = true;
      logger.gravarLogSistema('Solicitação de parada recebida.');
      return true;
  });

  // Handler: LER CONFIG (Para a tela de edição)
  ipcMain.handle('config:ler', async () => {
      return fs.readFileSync(caminhoProfiles, 'utf-8');
  });

  // Handler: SALVAR CONFIG
  ipcMain.handle('config:salvar', async (event, novoConteudoJSON) => {
      try {
          // Valida se é JSON válido antes de salvar
          JSON.parse(novoConteudoJSON); 
          fs.writeFileSync(caminhoProfiles, novoConteudoJSON, 'utf-8');
          return { sucesso: true };
      } catch (e) {
          return { sucesso: false, erro: 'JSON Inválido: ' + e.message };
      }
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
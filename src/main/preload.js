const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system')
})

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
})

contextBridge.exposeInMainWorld('api', {
    // Função para abrir seletor de arquivo
    selecionarArquivo: () => ipcRenderer.invoke('dialog:openFile'),
    
    // Funções para controle do bot
    iniciarBot: (dados) => ipcRenderer.invoke('bot:iniciar', dados),
    pararBot: () => ipcRenderer.invoke('bot:parar'),
    lerConfig: () => ipcRenderer.invoke('config:ler'),

    // Função para salvar configuração
    salvarConfig: (json) => ipcRenderer.invoke('config:salvar', json),

    // Ouvinte de logs (Do backend para o frontend)
    onLog: (callback) => ipcRenderer.on('bot:log', (event, msg) => callback(msg))
});
//const information = document.getElementById('info')
//information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`
/*
document.getElementById('toggle-dark-mode').addEventListener('click', async () => {
  const isDarkMode = await window.darkMode.toggle()
  document.getElementById('theme-source').innerHTML = isDarkMode ? 'Dark' : 'Light'
})

document.getElementById('reset-to-system').addEventListener('click', async () => {
  await window.darkMode.system()
  document.getElementById('theme-source').innerHTML = 'System'
})
*/
async function resultado() {
    await window.api.iniciarBot({ 
    perfilId: 'restituicao-fianca', 
    caminhoArquivo: 'C:/caminho/do/excel.xlsx' 
});}

// Elementos da Interface
const btnArquivo = document.getElementById('btnArquivo');
const labelArquivo = document.getElementById('labelArquivo');
const btnIniciar = document.getElementById('btnIniciar');
const btnParar = document.getElementById('btnParar');
const selectPerfil = document.getElementById('selectPerfil');
const logArea = document.getElementById('logArea');
const statusTexto = document.getElementById('statusTexto');
const btnLimparLog = document.getElementById('btnLimparLog');

let caminhoArquivoSelecionado = null;

// --- FUNÇÕES AUXILIARES DE UI ---

// Função para adicionar linha ao log visual
function adicionarLog(mensagem) {
    const div = document.createElement('div');
    
    // Estilização baseada no conteúdo da mensagem para facilitar leitura
    if (mensagem.includes('❌') || mensagem.includes('Erro')) {
        div.className = 'text-error font-bold bg-error/10 p-1 rounded';
    } else if (mensagem.includes('✅') || mensagem.includes('Sucesso')) {
        div.className = 'text-success font-bold';
    } else if (mensagem.includes('⚠️')) {
        div.className = 'text-warning';
    } else if (mensagem.includes('▶️')) {
        div.className = 'text-info border-t border-gray-700 pt-2 mt-2';
    } else {
        div.className = 'text-gray-300'; // Padrão
    }

    // Adiciona timestamp
    const hora = new Date().toLocaleTimeString();
    div.innerText = `[${hora}] ${mensagem}`;
    
    logArea.appendChild(div);
    
    // Auto-scroll para o final
    logArea.scrollTop = logArea.scrollHeight;
}

// --- EVENTOS ---

btnArquivo.addEventListener('click', async () => {
    // Chama o backend via preload
    const caminho = await window.api.selecionarArquivo();
    
    if (caminho) {
        caminhoArquivoSelecionado = caminho;
        labelArquivo.innerText = caminho; // Mostra o caminho na tela
        labelArquivo.classList.remove('text-warning');
        labelArquivo.classList.add('text-success');
        
        // Habilita o botão iniciar
        btnIniciar.disabled = false;
        btnIniciar.classList.remove('btn-disabled');
        
        adicionarLog(`📂 Arquivo selecionado: ${caminho}`);
    }
});

btnIniciar.addEventListener('click', async () => {
    if (!caminhoArquivoSelecionado) return;

    const perfilId = selectPerfil.value;
    
    // Trava a interface para evitar duplo clique
    btnIniciar.disabled = true;
    btnArquivo.disabled = true;
    btnParar.disabled = false; // Habilita o parar
    statusTexto.innerText = "Executando...";
    statusTexto.className = "stat-value text-2xl text-warning animate-pulse";
    
    adicionarLog(`🚀 Solicitando início do bot para perfil: ${perfilId}...`);

    // Chama o Robô no Backend
    const resultado = await window.api.iniciarBot({
        perfilId: perfilId,
        caminhoArquivo: caminhoArquivoSelecionado
    });

    // Quando o robô termina (ou dá erro fatal que encerra o processo)
    if (resultado.sucesso) {
        statusTexto.innerText = "Concluído";
        statusTexto.className = "stat-value text-2xl text-success";
        adicionarLog("🏁 Processo finalizado com sucesso. Verifique a pasta de saída.");
    } else {
        statusTexto.innerText = "Erro";
        statusTexto.className = "stat-value text-2xl text-error";
        adicionarLog(`❌ Ocorreu um erro: ${resultado.erro}`);
    }

    // Destrava a interface
    btnIniciar.disabled = false;
    btnArquivo.disabled = false;
    btnParar.disabled = true; // Desabilita o parar
});

btnParar.addEventListener('click', async () => {
    adicionarLog('⚠️ Enviando sinal de parada...');
    await window.api.pararBot();
    btnParar.disabled = true; // Evita cliques múltiplos
});

btnLimparLog.addEventListener('click', () => {
    logArea.innerHTML = ''; // Limpa visualmente
    adicionarLog('🧹 Terminal limpo pelo usuário.');
});

// --- SISTEMA DE CONFIGURAÇÃO (Modal) ---
const btnConfig = document.getElementById('btnConfig');
const modalConfig = document.getElementById('modalConfig');
const editorConfig = document.getElementById('editorConfig');
const btnSalvarConfig = document.getElementById('btnSalvarConfig');
const btnFecharConfig = document.getElementById('btnFecharConfig');

// Abrir Modal
btnConfig.addEventListener('click', async () => {
    const jsonContent = await window.api.lerConfig();
    editorConfig.value = jsonContent;
    modalConfig.showModal();
});

// Fechar Modal
btnFecharConfig.addEventListener('click', () => {
    modalConfig.close();
});

// Salvar Config
btnSalvarConfig.addEventListener('click', async () => {
    const novoJson = editorConfig.value;
    const resultado = await window.api.salvarConfig(novoJson);
    
    if (resultado.sucesso) {
        alert('Configurações salvas com sucesso!');
        modalConfig.close();
        adicionarLog('⚙️ Configurações atualizadas.');
    } else {
        alert('Erro ao salvar: ' + resultado.erro);
    }
});

// 3. Ouvinte de Logs vindos do Backend (Node.js)
// O preload expôs 'onLog'. Sempre que o backend mandar msg, cai aqui.
window.api.onLog((mensagem) => {
    adicionarLog(mensagem);
});
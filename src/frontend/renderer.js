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
//const logger = require('./logger');

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
const containerForm = document.getElementById('containerFormConfig'); // Novo ID
const btnSalvarConfig = document.getElementById('btnSalvarConfig');
const btnFecharConfig = document.getElementById('btnFecharConfig');

let configAtual = null; // Armazena o JSON original em memória

// Função auxiliar para criar inputs HTML
function criarInput(label, valor, caminhoChave, tipo = 'text') {
    return `
        <div class="form-control w-full">
            <label class="label">
                <span class="label-text font-semibold text-gray-400">${label}</span>
            </label>
            <input type="${tipo}" 
                   class="input input-bordered w-full focus:input-primary data-config-input" 
                   data-path="${caminhoChave}"
                   value="${valor || ''}" />
        </div>
    `;
}

// 1. GERADOR DE FORMULÁRIO (Renderizador)
function renderizarFormulario(json) {
    let html = '';

    // A. Configurações Globais (Diretório)
    html += `<div class="bg-base-200 p-4 rounded-lg shadow-sm">
                <h4 class="text-lg font-bold text-secondary mb-2">📂 Caminhos Padrão</h4>
                ${criarInput('Diretório de Saída (Relatórios e Prints)', json.diretorio_saida_padrao, 'diretorio_saida_padrao')}
             </div>`;

    // B. Perfis (Loop pelos perfis)
    json.perfis.forEach((perfil, index) => {
        const pPath = `perfis[${index}]`; // Caminho base para este perfil
        
        html += `
        <div class="collapse collapse-arrow bg-base-200 rounded-lg shadow-sm border border-base-300">
            <input type="checkbox" checked /> 
            <div class="collapse-title text-xl font-medium text-accent flex items-center gap-2">
                🤖 Perfil: ${perfil.nome}
            </div>
            <div class="collapse-content space-y-4 pt-4">
                
                <div class="grid grid-cols-1 gap-4">
                    ${criarInput('URL do Portal (Login)', perfil.url_portal, `${pPath}.url_portal`)}
                    ${criarInput('URL Direta do Formulário', perfil.url_formulario_direto, `${pPath}.url_formulario_direto`)}
                </div>

                <div class="divider">Mapeamento do Excel</div>
                
                <div class="alert alert-info shadow-sm text-xs">
                    <span>Ajuste aqui se os nomes das colunas no Excel mudarem.</span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${Object.keys(perfil.mapeamento_colunas).map(key => 
                        criarInput(`Coluna Excel para: <b>${key}</b>`, perfil.mapeamento_colunas[key], `${pPath}.mapeamento_colunas.${key}`)
                    ).join('')}
                </div>

                <div class="divider">Configurações Fixas</div>

                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    ${Object.keys(perfil.configuracoes_fixas).map(key => 
                        criarInput(key, perfil.configuracoes_fixas[key], `${pPath}.configuracoes_fixas.${key}`)
                    ).join('')}
                </div>
            </div>
        </div>`;
    });

    containerForm.innerHTML = html;
}

// 2. COLETOR DE DADOS (Parser)
function reconstruirJsonApartirDoForm() {
    // Clona o objeto original para manter a estrutura
    const novoJson = JSON.parse(JSON.stringify(configAtual));
    const inputs = document.querySelectorAll('.data-config-input');

    inputs.forEach(input => {
        const path = input.dataset.path; // ex: perfis[0].url_portal
        const valor = input.value;

        // Função mágica para setar valor em objeto aninhado usando string path
        // Transforma "perfis[0].url_portal" em referência real
        let obj = novoJson;
        const parts = path.replace(/]/g, '').split(/[.[]/); // split por . ou [
        
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = valor;
    });

    return novoJson;
}

// --- EVENTOS DO MODAL ---
// Abrir Modal
btnConfig.addEventListener('click', async () => {
    const jsonString = await window.api.lerConfig();
    try {
        configAtual = JSON.parse(jsonString);
        renderizarFormulario(configAtual);
        modalConfig.showModal();
    } catch (e) {
        alert('Erro ao ler configuração: ' + e.message);
    }
});

// Fechar Modal
btnFecharConfig.addEventListener('click', () => {
    modalConfig.close();
});

// Salvar Config
btnSalvarConfig.addEventListener('click', async () => {
    try {
        const novoObjeto = reconstruirJsonApartirDoForm();
        const jsonStringBonita = JSON.stringify(novoObjeto, null, 2); // Formata com indentação
        
        const resultado = await window.api.salvarConfig(jsonStringBonita);
        
        if (resultado.sucesso) {
            // Feedback visual bonito (Toast do DaisyUI se tiver, ou alert)
            const originalText = btnSalvarConfig.innerHTML;
            btnSalvarConfig.innerHTML = '✅ Salvo!';
            btnSalvarConfig.classList.replace('btn-success', 'btn-primary');
            
            setTimeout(() => {
                modalConfig.close();
                btnSalvarConfig.innerHTML = originalText;
                btnSalvarConfig.classList.replace('btn-primary', 'btn-success');
                adicionarLog('⚙️ Configurações atualizadas via interface visual.');
            }, 1000);
        } else {
            alert('Erro ao salvar: ' + resultado.erro);
        }
    } catch (e) {
        alert('Erro ao processar formulário: ' + e.message);
    }
});

// 3. Ouvinte de Logs vindos do Backend (Node.js)
// O preload expôs 'onLog'. Sempre que o backend mandar msg, cai aqui.
window.api.onLog((mensagem) => {
    adicionarLog(mensagem);
});
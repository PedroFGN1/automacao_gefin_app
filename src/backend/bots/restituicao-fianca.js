const puppeteer = require('puppeteer');
const path = require('path');
const fileUtils = require('../utils/file-utils');
const pptUtils = require('../utils/puppeteer-utils');
const { dialog } = require('electron');

// Função Principal exportada para o Electron
async function executar(configPerfil, caminhoExcel, diretorioSaida, enviarLog) {
    // enviarLog: função callback para mandar mensagens para a tela (frontend)

    enviarLog('🚀 Inicializando Bot de Restituição de Fiança...');
    let browser = null;
    const resultados = []; // Armazena status de cada linha para o relatório final

    try {
        // 1. Preparar Pastas
        enviarLog('📂 Preparando diretórios de evidências...');
        const diretorios = fileUtils.prepararDiretorios(diretorioSaida, 'Restituicao-Fianca');
        enviarLog(`   ↳ Salvo em: ${diretorios.base}`);

        // 2. Ler Excel (Usando exceljs)
        enviarLog(`📊 Lendo planilha: ${caminhoExcel}`);
        const dados = await fileUtils.lerExcelInput(caminhoExcel);
        enviarLog(`   ✅ ${dados.length} linhas encontradas.`);

        // 3. Abrir Navegador
        enviarLog('🌍 Abrindo navegador...');
        browser = await puppeteer.launch({ 
            headless: false, 
            defaultViewport: null, 
            args: ['--start-maximized'] 
        });
        const page = await browser.newPage();

        // 4. Login Manual (Handshake)
        enviarLog('🔐 Acedendo ao portal para Login...');
        await page.goto(configPerfil.url_portal, { waitUntil: 'domcontentloaded' });
        
        enviarLog('⚠️  AÇÃO NECESSÁRIA: Faça o Login manualmente no navegador.');
        enviarLog('👉 O robô aguarda você estar na tela do SIOFI. ⚠️  Aguardando confirmação do usuário...');

        const respostaUsuario = await dialog.showMessageBox({
            type: 'info',
            title: 'Aguardando Login',
            message: 'Ação Necessária:',
            detail: '1. Faça o login no portal.\n2. Navegue até chegar na tela inicial correta.\n3. Clique em "Iniciar Processamento" abaixo para soltar o robô.',
            buttons: ['Iniciar Processamento', 'Cancelar'],
            defaultId: 0,
            cancelId: 1
        });
        
        // Se o usuário clicar em Cancelar
        if (respostaUsuario.response === 1) {
            throw new Error('Operação cancelada pelo usuário durante o login.');
        }

        enviarLog('✅ Confirmação recebida! Iniciando automação...');

        // 5. Loop Stateless
        for (let i = 0; i < dados.length; i++) {
            const linha = dados[i];
            const numLinha = i + 1;
            const idProcesso = linha[configPerfil.mapeamento_colunas.PROCESSO] || `Linha_${numLinha}`;
            
            enviarLog(`▶️  Processando ${numLinha}/${dados.length} - Processo: ${idProcesso}`);

            try {
                // A. Navegação Direta
                await page.goto(configPerfil.url_formulario_direto, { waitUntil: 'domcontentloaded' });
                
                // B. Fase 0: Pré-seleção (Finalidade)
                let contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtFinalidade');
                await pptUtils.selecionarOpcaoPorTexto(contexto, 'txtFinalidade', configPerfil.configuracoes_fixas.texto_selecao_inicial);
                
                const btnContinuar = await contexto.$('input[value="Continuar"], input[value="Avancar"], input[value="Continuar >>"]');
                if (btnContinuar) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                        btnContinuar.click()
                    ]);
                }

                // C. Fase 1: Formulário Principal
                // Recaptura contexto esperando o campo Órgão
                contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtOrgao');
                
                // Preenchimento (Exemplos baseados no teu mapeamento)
                await pptUtils.preencherTexto(contexto, 'txtOrgao', configPerfil.configuracoes_fixas.orgao_codigo);
                
                // Tratamento de TAB/Reload do Órgão
                await Promise.all([
                    page.waitForNavigation({ timeout: 5000 }).catch(()=>null), // Timeout curto pois as vezes é rápido
                    contexto.keyboard.press('Tab')
                ]);
                contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtOrgao'); // Recaptura

                // Data (Exemplo de tratamento simples)
                // Se a data vier do ExcelJS como objeto Date:
                const dataRaw = linha[configPerfil.mapeamento_colunas.DATA];
                if (dataRaw) {
                    const dataObj = new Date(dataRaw);
                    await pptUtils.preencherTexto(contexto, 'txtDiaCredito', String(dataObj.getDate()).padStart(2,'0'));
                    await pptUtils.preencherTexto(contexto, 'txtMesCredito', String(dataObj.getMonth()+1).padStart(2,'0'));
                    await pptUtils.preencherTexto(contexto, 'txtAnoCredito', dataObj.getFullYear());
                }

                // Valor
                const valor = linha[configPerfil.mapeamento_colunas.VALOR];
                // Formatação básica de moeda PT-BR
                const valorFormatado = Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                await pptUtils.preencherTexto(contexto, 'txtValor', valorFormatado);

                // Beneficiário (Lógica de Injeção e Busca)
                const cpfCnpj = linha[configPerfil.mapeamento_colunas.CPF_CNPJ];
                const nomeBenef = linha[configPerfil.mapeamento_colunas.NOME];
                
                // Busca ID (Aba oculta)
                const idBenef = await pptUtils.buscarIdBeneficiario(browser, configPerfil.url_base_sistema, cpfCnpj);
                
                // Injeta
                await contexto.evaluate((nome, doc, id) => {
                    const iNome = document.querySelector('input[name="nomePessoa"]');
                    if(iNome) { iNome.value = nome; iNome.removeAttribute('readonly'); iNome.removeAttribute('onchange'); }
                    
                    const iDoc = document.querySelector('input[name="cpfCNPJ"]');
                    if(iDoc) { iDoc.value = String(doc).replace(/\D/g, ''); iDoc.dispatchEvent(new Event('change', {bubbles:true})); }

                    const iId = document.querySelector('input[name="idPessoa"]');
                    if(iId) iId.value = id || '';
                }, nomeBenef, cpfCnpj, idBenef);


                // D. Submissão (Incluir)
                // ... Adicione aqui a lógica de clicar em Incluir, tratar Alert e Confirmar ...
                // Para teste inicial, vamos apenas tirar print
                
                const screenshotPath = path.join(diretorios.evidencias, `${idProcesso}_SUCESSO.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                
                // Registra Sucesso
                resultados.push({ status: 'SUCESSO', dados: linha, mensagem: 'Processado OK' });
                enviarLog(`   ✅ Sucesso!`);

            } catch (erroLinha) {
                enviarLog(`   ❌ Erro na linha: ${erroLinha.message}`);
                
                const screenshotPath = path.join(diretorios.evidencias, `${idProcesso}_ERRO.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true }).catch(()=>{});

                resultados.push({ status: 'ERRO', dados: linha, mensagem: erroLinha.message });
            }
        }

        // 6. Finalização e Relatórios
        enviarLog('💾 Gerando relatórios finais...');
        const resumo = await fileUtils.exportarRelatorios(diretorios.planilhas, resultados);
        
        enviarLog('🏁 PROCESSO CONCLUÍDO!');
        enviarLog(`   Sucessos: ${resumo.qtdSucesso} | Erros: ${resumo.qtdErro}`);
        enviarLog(`   Arquivos salvos em: ${diretorios.base}`);

        return { sucesso: true, resumo };

    } catch (error) {
        enviarLog(`❌ ERRO FATAL NO BOT: ${error.message}`);
        return { sucesso: false, erro: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executar };
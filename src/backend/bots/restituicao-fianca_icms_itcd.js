const puppeteer = require('puppeteer');
const path = require('path');
const fileUtils = require('../utils/file-utils');
const pptUtils = require('../utils/puppeteer-utils');
const navUtils = require('../utils/navigation-utils');
const logger = require('../utils/logger');
const { dialog } = require('electron');
const { log } = require('console');

// Função Principal exportada para o Electron
async function executarRestituicao_Fianca_ICMS_ITCD(configPerfil, caminhoExcel, diretorioSaida, enviarLog, controle) {
    // enviarLog: função callback para mandar mensagens para a tela (frontend)

    // Helper para logar na tela E no arquivo txt ao mesmo tempo
    const logTotal = (msg) => {
        enviarLog(msg);
        logger.gravarLogSistema(`[BOT] ${msg}`);
    };

    logTotal('🚀 Inicializando Bot de Restituição de Fiança...');
    let browser = null;
    const resultados = []; // Armazena status de cada linha para o relatório final

    try {
        // 1. Preparar Pastas
        logTotal('📂 Preparando diretórios de evidências...');
        const diretorios = fileUtils.prepararDiretorios(diretorioSaida, 'Restituicao-Fianca');
        logTotal(`   ↳ Salvo em: ${diretorios.base}`);

        // 2. Ler Excel (Usando exceljs)
        logTotal(`📊 Lendo planilha: ${caminhoExcel}`);
        const dados = await fileUtils.lerExcelInput(caminhoExcel);
        logTotal(`   ✅ ${dados.length} linhas encontradas.`);

        // 3. Abrir Navegador
        logTotal('🌍 Abrindo navegador...');
        browser = await puppeteer.launch({ 
            headless: false, 
            defaultViewport: null, 
            args: ['--start-maximized'] 
        });
        const page = await browser.newPage();

        // 4. Login Manual (Handshake)
        logTotal('🔐 Acedendo ao portal para Login...');
        await page.goto(configPerfil.url_portal, { waitUntil: 'domcontentloaded' });
        
        logTotal('⚠️  AÇÃO NECESSÁRIA: Faça o Login manualmente no navegador.');
        logTotal('👉 O robô aguarda você estar na tela do SIOFI. ⚠️  Aguardando confirmação do usuário...');

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

        logTotal('✅ Confirmação recebida! Iniciando automação...');

        // 5. Loop Stateless
        for (let i = 0; i < dados.length; i++) {
            // --- VERIFICAÇÃO DE PARADA ---
            if (controle && controle.abortar) {
                logTotal('⏹️  Processo interrompido pelo usuário.');
                break; // Sai do loop for
            }

            const linha = dados[i];
            const numLinha = i + 1;
            const idProcesso = linha[configPerfil.mapeamento_colunas.PROCESSO] || `Linha_${numLinha}`;
            
            logTotal(`▶️  Processando ${numLinha}/${dados.length} - Processo: ${idProcesso}`);

            try {
                // A. Navegação Direta
                await page.goto(configPerfil.url_formulario_direto, { waitUntil: 'domcontentloaded' });
                
                // B. Fase 0: Pré-seleção (Finalidade)
                let contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtFinalidade');
                await pptUtils.selecionarOpcaoPorTexto(contexto, 'txtFinalidade', configPerfil.configuracoes_fixas.texto_selecao_inicial);
                await navUtils.delay(500); // Pequena espera para garantir o carregamento

                const btnContinuar = await contexto.$('input[value="Continuar"], input[value="Avancar"]');
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
                await navUtils.delay(2000); // Espera pós-tab

                contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtOrgao'); // Recaptura

                // Data
                // Se a data vier do ExcelJS como objeto Date:
                const dataObj = navUtils.tratarData(linha[configPerfil.mapeamento_colunas.DATA]);
                if (dataObj) {
                    await pptUtils.preencherTexto(contexto, 'txtDiaCredito', String(dataObj.getUTCDate()).padStart(2,'0'));
                    await pptUtils.preencherTexto(contexto, 'txtMesCredito', String(dataObj.getUTCMonth()+1).padStart(2,'0'));
                    await pptUtils.preencherTexto(contexto, 'txtAnoCredito', dataObj.getUTCFullYear());
                }

                // Valor
                const valorFormatado = navUtils.formatarMoeda(linha[configPerfil.mapeamento_colunas.VALOR]);
                await pptUtils.preencherTexto(contexto, 'txtValor', valorFormatado);

                // Beneficiário (Lógica de Injeção e Busca)
                const cpfCnpj = linha[configPerfil.mapeamento_colunas.CPF_CNPJ];
                const nomeBenef = linha[configPerfil.mapeamento_colunas.NOME];
                
                // Busca ID (Aba oculta)
                const idBenef = await pptUtils.buscarIdBeneficiario(browser, configPerfil.url_base_sistema, cpfCnpj);
                if (!idBenef) {
                    throw new Error(`Beneficiário com CPF/CNPJ ${cpfCnpj} não encontrado no sistema.`);
                }

                // Injeta
                await contexto.evaluate((nome, doc, id) => {
                    const iNome = document.querySelector('input[name="nomePessoa"]');
                    if(iNome) { iNome.removeAttribute('readonly'); iNome.removeAttribute('onchange'); iNome.value = nome;}
                    
                    const iDoc = document.querySelector('input[name="cpfCNPJ"]');
                    if(iDoc) iDoc.value = String(doc).replace(/\D/g, '');

                    const iId = document.querySelector('input[name="idPessoa"]'); // hidden
                    if(iId) iId.value = id || '';

                    // Dispara eventos para o formulário "acordar" no campo cpfCNPJ
                    if(iDoc) iDoc.dispatchEvent(new Event('change', { bubbles: true }));

                    
                }, nomeBenef, cpfCnpj, idBenef);

                await navUtils.delay(300); // Espera pós-injeção

                // ------- Débito
                await pptUtils.preencherTexto(contexto, 'txtCodigoReceitaDebito', configPerfil.configuracoes_fixas.receita_debito);
                
                contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtTipoContaDebito');

                await Promise.all([
                    page.waitForNavigation({ timeout: 5000 }).catch(()=>null), // Timeout curto pois as vezes é rápido
                    contexto.keyboard.press('Tab')
                ]);
                await navUtils.delay(1000); // Espera pós-tab

                contexto = await pptUtils.aguardarContextoDoCampo(page, 'txtTipoContaDebito');

                await pptUtils.selecionarOpcaoPorTexto(contexto, 'txtTipoContaDebito', configPerfil.configuracoes_fixas.tipo_debito_texto);
                await navUtils.delay(500);

                const debito_names = {
                    banco: 'txtBancoDebito',
                    agencia: 'txtAgenciaDebito',
                    conta: 'txtContaDebito'
                };
                // { "banco": "104", "agencia": "4204", "conta": "05734669195" }
                const valoresDebito = configPerfil.configuracoes_fixas.conta_debito;
                // Preenche Banco
                await pptUtils.injetarValor(contexto, debito_names, valoresDebito);
                await navUtils.delay(300);

                // Débito em DDR
                await pptUtils.selecionarOpcaoPorTexto(contexto, 'cboDDRDebito', configPerfil.configuracoes_fixas.ddr_debito_texto);
                await navUtils.delay(500);

                // ------- Crédito
                await pptUtils.selecionarOpcaoPorTexto(contexto, 'txtTipoContaCredito', configPerfil.configuracoes_fixas.tipo_credito_texto);
                await navUtils.delay(300);

                await pptUtils.preencherTexto(contexto, 'txtBancoCredito', linha[configPerfil.mapeamento_colunas.BANCO_CREDITO]);

                await pptUtils.preencherTexto(contexto, 'txtAgenciaCredito', linha[configPerfil.mapeamento_colunas.AGENCIA_CREDITO]);

                await pptUtils.preencherTexto(contexto, 'txtContaCredito', linha[configPerfil.mapeamento_colunas.CONTA_CREDITO]);
                
                await pptUtils.preencherTexto(contexto, 'txtHistorico', linha[configPerfil.mapeamento_colunas.HISTORICO]);

                await navUtils.delay(300);

                await pptUtils.marcarOpcao(contexto, 'txtEnviarBanco', configPerfil.configuracoes_fixas.enviar_para_banco);
                await navUtils.delay(300);

                await pptUtils.marcarOpcao(contexto, 'txtIsRascunho', configPerfil.configuracoes_fixas.rascunho || 'S');
                



                ////////////////////////////////////////////////////////////// D. Submissão (Incluir)
                
                // Variável para capturar erro do alert
                let mensagemErroAlert = null;

                // Prepara o ouvinte de Dialog (Alert/Confirm)
                const listenerDialog = async dialog => {
                    mensagemErroAlert = dialog.message();
                    console.log(`      ⚠️ ALERTA DETECTADO: "${mensagemErroAlert}"`);
                    await dialog.accept(); // Clica em OK no alerta para destravar
                };
                page.on('dialog', listenerDialog);

                // Clica em "Incluir" e espera navegação OU tempo para o alert aparecer
                const botaoIncluir = await contexto.$('input[value="Incluir"]');
                if(botaoIncluir) {
                    await botaoIncluir.click();
                    
                    // Espera: Ou a página muda (sucesso) ou um erro aparece (alert)
                    try {
                        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 });
                    } catch(e) {
                        // Se der timeout, provavelmente apareceu um alert e a navegação não ocorreu
                    }
                }

                // Remove o ouvinte para não atrapalhar o próximo loop
                page.off('dialog', listenerDialog);

                // D. VERIFICAÇÃO DO RESULTADO DA ETAPA 1
                if (mensagemErroAlert) {
                    console.error(`      ❌ FALHA: O site recusou a inclusão. Motivo: ${mensagemErroAlert}`);
                    throw new Error(`Inclusão recusada: ${mensagemErroAlert}`);
                }

                // E. TELA DE CONFIRMAÇÃO (A Tabela)
                // Precisamos verificar se chegamos na tela que tem o botão "Sim"

                //contexto = await pptUtils.aguardarContextoDoCampo(page,'input[value="Sim"]', 5000);
                contexto = page.frames().find(f => f.name() === 'principal') || page;
                const botaoConfirmarSim = await contexto.$('input[value="Sim"], input[value="Confirmar"]');

                 if (botaoConfirmarSim) {
                console.log('   ✅ Validação preliminar aceita. Confirmando operação...');
                
                // Tira print da tabela de conferência antes de confirmar
                await page.screenshot({ path: path.join(diretorios.evidencias,`${idProcesso}_CONFERÊNCIA.png`), fullPage: true });


                // CLIQUE FINAL
                await Promise.all([
                    page.waitForNavigation({ timeout: 10000 }),
                    botaoConfirmarSim.click()
                ]);

                //console.log('      🎉 Operação Concluída com Sucesso!');
                } else {
                    // Se não tem alerta mas também não tem botão Sim...
                    // Pode ser que o erro apareceu escrito na tela em vez de popup
                    console.warn('      ⚠️ Situação incerta: Não apareceu botão de confirmação nem alerta.');
                    await page.screenshot({ path: path.join(diretorios.evidencias,`${idProcesso}_ERRO_INCERTO.png`), fullPage: true });
                }
                
                // CAPTURA DO NÚMERO OP
                let textoCapturado = '';
                let numeroOP = 'Não gerado'; // Valor padrão caso falhe

                try {
                    // O seletor pega a classe 'titulo2' (mesmo sendo tag font)
                    await page.waitForSelector('.titulo2', { timeout: 5000 });
                    
                    textoCapturado = await page.$eval('.titulo2', el => el.innerText);
                    // O texto vem como: "OP extra-orçamentária n 2026.9995.0739 efetuada com sucesso."

                    // LIMPEZA (REGEX)
                    // Procura por um padrão de números e pontos (ex: 2026.9995.0739)
                    const match = textoCapturado.match(/[\d]{4}\.[\d]{4}\.[\d]{4}/);
                    
                    if (match) {
                        numeroOP = match[0]; // Pega apenas "2026.9995.0739"
                    } else {
                        numeroOP = textoCapturado; // Se não achar o padrão, salva o texto todo por segurança
                    }
                } catch (e) {
                    if (configPerfil.configuracoes_fixas.rascunho === 'N') {
                        logTotal(`⚠️ Aviso: Não consegui ler o número da OP na linha ${numLinha}.`);
                    } 
                }

                logTotal(`✅ Sucesso Linha ${numLinha} - OP: ${numeroOP}`);
                await navUtils.delay(1000);
                

                const screenshotPath = path.join(diretorios.evidencias, `${idProcesso}_SUCESSO.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                
                // Registra Sucesso
                resultados.push({ status: 'SUCESSO',  linha: numLinha, dados: linha, mensagem: 'Processado com sucesso', numero_op: numeroOP });
                logTotal(`   ✅ Sucesso!`);

            } catch (erroLinha) {
                logTotal(`   ❌ Erro na linha: ${erroLinha.message}`);
                
                const screenshotPath = path.join(diretorios.evidencias, `${idProcesso}_ERRO.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true }).catch(()=>{});

                resultados.push({ status: 'ERRO', linha: numLinha, dados: linha, mensagem: erroLinha.message, numeroOP: '' });
            }
        }

        // 6. Finalização e Relatórios
        logTotal('💾 Gerando relatórios finais...');
        const resumo = await fileUtils.exportarRelatorios(diretorios.planilhas, resultados);
        
        logTotal('🏁 PROCESSO CONCLUÍDO!');
        logTotal(`   Sucessos: ${resumo.qtdSucesso} | Erros: ${resumo.qtdErro}`);
        logTotal(`   Arquivos salvos em: ${diretorios.base}`);

        return { sucesso: true, resumo };

    } catch (error) {
        logTotal(`❌ ERRO FATAL NO BOT: ${error.message}`);
        return { sucesso: false, erro: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarRestituicao_Fianca_ICMS_ITCD };
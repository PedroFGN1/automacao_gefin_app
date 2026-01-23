// Funções genéricas de interação com o navegador

// 1. Espera inteligente (Página ou Frame)
async function aguardarContextoDoCampo(page, nomeCampo, tempoEspera = 15000) {
    const seletor = `input[name="${nomeCampo}"], select[name="${nomeCampo}"], textarea[name="${nomeCampo}"], input[value="${nomeCampo}"]`;
    try {
        await page.waitForSelector(seletor, { timeout: tempoEspera });
        return page; // Está na página principal
    } catch (erro) {
        // Procura nos frames
        for (const frame of page.frames()) {
            try {
                await frame.waitForSelector(seletor, { timeout: 1000 });
                return frame; // Está neste frame
            } catch (e) {}
        }
        throw new Error(`Campo "${nomeCampo}" não encontrado após ${tempoEspera}ms.`);
    }
}

// 2. Preencher Texto (Input ou Textarea)
async function preencherTexto(contexto, nomeCampo, valor) {
    const valorStr = valor ? String(valor).trim() : '';
    if (!valorStr) return;

    const seletor = `input[name="${nomeCampo}"], textarea[name="${nomeCampo}"]`;
    try {
        await contexto.click(seletor, { clickCount: 3 });
        await contexto.type(seletor, valorStr);
    } catch (e) {
        // Ignora erro se for opcional, ou lança se for crítico (ajustaremos no bot)
        console.log(`Aviso: Não consegui escrever em ${nomeCampo}`);
    }
}

// 3. Selecionar em Dropdown pelo Texto visível
async function selecionarOpcaoPorTexto(contexto, nomeSelect, textoAlvo) {
    await contexto.evaluate((nome, texto) => {
        const select = document.querySelector(`select[name="${nome}"]`);
        if (!select) return;
        const opcao = Array.from(select.options).find(opt => opt.text.includes(texto));
        if (opcao) {
            select.value = opcao.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, nomeSelect, textoAlvo);
}

// 4. Injeção de Valor em campos bloqueados/especiais
async function injetarValor(contexto, seletores, valores) {
    // seletores: { nome: 'txtNome', cpf: 'txtCPF' }
    // valores: { nome: 'João', cpf: '123' }
    try{
        await contexto.evaluate((sels, vals) => {
            // Exemplo genérico de injeção
            Object.keys(sels).forEach(chave => {
                const el = document.querySelector(`input[name="${sels[chave]}"]`);
                if (el) {
                    el.removeAttribute('readonly');
                    el.removeAttribute('disabled');
                    el.removeAttribute('onchange');
                    el.classList.remove('disabled');
                    el.value = vals[chave];
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                }
            });
        }, seletores, valores);
    } catch (e) {
        console.error('Erro na injeção de valores:', e);
        throw e; // Para o script se for crucial
    }
}

// 5. Busca de ID em Aba Oculta (Browser Auxiliar)
async function buscarIdBeneficiario(browser, urlBase, docCru) {
    const docLimpo = String(docCru).replace(/\D/g, '');
    const tipo = docLimpo.length > 11 ? 'J' : 'F';
    // Formatação básica para a URL (Ajustar conforme o site)
    let docFormatado = docLimpo; 
    if(tipo === 'J') docFormatado = docLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    else docFormatado = docLimpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    const url = `${urlBase}/servlet/control?cmd=gov.goias.controle.corporativo.SelecionarPessoa&tPes=2&tipoPessoa=${tipo}&cpfCNPJ=${encodeURIComponent(docFormatado)}&nomePessoa=&op=Consultar`;
    
    const pageBusca = await browser.newPage();
    let id = null;
    try {
        await pageBusca.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        id = await pageBusca.evaluate(() => {
            const el = document.querySelector('input[name="idPessoa_1"]');
            return el ? el.value : null;
        });
    } catch (e) {
        console.error('Erro na busca background:', e);
    } finally {
        await pageBusca.close();
    }
    return id;
}

// 6. Marcar opção (Radio ou Checkbox) por valor
async function marcarOpcao(frame, nomeCampo, valorAlvo) {
    // Seletor CSS preciso: Procura input com ESTE nome E ESTE valor
    const seletor = `input[name="${nomeCampo}"][value="${valorAlvo}"]`;
    try {
        // Verifica se o elemento existe
        const elemento = await frame.$(seletor);
        if (!elemento) {
            throw new Error(`Opção com valor "${valorAlvo}" não encontrada para o campo "${nomeCampo}".`);
        }
        // Verifica se já está marcado (checked)
        const isChecked = await frame.$eval(seletor, el => el.checked);
        if (!isChecked) { await elemento.click();} else {}
    } catch (error) {
        console.error(`      ❌ Erro ao marcar opção: ${error.message}`);
        throw error; // Para o script se for crucial
    }
}

async function forcarPreenchimentoBloqueado(contexto, nomeCampo, valor) {
    const valorStr = valor ? String(valor).trim() : '';
    if (!valorStr) return;

    try {
        await contexto.evaluate((nome, val) => {
            const el = document.querySelector(`input[name="${nome}"], textarea[name="${nome}"]`);
            if (el) {
                el.removeAttribute('readonly'); 
                el.removeAttribute('disabled'); 
                el.removeAttribute('onchange'); // Remove armadilhas de script
                el.classList.remove('disabled'); // Remove estilo visual
                
                // Injeta o valor
                el.value = val;
                
                // Acorda o sistema para validar o campo
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, nomeCampo, valorStr);
    } catch (e) {
        console.warn(`Aviso: Falha ao forçar campo ${nomeCampo}.`);
    }
}

module.exports = { 
    aguardarContextoDoCampo, 
    preencherTexto, 
    selecionarOpcaoPorTexto, 
    injetarValor,
    buscarIdBeneficiario,
    marcarOpcao,
    forcarPreenchimentoBloqueado
};
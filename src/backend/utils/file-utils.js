const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// 1. Prepara as pastas (Planilhas e Evidências)
function prepararDiretorios(caminhoRaiz, nomePerfil) {
    // Ex: C:/Automacao/Restituicao-Fianca/2024-01-22
    const hoje = new Date().toISOString().split('T')[0]; 
    
    const pastaBase = path.join(caminhoRaiz, nomePerfil, hoje);
    const pastaPlanilhas = path.join(pastaBase, 'Planilhas');
    const pastaEvidencias = path.join(pastaBase, 'Evidencias');

    if (!fs.existsSync(pastaPlanilhas)) fs.mkdirSync(pastaPlanilhas, { recursive: true });
    if (!fs.existsSync(pastaEvidencias)) fs.mkdirSync(pastaEvidencias, { recursive: true });

    return {
        base: pastaBase,
        planilhas: pastaPlanilhas,
        evidencias: pastaEvidencias
    };
}

// 2. Lê a planilha de entrada (Agora assíncrono com ExcelJS)
async function lerExcelInput(caminhoArquivo) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(caminhoArquivo);
    
    // Pega a primeira aba
    const worksheet = workbook.worksheets[0];
    const dados = [];
    
    // Mapeia colunas na linha 1
    const cabecalhos = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
        cabecalhos[colNumber] = cell.value;
    });

    // Itera dados (começando da linha 2)
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Pula cabeçalho
        
        const linhaObj = {};
        row.eachCell((cell, colNumber) => {
            const header = cabecalhos[colNumber];
            if (header) {
                // Trata datas e hyperlinks se necessário, aqui pegamos o valor bruto ou texto
                linhaObj[header] = cell.value;
            }
        });
        dados.push(linhaObj);
    });

    return dados;
}

// 3. Gera os relatórios de Sucesso e Erro
async function exportarRelatorios(caminhoPlanilhas, listaResultados) {
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    
    // Filtros
    const sucessos = listaResultados.filter(r => r.status === 'SUCESSO').map(r => ({...r.dados, OP: r.numero_op}));
    const erros = listaResultados.filter(r => r.status === 'ERRO').map(r => ({
        ...r.dados,
        MOTIVO_ERRO: r.mensagem,
        OP: r.numeroOP
    }));

    // Função interna para criar e salvar
    const criarArquivo = async (dados, nomeArquivo) => {
        if (dados.length === 0) return;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Dados');

        // Pega as chaves do primeiro objeto para fazer os cabeçalhos
        const colunas = Object.keys(dados[0]).map(key => ({
            header: key, 
            key: key, 
            width: 20 
        }));
        
        sheet.columns = colunas;

        // Estiliza o cabeçalho (Negrito)
        sheet.getRow(1).font = { bold: true };

        // Adiciona as linhas
        sheet.addRows(dados);

        await workbook.xlsx.writeFile(path.join(caminhoPlanilhas, nomeArquivo));
    };

    await criarArquivo(sucessos, `Sucessos_${hora}.xlsx`);
    await criarArquivo(erros, `Erros_${hora}.xlsx`);

    return { qtdSucesso: sucessos.length, qtdErro: erros.length };
}

module.exports = { 
    prepararDiretorios, 
    lerExcelInput, 
    exportarRelatorios 
};
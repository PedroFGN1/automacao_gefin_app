const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Cria a estrutura de pastas conforme solicitado:
// Raiz > Nome do Perfil > Data (AAAA-MM-DD) > [Planilhas, Evidencias]
function prepararDiretorios(caminhoRaiz, nomePerfil) {
    const hoje = new Date().toISOString().split('T')[0]; // 2024-01-21
    
    const pastaBase = path.join(caminhoRaiz, nomePerfil, hoje);
    const pastaPlanilhas = path.join(pastaBase, 'Planilhas');
    const pastaEvidencias = path.join(pastaBase, 'Evidencias');

    // Cria recursivamente se não existir
    if (!fs.existsSync(pastaPlanilhas)) fs.mkdirSync(pastaPlanilhas, { recursive: true });
    if (!fs.existsSync(pastaEvidencias)) fs.mkdirSync(pastaEvidencias, { recursive: true });

    return {
        base: pastaBase,
        planilhas: pastaPlanilhas,
        evidencias: pastaEvidencias
    };
}

// Gera os arquivos Excel finais de Sucesso e Erro
function exportarRelatorios(caminhoPlanilhas, listaResultados) {
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-'); // 14-30-00
    
    // Filtra sucessos e erros
    const sucessos = listaResultados.filter(r => r.status === 'SUCESSO').map(r => r.dados);
    const erros = listaResultados.filter(r => r.status === 'ERRO').map(r => ({
        ...r.dados,
        MOTIVO_ERRO: r.mensagem // Adiciona coluna extra explicando o erro
    }));

    // Função interna para salvar arquivo
    const salvarXlsx = (dados, nomeArquivo) => {
        if (dados.length === 0) return;
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(dados);
        xlsx.utils.book_append_sheet(wb, ws, "Dados");
        xlsx.writeFile(wb, path.join(caminhoPlanilhas, nomeArquivo));
    };

    salvarXlsx(sucessos, `Sucessos_${hora}.xlsx`);
    salvarXlsx(erros, `Erros_${hora}.xlsx`);

    return { qtdSucesso: sucessos.length, qtdErro: erros.length };
}

module.exports = { prepararDiretorios, exportarRelatorios };
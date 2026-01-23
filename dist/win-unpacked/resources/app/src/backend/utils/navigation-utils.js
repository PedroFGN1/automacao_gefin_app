const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function tratarData(valorExcel) {
    // Se o Excel devolver número serial (ex: 45300)
    if (typeof valorExcel === 'number') {
        const data = new Date(Math.round((valorExcel - 25569) * 86400 * 1000));
        data.setMinutes(data.getMinutes() + data.getTimezoneOffset()); // Ajuste fuso
        return data;
    }
    // Se for string "2024-01-22" ou "22/01/2024"
    const data = new Date(valorExcel);
    return data; // Retorna objeto Date do JS
}

function formatarMoeda(valor) {
    if (!valor) return '0,00';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(valor);
}

module.exports = { delay, tratarData, formatarMoeda };
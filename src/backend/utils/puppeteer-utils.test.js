const { 
    preencherTexto, 
    aguardarContextoDoCampo, 
    selecionarOpcaoPorTexto, 
    injetarValor,
    buscarIdBeneficiario,
    marcarOpcao,
    forcarPreenchimentoBloqueado
} = require('./puppeteer-utils');

describe('preencherTexto', () => {
    let mockContexto;
    let consoleSpy;

    beforeEach(() => {
        // Mock do objeto page/frame do Puppeteer
        mockContexto = {
            click: jest.fn().mockResolvedValue(undefined),
            type: jest.fn().mockResolvedValue(undefined)
        };
        // Espiona o console.log para verificar se avisos são gerados
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('deve preencher o texto corretamente quando valor é válido', async () => {
        const nomeCampo = 'testeCampo';
        const valor = 'Valor Teste';
        const seletorEsperado = `input[name="${nomeCampo}"], textarea[name="${nomeCampo}"]`;

        await preencherTexto(mockContexto, nomeCampo, valor);

        // Verifica se clicou 3 vezes para selecionar tudo antes de digitar
        expect(mockContexto.click).toHaveBeenCalledWith(seletorEsperado, { clickCount: 3 });
        // Verifica se digitou o valor correto
        expect(mockContexto.type).toHaveBeenCalledWith(seletorEsperado, 'Valor Teste');
        // Não deve ter logado erro
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('não deve interagir com a página se o valor for vazio, nulo ou undefined', async () => {
        await preencherTexto(mockContexto, 'campo', '');
        await preencherTexto(mockContexto, 'campo', null);
        await preencherTexto(mockContexto, 'campo', undefined);

        expect(mockContexto.click).not.toHaveBeenCalled();
        expect(mockContexto.type).not.toHaveBeenCalled();
    });

    test('deve converter valores numéricos para string antes de preencher', async () => {
        await preencherTexto(mockContexto, 'campoNumerico', 12345);
        expect(mockContexto.type).toHaveBeenCalledWith(expect.any(String), '12345');
    });

    test('deve capturar erro e logar aviso se a interação com o Puppeteer falhar', async () => {
        const erroSimulado = new Error('Elemento não visível');
        mockContexto.click.mockRejectedValue(erroSimulado);

        const nomeCampo = 'campoComErro';
        await preencherTexto(mockContexto, nomeCampo, 'valor qualquer');

        expect(consoleSpy).toHaveBeenCalledWith(`Aviso: Não consegui escrever em ${nomeCampo}`);
    });
});

describe('aguardarContextoDoCampo', () => {
    let mockPage;

    beforeEach(() => {
        mockPage = {
            waitForSelector: jest.fn(),
            frames: jest.fn().mockReturnValue([])
        };
    });

    test('deve retornar a página se o seletor for encontrado nela', async () => {
        mockPage.waitForSelector.mockResolvedValue(true);
        const resultado = await aguardarContextoDoCampo(mockPage, 'campoTeste');
        expect(resultado).toBe(mockPage);
    });

    test('deve retornar o frame se o seletor for encontrado em um frame', async () => {
        mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
        const mockFrame = { waitForSelector: jest.fn().mockResolvedValue(true) };
        mockPage.frames.mockReturnValue([mockFrame]);

        const resultado = await aguardarContextoDoCampo(mockPage, 'campoTeste');
        expect(resultado).toBe(mockFrame);
    });

    test('deve lançar erro se o campo não for encontrado nem na página nem nos frames', async () => {
        mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
        mockPage.frames.mockReturnValue([{ waitForSelector: jest.fn().mockRejectedValue(new Error('Timeout')) }]);

        await expect(aguardarContextoDoCampo(mockPage, 'campoTeste', 100))
            .rejects.toThrow('Campo "campoTeste" não encontrado');
    });
});

describe('selecionarOpcaoPorTexto', () => {
    test('deve chamar evaluate com os argumentos corretos', async () => {
        const mockContexto = { evaluate: jest.fn() };
        await selecionarOpcaoPorTexto(mockContexto, 'meuSelect', 'Minha Opção');
        expect(mockContexto.evaluate).toHaveBeenCalledWith(expect.any(Function), 'meuSelect', 'Minha Opção');
    });
});

describe('injetarValor', () => {
    test('deve chamar evaluate para injetar valores', async () => {
        const mockContexto = { evaluate: jest.fn() };
        await injetarValor(mockContexto, { campo: 'txtCampo' }, { campo: 'Valor' });
        expect(mockContexto.evaluate).toHaveBeenCalled();
    });

    test('deve logar erro e relançar exceção se falhar', async () => {
        const erro = new Error('Falha na injeção');
        const mockContexto = { evaluate: jest.fn().mockRejectedValue(erro) };
        const spyErro = jest.spyOn(console, 'error').mockImplementation(() => {});

        await expect(injetarValor(mockContexto, {}, {})).rejects.toThrow('Falha na injeção');
        expect(spyErro).toHaveBeenCalled();
        spyErro.mockRestore();
    });
});

describe('buscarIdBeneficiario', () => {
    let mockBrowser, mockPage;

    beforeEach(() => {
        mockPage = {
            goto: jest.fn(),
            evaluate: jest.fn(),
            close: jest.fn()
        };
        mockBrowser = { newPage: jest.fn().mockResolvedValue(mockPage) };
    });

    test('deve retornar o ID encontrado', async () => {
        mockPage.evaluate.mockResolvedValue('12345');
        const id = await buscarIdBeneficiario(mockBrowser, 'http://site.com', '11122233344');
        
        expect(mockBrowser.newPage).toHaveBeenCalled();
        expect(mockPage.goto).toHaveBeenCalled();
        expect(id).toBe('12345');
        expect(mockPage.close).toHaveBeenCalled();
    });

    test('deve retornar null e logar erro se ocorrer exceção', async () => {
        mockPage.goto.mockRejectedValue(new Error('Erro de rede'));
        const spyErro = jest.spyOn(console, 'error').mockImplementation(() => {});

        const id = await buscarIdBeneficiario(mockBrowser, 'http://site.com', '111');
        
        expect(id).toBeNull();
        expect(spyErro).toHaveBeenCalled();
        expect(mockPage.close).toHaveBeenCalled();
        spyErro.mockRestore();
    });
});

describe('marcarOpcao', () => {
    let mockFrame, mockElement;

    beforeEach(() => {
        mockElement = { click: jest.fn() };
        mockFrame = {
            $: jest.fn().mockResolvedValue(mockElement),
            $eval: jest.fn()
        };
    });

    test('deve clicar se a opção não estiver marcada', async () => {
        mockFrame.$eval.mockResolvedValue(false); // isChecked = false
        await marcarOpcao(mockFrame, 'radio', 'S');
        expect(mockElement.click).toHaveBeenCalled();
    });

    test('não deve clicar se a opção já estiver marcada', async () => {
        mockFrame.$eval.mockResolvedValue(true); // isChecked = true
        await marcarOpcao(mockFrame, 'radio', 'S');
        expect(mockElement.click).not.toHaveBeenCalled();
    });

    test('deve lançar erro se o elemento não for encontrado', async () => {
        mockFrame.$.mockResolvedValue(null);
        await expect(marcarOpcao(mockFrame, 'radio', 'X')).rejects.toThrow('não encontrada');
    });
});

describe('forcarPreenchimentoBloqueado', () => {
    test('deve chamar evaluate se valor for válido', async () => {
        const mockContexto = { evaluate: jest.fn() };
        await forcarPreenchimentoBloqueado(mockContexto, 'campo', 'valor');
        expect(mockContexto.evaluate).toHaveBeenCalled();
    });

    test('não deve fazer nada se valor for vazio', async () => {
        const mockContexto = { evaluate: jest.fn() };
        await forcarPreenchimentoBloqueado(mockContexto, 'campo', '');
        expect(mockContexto.evaluate).not.toHaveBeenCalled();
    });
});
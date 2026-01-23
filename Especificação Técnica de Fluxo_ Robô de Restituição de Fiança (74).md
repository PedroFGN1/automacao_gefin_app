# Especificação Técnica de Fluxo: Robô de Restituição de Fiança (74)

**Autor:** Manus AI
**Data:** 22 de Janeiro de 2026
**Objetivo:** Documentar o fluxo operacional e as lógicas de interação do script `robo-fase2.js` para garantir a manutenção e a replicação de suas funcionalidades em estruturas modulares.

---

## 1. Visão Geral do Fluxo

O script `robo-fase2.js` implementa um robô de automação baseado em Puppeteer, projetado para processar dados de uma planilha Excel e preencher um formulário de "Restituição de Depósito de Fiança" em um sistema web. O fluxo é caracterizado por um **loop stateless** (à prova de falhas), onde cada linha da planilha é processada de forma independente, começando sempre do formulário limpo.

O fluxo principal é dividido em três grandes etapas: **Inicialização**, **Loop de Processamento** e **Finalização**.

## 2. Inicialização e Handshake de Login

Esta etapa prepara o ambiente e garante que o usuário esteja autenticado no sistema.

| Passo | Descrição | Funções/Comandos Chave | Observações |
| :--- | :--- | :--- | :--- |
| **2.1. Leitura de Dados** | Carrega o arquivo Excel (`CONFIG.PLANILHA`) e converte a primeira aba em um array de objetos JSON. | `xlsx.readFile`, `xlsx.utils.sheet_to_json` | O robô depende dos nomes de coluna definidos em `COLUNAS`. |
| **2.2. Lançamento do Navegador** | Inicia uma instância do Puppeteer em modo não-headless, maximizado. | `puppeteer.launch({ headless: false, ... })` | O uso de `defaultViewport: null` e `args: ['--start-maximized']` garante a visualização completa do formulário. |
| **2.3. Handshake de Login** | Navega para a URL do portal e pausa a execução, aguardando a confirmação manual do usuário. | `page.goto(CONFIG.URL_PORTAL)`, `process.stdin.once('data', resolve)` | O robô só prossegue após o usuário realizar o login e pressionar ENTER no terminal, garantindo o estado de autenticação. |

## 3. Loop de Processamento (Stateless)

O robô itera sobre cada linha (`linha`) do array de dados. O uso de um bloco `try...catch` externo e o comando `continue` garantem que falhas em uma linha não interrompam o processamento das demais.

### 3.1. Reset e Contexto

Para cada linha, o robô garante que o formulário esteja limpo e o contexto de interação correto seja estabelecido.

| Passo | Descrição | Funções/Comandos Chave | Lógica Crítica |
| :--- | :--- | :--- | :--- |
| **3.1.1. Reset de Formulário** | Navega diretamente para a URL do formulário limpo. | `page.goto(CONFIG.URL_FORMULARIO_DIRETO)` | Garante que o estado da sessão anterior não interfira no preenchimento atual. |
| **3.1.2. Captura de Frame** | Identifica o contexto de interação, priorizando o frame nomeado como `'principal'` (comum em sistemas legados com `frameset`). | `page.frames().find(f => f.name() === 'principal') \|\| page` | O `frame` é a variável de contexto (`page` ou `frame`) usada para todas as interações subsequentes. |

### 3.2. Pré-Seleção Inicial

| Passo | Descrição | Funções/Comandos Chave | Lógica Crítica |
| :--- | :--- | :--- | :--- |
| **3.2.1. Seleção de Finalidade** | Seleciona a opção de finalidade (`Restituição de Depósito de Fiança (74)`) no campo `txtFinalidade`. | `selecionarOpcaoPorTexto(frame, 'txtFinalidade', ...)` | A função utiliza `evaluate` para injetar o valor e disparar o evento `change`, garantindo que o sistema reaja à seleção. |
| **3.2.2. Continuação** | Clica no botão "Continuar" e aguarda a navegação para o formulário principal. | `page.waitForNavigation`, `botaoContinuar.click()` | Se o botão não for encontrado, o robô lança um erro e interrompe o processamento da linha. |

### 3.3. Preenchimento do Formulário Principal

O preenchimento é feito em blocos `try...catch` internos para isolar erros de campos específicos.

| Campo/Bloco | Descrição | Funções/Comandos Chave | Lógica Crítica |
| :--- | :--- | :--- | :--- |
| **Órgão** | Preenche o código do órgão e simula a tecla `Tab`. | `frame.type('input[name="txtOrgao"]', ...)` | O `page.keyboard.press('Tab')` é crucial, pois aciona um *reload* da página (ou do frame) para carregar dados dependentes. O robô aguarda essa navegação e recaptura o `frame`. |
| **Dados Básicos** | Preenche Data e Valor. | `tratarData`, `formatarMoeda`, `preencherTexto` | A função `tratarData` lida com formatos de data do Excel (serial ou string). `preencherTexto` garante que o campo seja limpo antes de digitar. |
| **Beneficiário** | Busca o `idPessoa` em uma aba auxiliar e injeta os dados. | `obterIdBeneficiario(browser, ...)` | **Busca em Background:** Abre uma nova aba (`browser.newPage()`) para consultar o ID do beneficiário via URL direta, sem interromper o formulário principal. **Injeção:** Usa `frame.evaluate` para injetar `nomePessoa`, `cpfCNPJ` e `idPessoa`, removendo atributos como `onchange` e `readonly` para evitar validações indesejadas. |
| **Débito (Receita)** | Preenche o código da receita de débito. | `forcarPreenchimentoBloqueado` | **Preenchimento Forçado:** Esta função é vital. Ela usa `evaluate` para remover `readonly`/`disabled`, definir o valor e disparar eventos `change`/`blur`, forçando o sistema a aceitar o valor e, no caso da Receita, acionar um *reload* para carregar as opções de DDR. |
| **Débito (Conta)** | Preenche os dados da conta de débito (Banco, Agência, Conta) e o DDR. | `forcarPreenchimentoBloqueado`, `selecionarOpcaoPorTexto` | O preenchimento da conta de débito também usa a função de preenchimento forçado. |
| **Crédito** | Preenche os dados da conta de crédito (Banco, Agência, Conta). | `preencherTexto` | |
| **Controle** | Marca os *radio buttons* de controle. | `marcarOpcao` | A função garante que o `input` com o `value` alvo seja clicado, tratando a lógica de *radio buttons*. |
| **Histórico** | Preenche o campo de histórico. | `preencherTexto` | |

### 3.4. Submissão e Tratamento de Exceções (O Pulo do Gato)

Esta é a parte mais crítica do fluxo, responsável por lidar com a validação do sistema via *popups* de alerta.

| Passo | Descrição | Funções/Comandos Chave | Lógica Crítica |
| :--- | :--- | :--- | :--- |
| **3.4.1. Listener de Diálogo** | Configura um ouvinte para capturar qualquer `alert` ou `confirm` que o sistema possa disparar. | `page.on('dialog', listenerDialog)` | O `listenerDialog` armazena a mensagem de erro e, crucialmente, chama `dialog.accept()` para fechar o popup e destravar o Puppeteer. |
| **3.4.2. Clique em Incluir** | Clica no botão "Incluir" e aguarda a navegação. | `botaoIncluir.click()`, `page.waitForNavigation` | Se a navegação ocorrer, significa sucesso. Se o `waitForNavigation` der *timeout*, é provável que um `alert` tenha sido disparado e capturado pelo listener. |
| **3.4.3. Verificação de Erro** | Verifica se o `listenerDialog` capturou alguma mensagem de erro. | `if (mensagemErroAlert)` | Se houver erro, o robô registra a falha e usa `continue` para pular para a próxima linha do Excel, sem tentar a confirmação. |

### 3.5. Confirmação Final

Se não houver erro de alerta, o robô assume que avançou para a tela de confirmação.

| Passo | Descrição | Funções/Comandos Chave | Lógica Crítica |
| :--- | :--- | :--- | :--- |
| **3.5.1. Recaptura de Contexto** | Recaptura o `frame` para garantir que o contexto da nova página seja o correto. | `frame = page.frames().find(...)` | |
| **3.5.2. Confirmação** | Busca pelo botão "Sim" ou "Confirmar". | `frame.$('input[value="Sim"], input[value="Confirmar"]')` | Se o botão for encontrado, o robô tira uma *screenshot* de evidência prévia, clica no botão e aguarda a navegação final, tirando uma *screenshot* de evidência final. |
| **3.5.3. Erro Incerto** | Se não houver alerta, mas também não houver botão de confirmação, o robô registra uma situação incerta e tira uma *screenshot* para análise manual. | `page.screenshot({ path: 'erro_incerto_...' })` | |

## 4. Finalização

Após o loop, o robô imprime uma mensagem de finalização no console. O `browser` é fechado no bloco `finally` do escopo principal.

---

## 5. Resumo das Funções Auxiliares Críticas

A manutenção da lógica do robô depende diretamente da correta implementação destas funções:

| Função | Finalidade | Lógica Essencial |
| :--- | :--- | :--- |
| `preencherTexto` | Preencher campos de texto. | Limpa o campo com `click({ clickCount: 3 })` antes de digitar. |
| `forcarPreenchimentoBloqueado` | Preencher campos `readonly` ou `disabled`. | Usa `frame.evaluate` para remover `readonly`/`disabled`, injetar o valor e disparar eventos `change` e `blur`. |
| `selecionarOpcaoPorTexto` | Selecionar itens em `select` por texto visível. | Usa `frame.evaluate` para encontrar a opção pelo texto, definir o `select.value` e disparar o evento `change`. |
| `obterIdBeneficiario` | Buscar o ID de uma pessoa em uma aba auxiliar. | Abre uma nova aba (`browser.newPage()`), navega para a URL de consulta e extrai o `idPessoa_1` do HTML. |
| `marcarOpcao` | Marcar *radio buttons* ou *checkboxes*. | Usa um seletor preciso (`input[name="..."][value="..."]`) e verifica se o campo já está marcado antes de clicar. |
| `tratarData` | Converter dados de data do Excel. | Lida com números seriais do Excel e strings de data, retornando um objeto `Date` válido. |

# 🤖 Automator GEFIN - Robô de Finanças

Ferramenta de automação desktop para processamento de **Restituições** e outros processos financeiros no portal SIOFI. Desenvolvido com Electron, Node.js e Puppeteer.

## ✨ Funcionalidades

* **Processamento em Lote:** Lê planilhas Excel e preenche formulários web automaticamente.
* **Inteligência de Navegação:** Lida com logins, popups e múltiplas abas.
* **Relatórios Automáticos:** Gera planilhas de "Sucesso" e "Erro" ao final.
* **Evidências:** Tira prints automáticos de cada operação.
* **Logs Detalhados:** Histórico completo de execução salvo em texto.

## 🚀 Como Iniciar (Sem Instalação)

Esta versão é **Portátil**. Não requer direitos de administrador.

1.  Baixe a pasta do projeto.
2.  Certifique-se de estar conectado à internet (apenas na primeira vez).
3.  Clique duas vezes no arquivo **`iniciar.bat`**.
4.  O sistema irá configurar tudo sozinho e abrir a janela do robô.

## 🛠️ Configuração

As configurações de URLs e Mapeamento de Colunas ficam no arquivo:
`config/profiles.json`
Você pode editar este arquivo diretamente ou usar a aba de configurações dentro do aplicativo.

## 📋 Como Usar

1.  Abra o aplicativo.
2.  Selecione o **Tipo de Processo** (Ex: Restituição de Fiança).
3.  Carregue a **Planilha de Dados** (.xlsx).
4.  Clique em **INICIAR AUTOMAÇÃO**.
5.  O navegador abrirá. **Faça o Login manualmente** e clique em "Iniciar Processamento" na janela de aviso.
6.  Aguarde o fim da execução.

## 📁 Onde ficam os arquivos?

Por padrão, os relatórios e prints são salvos em:
`C:/AutomacaoFinanceira`

## Diretório da Aplicação
A estrutura do projeto é organizada da seguinte forma:
```
automacao_gefin_app/
├── config/                 # Arquivos JSON de configuração
│   └── profiles.json       # Define URLs e regras de cada tipo de formulário
├── src/
│   ├── main/               # PROCESSO PRINCIPAL (Backend do Electron)
│   │   ├── main.js         # Ponto de entrada (cria a janela)
│   │   ├── ipc-handlers.js # Recebe ordens do Frontend (Start, Stop)
│   │   └── preload.js      # Ponte segura entre Front e Back
│   ├── backend/            # LÓGICA DO ROBÔ (Node.js + Puppeteer)
│   │   ├── manager.js      # Gerencia a fila e o browser
│   │   ├── bots/           # Scripts específicos para cada tarefa
│   │   │   └── restituicao-fianca.js
│   │   └── utils/          # Funções reutilizáveis (aquelas que criamos)
│   │       ├── puppeteer-utils.js  # (aguardarContexto, preencherTexto...)
│   │       ├── excel-utils.js      # (Ler planilha, validar colunas)
│   │       └── navigation-utils.js # (Login, busca de frames)
│   └── frontend/           # PROCESSO DE RENDERIZAÇÃO (Interface)
│       ├── index.html
│       ├── renderer.js     # Lógica da tela (botões, atualizar logs)
│       └── styles/         # CSS
│           ├── input.css
│           └── output.css (gerado pelo Tailwind)
├── logs/                   # Pasta para salvar logs em txt (opcional)
├── package.json
├── tailwind.config.js
└── .gitignore
```

## 📝 Licença
© 2026 Todos os direitos Reservados. **Desenvolvido para uso interno GEFIN(Gerência Financeira da Subsecretaria do Tesouro Estadual de Goiás).**
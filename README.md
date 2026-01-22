# Aplicação para automação de Tarefas
Este repositório contém uma aplicação desenvolvida para automatizar tarefas repetitivas e melhorar a eficiência operacional. A aplicação é construída utilizando javascritp e diversas bibliotecas populares para facilitar a integração com diferentes serviços.

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
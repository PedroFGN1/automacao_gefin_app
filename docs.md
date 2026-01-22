# Funcionalidades do App

## 1. Gerenciador de Perfis de Execução
- O usuário seleciona "O que quer fazer hoje?" com opções como:
  - Restituição de Fiança
  - Pagamento Direto
  - Consulta de CPF
- Cada perfil carrega configurações diferentes:
  - URLs específicas
  - Colunas esperadas no Excel

## 2. Seletor de Arquivo Inteligente
- Input para selecionar o arquivo .xlsx
- Validação prévia que avisa se:
  - A planilha não possui as colunas obrigatórias
  - O formato está incorreto para o perfil selecionado

## 3. Console de Logs Visual
- Painel na interface que mostra status em tempo real:
  - "Linha 1: OK"
  - "Linha 2: Erro no CPF"
- Log de erros com destaque visual (vermelho)

## 4. Botão de Pânico (Stop)
- Capacidade de interromper o robô a qualquer momento
- Sem necessidade de fechar o programa inteiro

## 5. Evidências Automáticas
- Pasta configurável para armazenar prints
- Salva evidências de sucesso e erro automaticamente
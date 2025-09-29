# Gerenciador Financeiro Pessoal

Um aplicativo web simples e responsivo para gerenciar finanças pessoais. Permite registrar entradas mensais (salário, investimentos, vale-refeição), adicionar despesas por categoria, visualizar saldo, histórico de transações e um gráfico de distribuição de despesas.

## Recursos

- **Entradas Mensais**: Registre salário líquido, renda de investimentos e vale-refeição. Permite atualizar um, dois ou todos os campos, preservando valores existentes.
- **Registro de Despesas**: Adicione despesas com descrição, valor e categoria (Alimentação, Moradia/Contas, Transporte, Saúde, Lazer, Educação, Outros).
- **Dashboard**: Visualize entradas totais, despesas registradas, saldo atual e distribuição de despesas via gráfico donut (usando D3.js).
- **Histórico**: Lista de transações com opção de exclusão.
- **Segurança**: Botão para ocultar/mostrar valores sensíveis.
- **Armazenamento Local**: Dados salvos no navegador (localStorage), sem necessidade de servidor.
- **Responsivo**: Interface adaptável para desktop e mobile, usando Tailwind CSS.

## Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3 (com Tailwind CSS via CDN), JavaScript (ES6+).
- **Bibliotecas**: D3.js para gráficos.
- **Armazenamento**: localStorage do navegador.
- **Estilo**: Font Inter do Google Fonts, customizações em CSS.

## Como Executar

1. Clone ou baixe os arquivos para uma pasta local.
2. Abra o arquivo `Gerenciador Financeiro.html` em qualquer navegador moderno (Chrome, Firefox, Edge, etc.).
3. O app carrega automaticamente e usa o armazenamento local do navegador.

Não requer instalação de dependências ou servidor, pois é uma aplicação estática.

## Uso

### 1. Configurar Entradas Mensais
- No card "Entradas Mensais Essenciais", preencha um ou mais campos (ex: apenas salário).
- Clique em "Salvar Entradas". Uma mensagem confirma a atualização.
- Valores são preservados se não alterados.

### 2. Registrar Despesas
- No card "Lançar Nova Despesa", insira descrição, valor e selecione categoria.
- Clique em "Registrar Despesa". A transação é adicionada ao histórico e atualiza o dashboard.

### 3. Visualizar Dashboard
- Cards mostram entradas, despesas e saldo.
- Seção "Distribuição de Despesas": 
  - Sem despesas: Layout compacto com mensagem.
  - Com despesas: Gráfico donut e resumo por categoria.
- Clique no ícone de olho no header para ocultar valores (mostra asteriscos).

### 4. Gerenciar Histórico
- Lista de despesas com detalhes (descrição, categoria, data, valor).
- Clique no ícone de lixeira para excluir uma transação.

### Validações
- Entradas: Números válidos nos campos preenchidos; pelo menos um campo deve ser preenchido.
- Despesas: Todos os campos obrigatórios; valor > 0.

## Limitações
- Dados armazenados localmente: Perdem-se se limpar o cache/navegador ou trocar de dispositivo.
- Sem autenticação ou backup em nuvem.
- Gráficos baseados em D3.js; requer conexão para CDN (Tailwind e D3).

## Contribuições
Sinta-se à vontade para abrir issues ou pull requests no repositório.

## Licença
Projeto open-source sob licença MIT. Use e modifique livremente.

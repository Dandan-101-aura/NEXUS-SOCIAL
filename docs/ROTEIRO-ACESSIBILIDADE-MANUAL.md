# Roteiro manual de acessibilidade

## Status desta execução

**Não executado:** todos os passos abaixo. Este roteiro foi criado para validação manual futura. Os testes automatizados com axe e Playwright não substituem leitor de tela, teclado real nem a verificação de zoom do navegador.

## Preparação

1. Inicie a aplicação em um servidor HTTP local e abra-a no Firefox ou Chrome.
2. Deixe o NVDA ativo para os passos da seção 1; repita os passos principais nos dois navegadores.
3. Use dados fictícios e crie uma solicitação de teste pelo formulário normal.
4. Repita as verificações de leitura, foco e controles nos temas claro e escuro.

## 1. NVDA com Firefox e Chrome

1. Na página pública, use a navegação por títulos e landmarks. Confirme a leitura do idioma português, do título principal, do cabeçalho, da navegação, do conteúdo principal e do rodapé.
2. Pressione Tab ao carregar a página. Confirme que o primeiro foco é “Pular para o conteúdo principal”; ative-o e verifique que o conteúdo principal recebe o foco.
3. Abra a demonstração. Confirme que a tela, o título principal e a mudança de título da janela são anunciados de forma compreensível.
4. Em Painel, Solicitações, Cadastro, Detalhes e Histórico, percorra os títulos e landmarks. Confirme um título principal por tela e a hierarquia dos títulos secundários.
5. Em Solicitações, leia cada cartão. Confirme que status e urgência têm texto perceptível, não apenas cor ou posição.
6. No Cadastro, percorra todos os campos e confirme a leitura dos rótulos, instruções e mensagens associadas.
7. Envie o formulário vazio. Confirme o anúncio e o foco no resumo de erros; ative cada link do resumo e confirme que o campo correspondente recebe foco e que o erro é anunciado junto ao campo.
8. Cadastre uma solicitação válida. Confirme o anúncio de sucesso sem mudança inesperada de foco.
9. Acione uma ação que abra o diálogo de confirmação. Confirme o nome e a descrição do diálogo, o foco inicial, o confinamento do foco, o anúncio de erros, o fechamento por Escape e o retorno ao botão de origem.
10. Em Dados e privacidade, selecione um backup JSON válido. Confirme que o diálogo de pré-visualização anuncia o resumo e avisos, que o foco permanece dentro do diálogo, que Cancelar e Escape fecham sem importar e que o foco retorna ao controle que o abriu.
11. Repita a seleção com um arquivo inválido. Confirme que o erro é anunciado sem mover o foco para fora do diálogo.
12. Acione toasts de sucesso e erro. Confirme os anúncios apropriados, que o foco não é roubado e que cada toast pode ser dispensado.

## 2. Navegação somente por teclado

1. Recarregue a página e use apenas Tab, Shift+Tab, Enter, Espaço, setas e Escape; não use mouse ou touch.
2. Confirme a ordem de foco e a visibilidade do indicador em cada controle. Verifique a página pública, navegação, todas as telas, filtros, formulário, detalhes, histórico, dados e privacidade e controles de tema/perfil.
3. Ative os links de navegação e confirme que cada mudança de rota leva o foco ao título da tela. A carga inicial deve manter o foco no skip link, sem movê-lo automaticamente.
4. No formulário, percorra todos os campos, seletores e ações; envie dados inválidos e use os links do resumo.
5. Abra os dois diálogos. Use Tab e Shift+Tab repetidamente para confirmar o ciclo do foco; tente acionar o conteúdo ao fundo e confirme que ele não recebe foco. Feche por Escape e confirme o retorno ao acionador.
6. Dispense toasts pelo teclado e confirme que o foco continua previsível.

## 3. Zoom do navegador a 200% e viewport estreito

1. Ajuste o zoom do navegador para 200% e a janela para uma largura efetiva de 320 CSS px.
2. Repita a inspeção na página pública, Painel, Solicitações, Cadastro sem/com erros, Detalhes, Histórico e diálogos de ação/importação.
3. Confirme que não há rolagem horizontal da página, texto ou controles cortados, sobreposição de conteúdo ou perda da ordem de leitura.
4. Confirme que os campos, botões, seletores, menu móvel, indicadores de foco e ações dos diálogos continuam alcançáveis e utilizáveis.
5. Repita nos temas claro e escuro; registre navegador, sistema, dimensões, falhas e passos para reproduzi-las.

## Registro

Para cada navegador e tema, anote a data, a versão do NVDA/navegador, o resultado de cada passo, eventuais barreiras e evidências. Não marque uma verificação como concluída sem executá-la manualmente.

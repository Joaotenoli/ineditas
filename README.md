# Inéditas

Questões inéditas para qualquer concurso do Brasil, geradas com o **seu plano do Claude ou do ChatGPT**. Nada de chave de API: o uso sai da assinatura que você já paga (Claude Pro ou Max, ChatGPT Plus ou Pro).

- Cadernos por esfera (federal, regional, estadual, distrital, municipal), cidade, órgão, cargo, banca e dificuldade
- Questões a partir de uma lei colada ou do conteúdo programático do edital
- Gabarito comentado com o artigo da lei, tesoura para riscar alternativas
- Banco de questões com filtros, simulados com cartão-resposta e desempenho por disciplina

## Baixar

Vá em **[Releases](../../releases/latest)** e baixe o arquivo do seu computador:

| Computador | Arquivo |
| --- | --- |
| Mac com chip Apple (M1, M2, M3, M4…) | `Ineditas-…-mac-arm64.dmg` |
| Mac com Intel | `Ineditas-…-mac-x64.dmg` |
| Windows | `Ineditas-…-win-x64.zip` |

### Instalar no Mac

1. Abra o `.dmg` e arraste o **Ineditas** para a pasta **Aplicativos**.
2. Abra o Ineditas. Como o app ainda não é assinado pela Apple, o Mac avisa que não pode verificar o app. Clique em **OK** (não em "Mover para o Lixo").
3. Abra **Ajustes do Sistema → Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim** ao lado de "Ineditas foi bloqueado". Confirme com a sua senha do Mac.
4. Pronto: nas próximas vezes, ele abre direto.

Se o Mac disser que o app "está danificado", abra o Terminal e rode `xattr -cr /Applications/Ineditas.app`. Depois abra de novo.

### Instalar no Windows

1. Descompacte o `.zip` numa pasta.
2. Abra o **Ineditas.exe**. Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo** (o app ainda não é assinado).

## Conectar o seu plano

O Inéditas usa os programas oficiais para entrar na sua conta:

- **ChatGPT:** não precisa instalar nada. O Codex (o programa oficial da OpenAI, de código aberto) já vem dentro do Inéditas.
- **Claude:** não precisa instalar nada antes. Na primeira vez que você clicar em Entrar com Claude, o Inéditas instala o Claude Code com o instalador oficial da Anthropic (leva cerca de 30 segundos).

Depois, no Inéditas: entre com qualquer e-mail e senha (se ainda não tiver conta, ela é criada na hora e fica só no seu computador) ou como visitante, abra **Preferências** e escolha **Entrar com Claude** ou **Entrar com ChatGPT**. O login oficial abre no navegador. O app recusa logins por chave de API.

Os cadernos ficam na pasta **Documentos/Inéditas** do seu computador.

## Outras formas de usar

- **No Claude, sem instalar:** https://claude.ai/artifact/8gjP4g5YXsQUtHWS9YpuQG (usa o plano do Claude de quem abre)
- **No ChatGPT:** adicione `https://ineditas-questoes.vercel.app/mcp` em chatgpt.com/plugins → + → Add custom MCP server

## Para desenvolver

```bash
npm install
npm run abrir     # abre o app
npm run mac       # gera o .dmg em dist/
npm run win       # gera o .zip do Windows em dist/
```

A página fica em `app/index.html` e o servidor local em `app/servidor.mjs` (só atende o próprio computador, em 127.0.0.1:5199).

Questões geradas por IA: confira o fundamento no texto oficial da lei antes de publicar.

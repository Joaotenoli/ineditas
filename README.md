# Inédita

Questões inéditas para qualquer concurso do Brasil, geradas com o **seu plano do Claude ou do ChatGPT**. Nada de chave de API: o uso sai da assinatura que você já paga (Claude Pro ou Max, ChatGPT Plus ou Pro).

- Cadernos por esfera (federal, regional, estadual, distrital, municipal), cidade, órgão, cargo, banca e dificuldade
- Questões a partir de uma lei colada ou do conteúdo programático do edital
- Gabarito comentado com o artigo da lei, tesoura para riscar alternativas
- Banco de questões com filtros, simulados com cartão-resposta e desempenho por disciplina

## Baixar

Vá em **[Releases](../../releases/latest)** e baixe o arquivo do seu computador:

| Computador | Arquivo |
| --- | --- |
| Mac com chip Apple (M1, M2, M3, M4…) | `Inedita-…-mac-arm64.dmg` |
| Mac com Intel | `Inedita-…-mac-x64.dmg` |
| Windows | `Inedita-…-win-x64.zip` |

### Instalar no Mac

1. Abra o `.dmg` e arraste o **Inedita** para a pasta Aplicativos.
2. Na primeira vez, clique com o botão direito no app e escolha **Abrir** (o app ainda não é assinado pela Apple, então o Mac pede essa confirmação uma vez).
3. Se o Mac disser que o app "está danificado", abra o Terminal e rode `xattr -cr /Applications/Inedita.app`. Depois abra de novo.

### Instalar no Windows

1. Descompacte o `.zip` numa pasta.
2. Abra o **Inedita.exe**. Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo** (o app ainda não é assinado).

## Conectar o seu plano

O Inédita usa os programas oficiais para entrar na sua conta:

- **Claude:** o [Claude Code](https://claude.com/claude-code) precisa estar instalado.
- **ChatGPT:** no Mac, basta o app do ChatGPT (ele já traz o Codex). No Windows, instale o Codex (`npm install -g @openai/codex`).

Depois, no Inédita: crie a sua conta (nome, e-mail e senha, salvos só no seu computador), clique em **Entrar** e escolha **Entrar com Claude** ou **Entrar com ChatGPT**. O login oficial abre no navegador. O app recusa logins por chave de API.

Os cadernos ficam na pasta **Documentos/Inédita** do seu computador.

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

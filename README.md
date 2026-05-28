# Copa do Mundo das Vendas — Tênis One

Sistema demonstrativo para GitHub Pages com:

- Placar por duplas/equipes.
- Lançamento diário de vendas pelo gerente.
- Fechamento de rodada diária.
- Gols por dezena:
  - Dias 01 a 10: vitória do dia = 1 gol.
  - Dias 11 a 20: vitória do dia = 2 gols.
  - Dias 21 a 30: vitória do dia = 3 gols.
- Bônus de dezena: +3 gols para a dupla com maior faturamento da dezena na demo.
- Ranking individual/Artilheiro.
- Figurinhas dos vendedores.
- Exportação de relatório em PDF.
- Firebase Realtime Database opcional.
- Cloudinary opcional para upload de fotos.

## PIN da demo

PIN padrão:

```txt
2026
```

Altere em `config.js`:

```js
demoPin: "2026"
```

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos deste ZIP para a raiz do repositório.
3. Vá em **Settings > Pages**.
4. Em **Build and deployment**, escolha:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Salve.
6. Abra a URL gerada pelo GitHub Pages.

## Como configurar Firebase Realtime Database

No Firebase:

1. Crie um projeto.
2. Adicione um app Web.
3. Copie o objeto `firebaseConfig`.
4. Crie um Realtime Database.
5. Ative Authentication > Sign-in method > Anonymous.
6. Cole os dados no arquivo `config.js`.

Exemplo:

```js
firebase: {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx"
}
```

## Regras sugeridas para demonstração no Realtime Database

Arquivo também incluído em `firebase-rules-demo.json`.

```json
{
  "rules": {
    "copaTenisOne": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

Atenção: isso serve para demonstração com login anônimo. Para produção, o ideal é criar autenticação real por usuário e regras por perfil.

## Como configurar Cloudinary

1. Entre no painel Cloudinary.
2. Crie um Upload Preset com modo **Unsigned**.
3. Copie:
   - Cloud name
   - Upload preset
4. Cole em `config.js`:

```js
cloudinary: {
  cloudName: "SEU_CLOUD_NAME",
  uploadPreset: "SEU_UPLOAD_PRESET_UNSIGNED"
}
```

Sem Cloudinary configurado, o sistema permite enviar foto em modo local demonstrativo.

## Observação importante sobre a regra do bônus

O Saulo informou:

> "A dupla que fechar a dezena com a maior meta batida ganha +3 gols."

Como a meta exata ainda não foi definida, esta demo interpreta como:

> A dupla com maior faturamento da dezena ganha +3 gols.

No sistema final, essa regra deve ser confirmada:
- maior faturamento absoluto;
- maior percentual da meta;
- meta igual para as duas duplas;
- meta diferente por dupla;
- ou cálculo manual aprovado pelo gerente.

## Estrutura dos arquivos

```txt
index.html
styles.css
app.js
config.js
firebase-rules-demo.json
README.md
```

thIAguinho Soluções — tecnologia sob medida.

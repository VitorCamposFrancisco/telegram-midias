# Telegram Audio QR Code

Bot do Telegram em Node.js que recebe áudios ou mensagens de voz, salva os arquivos no Cloudflare R2, gera um QR Code apontando para o link público do áudio e responde no Telegram com a imagem do QR Code.

## Requisitos

- Node.js instalado
- Um bot criado no BotFather
- Um bucket no Cloudflare R2 chamado `telegram-midias`
- Credenciais de acesso do Cloudflare R2
- Uma URL pública configurada para acessar os arquivos do bucket
- ngrok para testar o webhook localmente

## Instalar dependencias

Entre na pasta do projeto:

```powershell
cd telegram-audio-qrcode
```

Instale as dependências:

```powershell
npm install
```

## Configurar o .env

Copie o arquivo de exemplo:

```powershell
Copy-Item .env.example .env
```

Preencha o arquivo `.env`:

```env
TELEGRAM_BOT_TOKEN=seu_token_do_bot
R2_ENDPOINT=https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=sua_access_key
R2_SECRET_ACCESS_KEY=sua_secret_key
R2_BUCKET_NAME=telegram-midias
R2_PUBLIC_URL=https://sua-url-publica-do-r2/
PORT=3000
```

Importante: `R2_PUBLIC_URL` deve apontar para a URL pública do bucket ou domínio público configurado no Cloudflare R2. Ela será combinada com os caminhos `audios/...` e `qrcodes/...`.

## Rodar localmente

```powershell
node index.js
```

Ou:

```powershell
npm start
```

Teste no navegador:

```text
http://localhost:3000/
```

A resposta esperada é:

```text
Bot de áudio + QR Code rodando.
```

## Testar com ngrok

Com o servidor local rodando na porta `3000`, abra outro terminal e rode:

```powershell
ngrok http 3000
```

Copie a URL HTTPS gerada pelo ngrok, por exemplo:

```text
https://SUA_URL_NGROK.ngrok-free.app
```

## Configurar o webhook do Telegram

Use a URL HTTPS do ngrok com o caminho `/telegram/webhook`.

PowerShell:

```powershell
Invoke-RestMethod "https://api.telegram.org/botSEU_TOKEN/setWebhook?url=https://SUA_URL_NGROK.ngrok-free.app/telegram/webhook"
```

cURL:

```bash
curl "https://api.telegram.org/botSEU_TOKEN/setWebhook?url=https://SUA_URL_NGROK.ngrok-free.app/telegram/webhook"
```

Troque `SEU_TOKEN` pelo token real do BotFather e `SUA_URL_NGROK.ngrok-free.app` pela URL real do ngrok.

## Como testar o bot

1. Abra o Telegram.
2. Encontre o seu bot.
3. Envie uma mensagem de voz ou um arquivo de audio.
4. O bot deve responder com uma imagem de QR Code.
5. A legenda da imagem terá o link público do áudio.

Se voce enviar uma mensagem sem audio, o bot respondera:

```text
Envie um áudio ou mensagem de voz para eu gerar o QR Code.
```

## Confirmar upload no Cloudflare R2

No painel da Cloudflare, abra o bucket `telegram-midias` e confira as pastas:

```text
audios/YYYY-MM-DD/
qrcodes/YYYY-MM-DD/
```

Os áudios ficam em:

```text
audios/YYYY-MM-DD/audio_<chatId>_<messageId>.<extensao>
```

Os QR Codes ficam em:

```text
qrcodes/YYYY-MM-DD/qr_audio_<chatId>_<messageId>.png
```

## Observacoes

- Esta primeira versão não usa banco de dados.
- Esta primeira versão não usa fila.
- O webhook responde HTTP 200 rapidamente e processa o áudio depois.
- Para MVP local com mais de 400 áudios, mantenha o computador e o ngrok rodando durante os testes.

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const QRCode = require("qrcode");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
app.use(express.json());

const {
  TELEGRAM_BOT_TOKEN,
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  PORT = 3000,
} = process.env;

function validateEnv() {
  const requiredVars = [
    "TELEGRAM_BOT_TOKEN",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ];

  const missingVars = requiredVars.filter((name) => !process.env[name]);

  if (missingVars.length > 0) {
    console.error("Erro: variaveis de ambiente obrigatorias ausentes:");
    missingVars.forEach((name) => console.error(`- ${name}`));
    console.error("Preencha o arquivo .env antes de iniciar o bot.");
    process.exit(1);
  }
}

validateEnv();

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function getTodayFolder() {
  return new Date().toISOString().slice(0, 10);
}

function getFileExtension(filePath, fallback = "ogg") {
  if (!filePath || typeof filePath !== "string") {
    return fallback;
  }

  const cleanPath = filePath.split("?")[0];
  const lastPart = cleanPath.split("/").pop();

  if (!lastPart || !lastPart.includes(".")) {
    return fallback;
  }

  const extension = lastPart.split(".").pop();
  return extension || fallback;
}

function normalizePublicBaseUrl(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  await axios.post(url, {
    chat_id: chatId,
    text,
  });
}

async function sendTelegramPhoto(chatId, photoUrl, caption) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

  await axios.post(url, {
    chat_id: chatId,
    photo: photoUrl,
    caption,
  });
}

async function getTelegramFile(fileId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`;
  const response = await axios.get(url, {
    params: {
      file_id: fileId,
    },
  });

  if (!response.data || !response.data.ok || !response.data.result) {
    throw new Error(`Resposta invalida do Telegram getFile: ${JSON.stringify(response.data)}`);
  }

  return response.data.result;
}

async function downloadTelegramFile(filePath) {
  const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
  });

  return Buffer.from(response.data);
}

async function uploadToR2(key, body, contentType) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3.send(command);
}

async function processTelegramAudio(message) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const media = message.voice || message.audio;
  const fileId = media.file_id;

  const telegramFile = await getTelegramFile(fileId);
  const filePath = telegramFile.file_path;
  const extension = getFileExtension(filePath, "ogg");
  const todayFolder = getTodayFolder();

  const audioBuffer = await downloadTelegramFile(filePath);
  const audioKey = `audios/${todayFolder}/audio_${chatId}_${messageId}.${extension}`;
  const audioContentType = `audio/${extension}`;

  await uploadToR2(audioKey, audioBuffer, audioContentType);

  const publicBaseUrl = normalizePublicBaseUrl(R2_PUBLIC_URL);
  const audioPublicUrl = `${publicBaseUrl}${audioKey}`;

  const qrCodeBuffer = await QRCode.toBuffer(audioPublicUrl, {
    type: "png",
    margin: 2,
    width: 500,
  });

  const qrCodeKey = `qrcodes/${todayFolder}/qr_audio_${chatId}_${messageId}.png`;
  await uploadToR2(qrCodeKey, qrCodeBuffer, "image/png");

  const qrCodePublicUrl = `${publicBaseUrl}${qrCodeKey}`;
  const caption = `QR Code gerado com sucesso.\n\nLink do audio:\n${audioPublicUrl}`;

  await sendTelegramPhoto(chatId, qrCodePublicUrl, caption);
}

app.get("/", (req, res) => {
  res.send("Bot de áudio + QR Code rodando.");
});

app.post("/telegram/webhook", (req, res) => {
  res.sendStatus(200);

  const message = req.body && req.body.message;

  if (!message) {
    return;
  }

  const chatId = message.chat && message.chat.id;

  Promise.resolve()
    .then(async () => {
      if (!message.voice && !message.audio) {
        await sendTelegramMessage(
          chatId,
          "Envie um áudio ou mensagem de voz para eu gerar o QR Code."
        );
        return;
      }

      await processTelegramAudio(message);
    })
    .catch(async (error) => {
      console.error("Erro ao processar update do Telegram:", error);

      if (chatId) {
        try {
          await sendTelegramMessage(
            chatId,
            "Deu erro ao processar o áudio. Tente novamente com um áudio menor."
          );
        } catch (telegramError) {
          console.error("Erro ao enviar mensagem de erro ao Telegram:", telegramError);
        }
      }
    });
});

app.listen(PORT, () => {
  console.log(`Bot de áudio + QR Code rodando na porta ${PORT}.`);
});

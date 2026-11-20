import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Content, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import { TAJIKISTAN_CODES, TajikistanCode } from './src/data/tajikistanCodes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(code: TajikistanCode, attachedText?: string): string {
  const sectionsList = code.keySections.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
  const effectiveLine = code.effectiveNote ? ` (${code.effectiveNote})` : '';

  const baseRules = [
    `Ты — специализированный юридический ассистент по законодательству Республики Таджикистан.`,
    `Сейчас пользователь открыл исключительно один нормативный правовой акт:`,
    `Название: ${code.titleRu} (${code.titleTj})`,
    `Реквизиты: Закон Республики Таджикистан ${code.lawNumber} от ${code.adoptedDate}${effectiveLine}.`,
    `Основные разделы кодекса:\n${sectionsList}`,
    ``,
    `СТРОГИЕ ПРАВИЛА ОТВЕТА:`,
    `1. Отвечай СТРОГО по тексту, нормам и статьям исключительно выбранного кодекса («${code.titleRu}»).`,
    `2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО ссылаться на кодексы других государств (Российской Федерации, Казахстана, Узбекистана и др.) или выдавать нормы иных законов за статьи данного кодекса.`,
    `3. Используй поиск (Google Search), чтобы при необходимости сверять точные номера статей, частей, пунктов и актуальные редакции на официальных правовых ресурсах Таджикистана (mmk.tj, portali-huquqi.tj, adlia.tj, continent-online.com).`,
    `4. В каждом ответе указывай конкретные структурные ссылки: номер статьи (и, если применимо, часть, пункт, глава/раздел) выбранного кодекса, например: **Статья 45** или **Часть 2 статьи 118**. Приводи точный смысл и ключевые формулировки нормы.`,
    `5. Если вопрос пользователя выходит за пределы предмета регулирования «${code.titleRu}» (например, вопрос об уголовном преступлении задан в чате Трудового кодекса), прямо сообщи, что данный вопрос не регулируется выбранным кодексом, и корректно подскажи, какой именно кодекс или закон Республики Таджикистан следует выбрать в каталоге.`,
    `6. Если в открытых официальных источниках не удаётся достоверно подтвердить точный номер подпункта или редкую поправку, честно укажи это, не выдумывай несуществующие номера статей.`,
    `7. Форматируй ответ чётко и академично на русском языке: краткий прямой вывод, затем правовое обоснование со ссылками на конкретные статьи кодекса, а при необходимости — пошаговые условия/исключения из текста статьи.`,
  ];

  if (attachedText && attachedText.trim().length > 0) {
    baseRules.push(
      ``,
      `ПОЛЬЗОВАТЕЛЬ ТАКЖЕ ПРИКРЕПИЛ ФРАГМЕНТ ТЕКСТА ДЛЯ АНАЛИЗА:`,
      `При ответе в первую очередь опирайся строго на приведённый ниже текст. Цитируй его статьи и пункты дословно и укажи, если прикреплённый фрагмент не содержит ответа на вопрос:`,
      `--- НАЧАЛО ПРИКРЕПЛЁННОГО ТЕКСТА ---`,
      attachedText.trim().slice(0, 24000),
      `--- КОНЕЦ ПРИКРЕПЛЁННОГО ТЕКСТА ---`
    );
  }

  return baseRules.join('\n');
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GroundingSource {
  title: string;
  url: string;
}

function formatErrorForClient(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403') || lower.includes('not configured')) {
    return {
      status: 403,
      message: 'API-ключ Gemini не настроен или недействителен. Проверьте ключ в панели Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message: 'Превышен лимит запросов к ИИ. Подождите немного и повторите запрос.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Указанная модель ИИ недоступна.',
    };
  }
  return {
    status: 500,
    message: `Ошибка при обращении к ИИ: ${raw}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    const { codeId, messages, attachedText } = req.body as {
      codeId?: string;
      messages?: IncomingMessage[];
      attachedText?: string;
    };

    const code = TAJIKISTAN_CODES.find((c) => c.id === codeId);
    if (!code) {
      res.status(400).json({ error: 'Выбранный кодекс не найден в справочнике.' });
      return;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Передайте сообщение пользователя.' });
      return;
    }

    const recentMessages = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-12);

    if (recentMessages.length === 0) {
      res.status(400).json({ error: 'Пустое сообщение.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const ai = getGenAIClient();
      const contents: Content[] = recentMessages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const systemInstruction = buildSystemInstruction(code, attachedText);

      let streamResult: AsyncIterable<GenerateContentResponse> | null = null;
      let lastErr: unknown;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          streamResult = await ai.models.generateContentStream({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              systemInstruction,
              tools: attachedText && attachedText.trim().length > 0 ? undefined : [{ googleSearch: {} }],
            },
          });
          break;
        } catch (err) {
          lastErr = err;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }

      if (!streamResult) {
        throw lastErr ?? new Error('Не удалось получить поток ответа от модели.');
      }

      const sourceMap = new Map<string, GroundingSource>();

      for await (const chunk of streamResult) {
        const textChunk = chunk.text;
        if (textChunk) {
          sendEvent({ type: 'delta', text: textChunk });
        }

        const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(chunks)) {
          for (const item of chunks) {
            const uri = item.web?.uri;
            const title = item.web?.title;
            if (uri && !sourceMap.has(uri)) {
              sourceMap.set(uri, {
                url: uri,
                title: title || uri,
              });
            }
          }
        }
      }

      const sources = Array.from(sourceMap.values()).slice(0, 6);
      if (sources.length > 0) {
        sendEvent({ type: 'sources', sources });
      }

      sendEvent({ type: 'done' });
      res.end();
    } catch (err) {
      const formatted = formatErrorForClient(err);
      sendEvent({ type: 'error', message: formatted.message, status: formatted.status });
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

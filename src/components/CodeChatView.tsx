import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Info,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { TAJIKISTAN_CODES, TajikistanCode } from '../data/tajikistanCodes';
import { GroundingSource, LegalMessageContent } from './LegalMessageContent';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: GroundingSource[];
  isError?: boolean;
}

interface CodeChatViewProps {
  code: TajikistanCode;
  messages: ChatMessage[];
  onUpdateMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onSelectCode: (code: TajikistanCode) => void;
  onBackToCatalog: () => void;
}

export const CodeChatView: React.FC<CodeChatViewProps> = ({
  code,
  messages,
  onUpdateMessages,
  onSelectCode,
  onBackToCatalog,
}) => {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedText, setAttachedText] = useState('');
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const [showMobilePassport, setShowMobilePassport] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Abort ongoing stream if user switches code or unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [code.id]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedText(reader.result.slice(0, 24000));
        setShowAttachmentPanel(true);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const sendMessage = async (questionText?: string) => {
    const trimmed = (questionText ?? input).trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantMsgId = `assistant-${Date.now() + 1}`;
    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    };

    const historyPayload = [...messages.filter((m) => !m.isError), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    onUpdateMessages((prev) => [...prev, userMsg, placeholderAssistant]);
    if (!questionText) setInput('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId: code.id,
          messages: historyPayload,
          attachedText: attachedText.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let errText = `Ошибка сервера (${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error) errText = errJson.error;
        } catch {
          // ignore JSON parse failure
        }
        throw new Error(errText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const dataLine = rawEvent
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const payload = JSON.parse(dataLine.slice(6)) as {
              type: 'delta' | 'sources' | 'done' | 'error';
              text?: string;
              sources?: GroundingSource[];
              message?: string;
            };

            if (payload.type === 'delta' && payload.text) {
              const deltaText = payload.text;
              onUpdateMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: m.content + deltaText } : m
                )
              );
            } else if (payload.type === 'sources' && payload.sources) {
              const sources = payload.sources;
              onUpdateMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, sources } : m))
              );
            } else if (payload.type === 'error') {
              throw new Error(payload.message || 'Не удалось получить ответ от ИИ.');
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              if (!parseErr.message.includes('JSON')) {
                throw parseErr;
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Произошла ошибка при обращении к сервису.';
      onUpdateMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: message, isError: true } : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleRetryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || isStreaming) return;
    onUpdateMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === lastUser.id);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    setTimeout(() => {
      sendMessage(lastUser.content);
    }, 30);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleClearChat = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    onUpdateMessages(() => []);
  };

  const PassportContent = (
    <div className="flex flex-col h-full">
      <div className="pb-4 border-b border-stone-200">
        <button
          type="button"
          onClick={onBackToCatalog}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B365D] hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Все кодексы РТ</span>
        </button>

        <div className="mt-4">
          <label htmlFor="code-switcher" className="block text-xs font-medium text-stone-500 mb-1.5">
            Переключить кодекс
          </label>
          <select
            id="code-switcher"
            value={code.id}
            onChange={(e) => {
              const found = TAJIKISTAN_CODES.find((c) => c.id === e.target.value);
              if (found) onSelectCode(found);
            }}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-[#1B365D] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/15"
          >
            {TAJIKISTAN_CODES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.index}. {c.shortTitleRu}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="py-5 space-y-5 overflow-y-auto flex-1">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500 tabular-nums">
            <span className="font-mono font-medium text-[#8C6D2F]">{code.index}</span>
            <span aria-hidden="true">·</span>
            <span>{code.categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{code.lawNumber}</span>
          </div>
          <h2 className="mt-2 font-serif text-xl font-semibold text-stone-900 leading-snug">
            {code.titleRu}
          </h2>
          <p className="mt-1 text-xs text-stone-500">{code.titleTj}</p>
          <p className="mt-2 text-xs text-stone-500 tabular-nums">
            Принят: {code.adoptedDate}
            {code.effectiveNote ? ` · ${code.effectiveNote}` : ''}
          </p>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h3 className="text-xs font-semibold text-stone-900 mb-2">Предмет регулирования</h3>
          <p className="text-xs text-stone-600 leading-relaxed">{code.description}</p>
        </div>

        <div className="border-t border-stone-200 pt-4">
          <h3 className="text-xs font-semibold text-stone-900 mb-2.5">Основные разделы</h3>
          <ol className="space-y-2">
            {code.keySections.map((section, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-stone-700 leading-snug">
                <span className="font-mono text-[11px] text-stone-400 tabular-nums shrink-0 mt-0.5">
                  {String(idx + 1).padStart(2, '0')}.
                </span>
                <span>{section}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 h-[calc(100vh-58px)] flex flex-col lg:flex-row gap-6 py-4 lg:py-6">
      {/* Desktop Passport Sidebar */}
      <aside className="hidden lg:flex lg:w-80 shrink-0 flex-col rounded-xl border border-stone-200 bg-white p-5 overflow-hidden">
        {PassportContent}
      </aside>

      {/* Mobile Passport Drawer */}
      {showMobilePassport && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-stone-900/40"
            onClick={() => setShowMobilePassport(false)}
          />
          <aside className="relative z-10 w-80 max-w-[85vw] bg-white h-full p-5 shadow-xl flex flex-col overflow-hidden">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setShowMobilePassport(false)}
                aria-label="Закрыть паспорт кодекса"
                className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {PassportContent}
          </aside>
        </div>
      )}

      {/* Main Chat Column */}
      <section className="flex-1 flex flex-col min-w-0 rounded-xl border border-stone-200 bg-white overflow-hidden">
        {/* Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-[#FBF9F5] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMobilePassport(true)}
                aria-label="Открыть паспорт кодекса"
                className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-[#F2EEE6] rounded-md hover:bg-[#E7E1D5] cursor-pointer"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Паспорт</span>
              </button>
              <h1 className="font-serif text-lg sm:text-xl font-semibold text-stone-900 truncate">
                {code.shortTitleRu}
              </h1>
            </div>
            <p className="text-xs text-stone-500 mt-0.5 truncate">
              Ответы формируются строго по тексту и статьям выбранного кодекса
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAttachmentPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                attachedText.trim() || showAttachmentPanel
                  ? 'border-[#1B365D] bg-[#1B365D]/5 text-[#1B365D]'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{attachedText.trim() ? 'Фрагмент прикреплён' : 'Вставить текст статьи'}</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Очистить</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Attached Article Excerpt Panel */}
        {showAttachmentPanel && (
          <div className="border-b border-stone-200 bg-[#F7F4EE] px-4 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                <FileText className="h-4 w-4 text-[#1B365D]" aria-hidden="true" />
                <span>Текст статьи или фрагмент редакции для точного разбора</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Загрузить .txt</span>
                </button>
                {attachedText && (
                  <button
                    type="button"
                    onClick={() => setAttachedText('')}
                    className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    Удалить текст
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAttachmentPanel(false)}
                  aria-label="Свернуть панель фрагмента"
                  className="p-1 text-stone-500 hover:text-stone-900 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <textarea
              rows={3}
              value={attachedText}
              onChange={(e) => setAttachedText(e.target.value.slice(0, 24000))}
              placeholder="Вставьте сюда текст статьи или главы выбранного кодекса (необязательно). При наличии фрагмента ИИ проанализирует и процитирует его в первую очередь..."
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:border-[#1B365D] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/15"
            />
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 space-y-6">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-4">
              <div className="border-b border-stone-200 pb-5">
                <div className="text-xs text-stone-500 tabular-nums">
                  {code.categoryLabel} · Закон {code.lawNumber} от {code.adoptedDate}
                </div>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-stone-900">
                  Задайте вопрос по кодексу
                </h2>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                  ИИ-консультант найдёт нормы строго в тексте «{code.titleRu}» и укажет
                  конкретные статьи, части и пункты. Выберите готовый вопрос или сформулируйте
                  свой ниже.
                </p>
              </div>

              <div className="mt-5">
                <div className="text-xs font-medium text-stone-500 mb-3">
                  Примеры вопросов по данному кодексу
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {code.sampleQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="text-left rounded-lg border border-stone-200 bg-[#FBF9F5] p-3.5 text-sm text-stone-800 leading-snug hover:border-[#1B365D]/50 hover:bg-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-xl bg-[#1B365D] px-4 py-3 text-sm leading-relaxed text-white">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex justify-start">
                    <div
                      className={`w-full rounded-xl border px-5 py-4 ${
                        msg.isError
                          ? 'border-red-200 bg-red-50/70'
                          : 'border-stone-200 bg-[#FBF9F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 pb-2.5 mb-3 border-b border-stone-200/80">
                        <span className="text-xs font-semibold text-stone-700">
                          {code.shortTitleRu} · Ответ по статьям
                        </span>
                        {msg.content && !msg.isError && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                                <span className="text-emerald-700">Скопировано</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Копировать</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {msg.isError ? (
                        <div className="space-y-3">
                          <p className="text-sm text-red-800">{msg.content}</p>
                          <button
                            type="button"
                            onClick={handleRetryLast}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-800 bg-white border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Повторить запрос</span>
                          </button>
                        </div>
                      ) : msg.content ? (
                        <LegalMessageContent content={msg.content} sources={msg.sources} />
                      ) : (
                        <div className="py-2 text-sm text-stone-500">
                          Поиск и сверка статей кодекса...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <div className="border-t border-stone-200 bg-[#FBF9F5] px-4 py-3.5 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {attachedText.trim() && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700">
                <span className="truncate">
                  Анализ с опорой на прикреплённый текст ({attachedText.length.toLocaleString('ru-RU')} симв.)
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedText('')}
                  className="text-stone-500 hover:text-stone-900 shrink-0 cursor-pointer"
                >
                  Убрать
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-end gap-2.5 rounded-xl border border-stone-300 bg-white p-2 focus-within:border-[#1B365D] focus-within:ring-2 focus-within:ring-[#1B365D]/15 transition-colors"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Задайте вопрос по тексту «${code.shortTitleRu}»...`}
                aria-label="Вопрос по выбранному кодексу"
                className="flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none max-h-40"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1B365D] rounded-lg hover:bg-[#142947] disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{isStreaming ? 'Поиск...' : 'Спросить'}</span>
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>

            <p className="mt-2 text-[11px] text-stone-500 text-center">
              Ответы формируются строго по выбранному кодексу РТ и носят справочный характер.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

import React from 'react';
import { ExternalLink } from 'lucide-react';

export interface GroundingSource {
  title: string;
  url: string;
}

interface LegalMessageContentProps {
  content: string;
  sources?: GroundingSource[];
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Split by **bold** and *italic* and article references
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      const isArticle = /^(статья|ст\.|часть|ч\.|пункт|п\.|глава|раздел)/i.test(inner.trim());
      return (
        <strong
          key={i}
          className={isArticle ? 'font-semibold text-[#1B365D]' : 'font-semibold text-stone-900'}
        >
          {inner}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return (
        <em key={i} className="italic text-stone-700">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={i}
          className="font-mono text-[13px] px-1.5 py-0.5 bg-stone-100 text-stone-800 rounded"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{token}</React.Fragment>;
  });
}

export const LegalMessageContent: React.FC<LegalMessageContentProps> = ({ content, sources }) => {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} className="my-3 border-stone-200" />);
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h4-${i}`} className="font-serif text-base font-semibold text-stone-900 mt-4 mb-1.5">
          {renderInlineFormatting(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={`h3-${i}`} className="font-serif text-lg font-semibold text-stone-900 mt-4 mb-2">
          {renderInlineFormatting(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(
        <h3 key={`h1-${i}`} className="font-serif text-lg font-semibold text-stone-900 mt-4 mb-2">
          {renderInlineFormatting(line.slice(2))}
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote (styled cleanly with all-around hairline border, never border-l-4)
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="my-3 rounded-lg border border-stone-200 bg-[#F7F4EE] px-4 py-3 text-sm leading-relaxed text-stone-800"
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} className={qIdx > 0 ? 'mt-1.5' : ''}>
              {renderInlineFormatting(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-5 list-disc marker:text-stone-400">
          {items.map((item, idx) => (
            <li key={idx} className="text-[15px] leading-relaxed text-stone-800">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-5 list-decimal marker:text-stone-500 marker:font-mono marker:text-xs">
          {items.map((item, idx) => (
            <li key={idx} className="text-[15px] leading-relaxed text-stone-800">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-[15px] leading-[1.65] text-stone-800 my-2 first:mt-0 last:mb-0">
        {renderInlineFormatting(line)}
      </p>
    );
    i++;
  }

  return (
    <div>
      <div>{blocks}</div>
      {sources && sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-stone-200/80">
          <div className="text-xs font-medium text-stone-500 mb-2">
            Проверенные правовые источники
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {sources.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#1B365D] hover:underline"
              >
                <span className="truncate max-w-[260px]">{src.title}</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

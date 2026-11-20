import { useEffect, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { CodesCatalog } from './components/CodesCatalog';
import { ChatMessage, CodeChatView } from './components/CodeChatView';
import { CodeCategory, TAJIKISTAN_CODES, TajikistanCode } from './data/tajikistanCodes';

export default function App() {
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && TAJIKISTAN_CODES.some((c) => c.id === hash)) {
      return hash;
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | CodeCategory>('all');
  const [chatsByCode, setChatsByCode] = useState<Record<string, ChatMessage[]>>({});

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && TAJIKISTAN_CODES.some((c) => c.id === hash)) {
        setSelectedCodeId(hash);
      } else {
        setSelectedCodeId(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const selectedCode: TajikistanCode | null =
    selectedCodeId ? TAJIKISTAN_CODES.find((c) => c.id === selectedCodeId) ?? null : null;

  const handleSelectCode = (code: TajikistanCode) => {
    setSelectedCodeId(code.id);
    window.location.hash = code.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToCatalog = () => {
    setSelectedCodeId(null);
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
  };

  const handleFocusSearch = () => {
    if (selectedCode) {
      handleBackToCatalog();
    }
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleUpdateMessages = (
    codeId: string,
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) => {
    setChatsByCode((prev) => ({
      ...prev,
      [codeId]: updater(prev[codeId] ?? []),
    }));
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-stone-900">
      <TopBar
        activeView={selectedCode ? 'chat' : 'catalog'}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onBackToCatalog={handleBackToCatalog}
        onFocusSearch={handleFocusSearch}
      />

      {selectedCode ? (
        <CodeChatView
          code={selectedCode}
          messages={chatsByCode[selectedCode.id] ?? []}
          onUpdateMessages={(updater) => handleUpdateMessages(selectedCode.id, updater)}
          onSelectCode={handleSelectCode}
          onBackToCatalog={handleBackToCatalog}
        />
      ) : (
        <CodesCatalog
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onSelectCode={handleSelectCode}
          searchInputRef={searchInputRef}
        />
      )}
    </div>
  );
}

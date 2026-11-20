import React from 'react';
import { CodeCategory } from '../data/tajikistanCodes';

interface TopBarProps {
  activeView: 'catalog' | 'chat';
  activeCategory: 'all' | CodeCategory;
  onSelectCategory: (cat: 'all' | CodeCategory) => void;
  onBackToCatalog: () => void;
  onFocusSearch: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  activeCategory,
  onSelectCategory,
  onBackToCatalog,
  onFocusSearch,
}) => {
  const navItems: { id: 'all' | CodeCategory; label: string }[] = [
    { id: 'all', label: 'Все кодексы' },
    { id: 'civil_family', label: 'Гражданские' },
    { id: 'criminal_exec', label: 'Уголовные' },
    { id: 'procedural', label: 'Процессуальные' },
    { id: 'tax_customs', label: 'Налоги и таможня' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#FBF9F5]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => {
            onSelectCategory('all');
            onBackToCatalog();
          }}
          className="font-serif text-xl font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D] rounded-sm"
        >
          Кодексы РТ
        </button>

        {/* Zone 2: 4–5 single-line text nav links */}
        <nav
          aria-label="Основные разделы кодексов"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600"
        >
          {navItems.map((item) => {
            const isActive = activeView === 'catalog' && activeCategory === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectCategory(item.id);
                  if (activeView === 'chat') {
                    onBackToCatalog();
                  }
                }}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D] ${
                  isActive
                    ? 'border-[#1B365D] text-stone-900'
                    : 'border-transparent hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {activeView === 'chat' ? (
            <button
              type="button"
              onClick={onBackToCatalog}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1B365D] rounded-lg hover:bg-[#142947] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D] focus-visible:ring-offset-2"
            >
              Все кодексы
            </button>
          ) : (
            <button
              type="button"
              onClick={onFocusSearch}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1B365D] rounded-lg hover:bg-[#142947] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D] focus-visible:ring-offset-2"
            >
              Найти кодекс
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

import React from 'react';
import { ArrowRight, BookOpen, Search, X } from 'lucide-react';
import {
  CODE_CATEGORIES,
  CodeCategory,
  TAJIKISTAN_CODES,
  TajikistanCode,
} from '../data/tajikistanCodes';

interface CodesCatalogProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategory: 'all' | CodeCategory;
  onCategoryChange: (cat: 'all' | CodeCategory) => void;
  onSelectCode: (code: TajikistanCode) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const CodesCatalog: React.FC<CodesCatalogProps> = ({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  onSelectCode,
  searchInputRef,
}) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCodes = TAJIKISTAN_CODES.filter((code) => {
    const matchesCategory = activeCategory === 'all' || code.category === activeCategory;
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      code.titleRu,
      code.shortTitleRu,
      code.titleTj,
      code.categoryLabel,
      code.lawNumber,
      code.adoptedDate,
      code.description,
      ...code.keywords,
      ...code.keySections,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Editorial Masthead */}
      <section className="border-b border-stone-200 pb-8">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
          <span>Свод кодифицированного законодательства</span>
          <span aria-hidden="true">·</span>
          <span>Республика Таджикистан</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{TAJIKISTAN_CODES.length} действующих кодексов</span>
        </div>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-semibold tracking-tight text-stone-900 leading-[1.15] text-balance">
              Кодексы Республики Таджикистан
            </h1>
            <p className="mt-3 text-base text-stone-600 leading-relaxed max-w-2xl">
              Выберите нужный кодекс, чтобы открыть диалог с правовым ИИ-ассистентом. Ответ
              формируется строго на основании норм, разделов и статей выбранного документа.
            </p>
          </div>
        </div>

        {/* Search & Branch Segmented Controls */}
        <div className="mt-7 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Поиск кодекса по названию, номеру или теме (например: алименты, налог, увольнение)..."
                aria-label="Поиск кодекса"
                className="w-full rounded-lg border border-stone-300 bg-white pl-10 pr-9 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#1B365D] focus:outline-none focus:ring-2 focus:ring-[#1B365D]/15 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Очистить поиск"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-xs text-stone-500 tabular-nums sm:ml-auto">
              Показано {filteredCodes.length} из {TAJIKISTAN_CODES.length}
            </div>
          </div>

          {/* Interactive Branch Filter Tabs */}
          <div
            role="tablist"
            aria-label="Отрасли права"
            className="flex flex-wrap items-center gap-1.5"
          >
            {CODE_CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => onCategoryChange(cat.id)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D] ${
                    isSelected
                      ? 'bg-[#1B365D] text-white'
                      : 'bg-[#F2EEE6] text-stone-700 hover:bg-[#E7E1D5] hover:text-stone-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Codes Grid */}
      {filteredCodes.length === 0 ? (
        <section className="py-16 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-stone-400" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-xl font-semibold text-stone-900">
            Кодексы по запросу не найдены
          </h2>
          <p className="mt-1.5 text-sm text-stone-600">
            Попробуйте изменить ключевое слово или сбросить фильтр по отрасли права.
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onCategoryChange('all');
            }}
            className="mt-5 px-4 py-2 text-xs font-semibold text-white bg-[#1B365D] rounded-lg hover:bg-[#142947] transition-colors cursor-pointer"
          >
            Сбросить фильтры
          </button>
        </section>
      ) : (
        <section aria-label="Список кодексов Республики Таджикистан" className="pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredCodes.map((code) => (
              <button
                key={code.id}
                type="button"
                onClick={() => onSelectCode(code)}
                className="group flex flex-col text-left rounded-xl border border-stone-200 bg-white p-6 hover:border-[#1B365D]/45 hover:shadow-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D]"
              >
                {/* Unboxed typographic metadata kicker (no pill sandwiches) */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 tabular-nums">
                  <span className="font-mono font-medium text-[#8C6D2F]">{code.index}</span>
                  <span aria-hidden="true">·</span>
                  <span>{code.categoryLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{code.lawNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span>{code.adoptedDate}</span>
                </div>

                <h2 className="mt-3 font-serif text-xl font-semibold text-stone-900 leading-snug group-hover:text-[#1B365D] transition-colors">
                  {code.titleRu}
                </h2>

                <p className="mt-1 text-xs text-stone-500 leading-snug">{code.titleTj}</p>

                <p className="mt-3 text-sm text-stone-600 leading-relaxed line-clamp-3">
                  {code.description}
                </p>

                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between border-t border-stone-100 pt-3.5 text-xs font-semibold text-[#1B365D]">
                    <span>Открыть чат по кодексу</span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quiet Institutional Footer */}
      <footer className="mt-14 border-t border-stone-200 pt-6 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500">
        <div>
          Официальные источники законодательства: Национальный центр законодательства (mmk.tj) и
          портал правовой информации Министерства юстиции РТ (portali-huquqi.tj).
        </div>
        <div className="shrink-0">
          Справочно-информационная система
        </div>
      </footer>
    </main>
  );
};

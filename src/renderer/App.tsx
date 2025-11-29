import React, { useState } from 'react';
import { usePrompts } from './hooks/usePrompts';
import Sidebar from './components/Sidebar';
import PromptList from './components/PromptList';
import PromptEditor from './components/PromptEditor';
import WordLibrary from './components/WordLibrary';
import TemplateManager from './components/TemplateManager';
import { Prompt } from './types';

type View = 'prompts' | 'wordLibrary' | 'templates';

function App() {
  const {
    prompts,
    categories,
    wordLibrary,
    wordCategories,
    templates,
    loading,
    searchFilter,
    setSearchFilter,
    createPrompt,
    updatePrompt,
    deletePrompt,
    reorderPrompts,
    toggleFavorite,
    restoreVersion,
    addCategory,
    addWord,
    deleteWord,
    addTemplate,
    deleteTemplate,
    exportData,
    importData,
  } = usePrompts();

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [currentView, setCurrentView] = useState<View>('prompts');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleCreatePrompt = async () => {
    const newPrompt = await createPrompt({
      title: '新提示词',
      content: '',
      category: searchFilter.category || 'general',
    });
    setSelectedPrompt(newPrompt);
    setIsEditorOpen(true);
  };

  const handleSelectPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedPrompt(null);
  };

  const handleSavePrompt = async (updates: Partial<Prompt>) => {
    if (selectedPrompt) {
      await updatePrompt(selectedPrompt.id, updates);
    }
  };

  // Sync selectedPrompt with prompts list
  React.useEffect(() => {
    if (selectedPrompt) {
      const updatedPrompt = prompts.find(p => p.id === selectedPrompt.id);
      if (updatedPrompt && JSON.stringify(updatedPrompt) !== JSON.stringify(selectedPrompt)) {
        setSelectedPrompt(updatedPrompt);
      }
    }
  }, [prompts, selectedPrompt]);

  const handleDeletePrompt = async (id: string) => {
    await deletePrompt(id);
    if (selectedPrompt?.id === id) {
      handleCloseEditor();
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-slate-900">
      {/* Sidebar */}
      <Sidebar
        categories={categories}
        currentView={currentView}
        selectedCategory={searchFilter.category}
        showFavorites={searchFilter.favorites}
        onViewChange={(view) => {
          setCurrentView(view);
          // Clear favorites filter when switching away from prompts view
          if (view !== 'prompts') {
            setSearchFilter((prev) => ({ ...prev, favorites: false, category: undefined }));
          }
        }}
        onCategorySelect={(category) => 
          setSearchFilter((prev) => ({ ...prev, category, favorites: false }))
        }
        onToggleFavorites={() =>
          setSearchFilter((prev) => ({ ...prev, favorites: !prev.favorites, category: undefined }))
        }
        onAddCategory={addCategory}
        onExport={exportData}
        onImport={importData}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'prompts' && (
          <>
            {/* Header */}
            <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-slate-200">
                  {searchFilter.favorites 
                    ? '收藏的提示词' 
                    : searchFilter.category 
                      ? categories.find(c => c.id === searchFilter.category)?.name || '所有提示词'
                      : '所有提示词'}
                </h1>
                <span className="text-sm text-slate-500">
                  {prompts.length} 个提示词
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索提示词..."
                    value={searchFilter.query}
                    onChange={(e) =>
                      setSearchFilter((prev) => ({ ...prev, query: e.target.value }))
                    }
                    className="w-64 px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {/* Create Button */}
                <button
                  onClick={handleCreatePrompt}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新建提示词
                </button>
              </div>
            </header>

            {/* Prompt List */}
            <PromptList
              prompts={prompts}
              categories={categories}
              selectedPrompt={selectedPrompt}
              onSelect={handleSelectPrompt}
              onDelete={handleDeletePrompt}
              onToggleFavorite={toggleFavorite}
              onReorder={reorderPrompts}
            />
          </>
        )}

        {currentView === 'wordLibrary' && (
          <WordLibrary
            words={wordLibrary}
            categories={wordCategories}
            onAddWord={addWord}
            onDeleteWord={deleteWord}
          />
        )}

        {currentView === 'templates' && (
          <TemplateManager
            templates={templates}
            categories={categories}
            onAddTemplate={addTemplate}
            onDeleteTemplate={deleteTemplate}
            onUseTemplate={(template) => {
              createPrompt({
                title: `${template.name} - 副本`,
                content: template.content,
                category: template.category,
              }).then((newPrompt) => {
                setSelectedPrompt(newPrompt);
                setCurrentView('prompts');
                setIsEditorOpen(true);
              });
            }}
          />
        )}
      </div>

      {/* Editor Panel */}
      {isEditorOpen && selectedPrompt && (
        <PromptEditor
          prompt={selectedPrompt}
          categories={categories}
          wordLibrary={wordLibrary}
          onSave={handleSavePrompt}
          onClose={handleCloseEditor}
          onRestoreVersion={restoreVersion}
        />
      )}
    </div>
  );
}

export default App;

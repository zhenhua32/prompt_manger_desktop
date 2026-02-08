import React, { useState, useCallback, useMemo, useRef } from 'react';
import { usePrompts } from './hooks/usePrompts';
import { useImageGen } from './hooks/useImageGen';
import Sidebar from './components/Sidebar';
import PromptList from './components/PromptList';
import PromptEditor from './components/PromptEditor';
import WordLibrary from './components/WordLibrary';
import TemplateManager from './components/TemplateManager';
import ApiConfigPanel from './components/ApiConfigPanel';
import TaskList from './components/TaskList';
import { Prompt } from './types';

type View = 'prompts' | 'wordLibrary' | 'templates' | 'imageGen';

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
    reorderCategories,
    pinCategoryToTop,
    addWord,
    updateWord,
    deleteWord,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    exportData,
    importData,
  } = usePrompts();

  const {
    apiConfig,
    tasks,
    saveApiConfig,
    generateImage,
    refreshTask,
    deleteTask,
    clearFinishedTasks,
  } = useImageGen();

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [currentView, setCurrentView] = useState<View>('prompts');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);

  const handleViewChange = useCallback((view: 'prompts' | 'wordLibrary' | 'templates' | 'imageGen') => {
    if (view === 'imageGen') {
      setCurrentView('imageGen');
    } else {
      setCurrentView(view);
    }
    if (view !== 'prompts' && view !== 'imageGen') {
      setSearchFilter((prev) => ({ ...prev, favorites: false, category: undefined }));
    }
  }, [setSearchFilter]);

  const handleCategorySelect = useCallback((category?: string) => {
    setSearchFilter((prev) => ({ ...prev, category, favorites: false }));
  }, [setSearchFilter]);

  const handleToggleFavorites = useCallback(() => {
    setSearchFilter((prev) => ({ ...prev, favorites: !prev.favorites, category: undefined }));
  }, [setSearchFilter]);

  const handleCreatePrompt = useCallback(async () => {
    const newPrompt = await createPrompt({
      title: '新提示词',
      content: '',
      category: searchFilter.category || 'general',
    });
    setSelectedPrompt(newPrompt);
    setIsEditorOpen(true);
  }, [createPrompt, searchFilter.category]);

  const handleSelectPrompt = useCallback((prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    setSelectedPrompt(null);
  }, []);

  const handleSavePrompt = useCallback(async (updates: Partial<Prompt>) => {
    if (selectedPrompt) {
      await updatePrompt(selectedPrompt.id, updates);
    }
  }, [selectedPrompt, updatePrompt]);

  const handleDeletePrompt = useCallback(async (id: string) => {
    await deletePrompt(id);
    if (selectedPrompt?.id === id) {
      setIsEditorOpen(false);
      setSelectedPrompt(null);
    }
  }, [deletePrompt, selectedPrompt?.id]);

  // Keep a ref to selectedPrompt id to avoid depending on selectedPrompt in the sync effect
  const selectedPromptIdRef = useRef<string | null>(null);
  selectedPromptIdRef.current = selectedPrompt?.id ?? null;

  // Sync selectedPrompt with prompts list — only depends on [prompts]
  React.useEffect(() => {
    const currentId = selectedPromptIdRef.current;
    if (currentId) {
      const updatedPrompt = prompts.find(p => p.id === currentId);
      if (updatedPrompt) {
        setSelectedPrompt(prev => {
          if (!prev || prev === updatedPrompt) return prev;
          // Only update if any displayed field actually changed
          if (updatedPrompt.content !== prev.content ||
              updatedPrompt.title !== prev.title ||
              updatedPrompt.updatedAt !== prev.updatedAt ||
              updatedPrompt.previewImage !== prev.previewImage ||
              updatedPrompt.referenceImage !== prev.referenceImage ||
              updatedPrompt.isFavorite !== prev.isFavorite ||
              updatedPrompt.category !== prev.category) {
            return updatedPrompt;
          }
          return prev;
        });
      }
    }
  }, [prompts]);

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
        onViewChange={handleViewChange}
        onCategorySelect={handleCategorySelect}
        onToggleFavorites={handleToggleFavorites}
        onAddCategory={addCategory}
        onReorderCategories={reorderCategories}
        onPinCategory={pinCategoryToTop}
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
            onUpdateWord={updateWord}
            onDeleteWord={deleteWord}
          />
        )}

        {currentView === 'templates' && (
          <TemplateManager
            templates={templates}
            categories={categories}
            onAddTemplate={addTemplate}
            onUpdateTemplate={updateTemplate}
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
        {currentView === 'imageGen' && (
          <div className="h-full flex flex-col">
            <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6 bg-slate-900">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-slate-200">
                  生图任务
                </h1>
                <span className="text-sm text-slate-500">
                  {tasks.length} 个任务
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowApiConfig(!showApiConfig)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    showApiConfig 
                      ? 'bg-primary-600/20 text-primary-400' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  API 配置
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col">
              {showApiConfig ? (
                <ApiConfigPanel 
                  config={apiConfig} 
                  onSave={(config) => {
                    saveApiConfig(config);
                    // If connection is valid, maybe close the panel or show success
                  }} 
                />
              ) : (
                <TaskList
                  tasks={tasks}
                  onRefresh={refreshTask}
                  onDelete={deleteTask}
                  onClearFinished={clearFinishedTasks}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Editor Panel */}
      {isEditorOpen && selectedPrompt && (
        <PromptEditor
          prompt={selectedPrompt}
          categories={categories}
          wordLibrary={wordLibrary}
          wordCategories={wordCategories}
          onSave={handleSavePrompt}
          onClose={handleCloseEditor}
          onRestoreVersion={restoreVersion}
          apiConfig={apiConfig}
          onGenerateImage={generateImage}
        />
      )}
    </div>
  );
}

export default App;

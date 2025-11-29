import React, { useState } from 'react';
import { WordItem, WordCategory } from '../types';

interface WordLibraryProps {
  words: WordItem[];
  categories: WordCategory[];
  onAddWord: (word: Partial<WordItem>) => Promise<WordItem>;
  onUpdateWord: (id: string, updates: Partial<WordItem>) => Promise<void>;
  onDeleteWord: (id: string) => void;
}

const WordLibrary: React.FC<WordLibraryProps> = ({
  words,
  categories,
  onAddWord,
  onUpdateWord,
  onDeleteWord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [newWord, setNewWord] = useState({
    word: '',
    translation: '',
    category: 'style',
    usage: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredWords = words.filter((word) => {
    const matchesSearch =
      !searchQuery ||
      word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.translation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      word.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || word.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleAddWord = async () => {
    if (newWord.word.trim()) {
      await onAddWord({
        word: newWord.word.trim(),
        translation: newWord.translation.trim() || undefined,
        category: newWord.category,
        usage: newWord.usage.trim() || undefined,
        tags: [],
      });
      setNewWord({ word: '', translation: '', category: 'style', usage: '' });
      setIsAddingWord(false);
    }
  };

  const handleEditWord = async () => {
    if (editingWord && editingWord.word.trim()) {
      await onUpdateWord(editingWord.id, {
        word: editingWord.word.trim(),
        translation: editingWord.translation?.trim() || undefined,
        category: editingWord.category,
        usage: editingWord.usage?.trim() || undefined,
      });
      setEditingWord(null);
    }
  };

  const handleCopyWord = async (word: WordItem) => {
    await navigator.clipboard.writeText(word.word);
    setCopiedId(word.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.color || '#6366f1';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || '未分类';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-slate-200">单词库</h1>
          <span className="text-sm text-slate-500">{filteredWords.length} 个单词</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          <button
            onClick={() => setIsAddingWord(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加单词
          </button>
        </div>
      </header>

      {/* Category Filter */}
      <div className="px-6 py-3 border-b border-slate-700 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !selectedCategory
              ? 'bg-primary-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
              selectedCategory === cat.id
                ? 'text-white'
                : 'text-slate-400 hover:bg-slate-600'
            }`}
            style={{
              backgroundColor:
                selectedCategory === cat.id ? cat.color : undefined,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            {cat.name}
          </button>
        ))}
      </div>

      {/* Word List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredWords.map((word) => (
            <div
              key={word.id}
              className="card group relative hover:scale-[1.02] transition-transform"
            >
              {/* Actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopyWord(word)}
                  className="p-1.5 rounded bg-slate-700 text-slate-400 hover:text-primary-400 transition-colors"
                >
                  {copiedId === word.id ? (
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setEditingWord(word)}
                  className="p-1.5 rounded bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要删除这个单词吗？')) {
                      onDeleteWord(word.id);
                    }
                  }}
                  className="p-1.5 rounded bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex items-start gap-3">
                <span
                  className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: getCategoryColor(word.category) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 mb-0.5">{word.word}</p>
                  {word.translation && (
                    <p className="text-xs text-slate-400 mb-1">{word.translation}</p>
                  )}
                  {word.usage && (
                    <p className="text-xs text-slate-500 line-clamp-2">{word.usage}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${getCategoryColor(word.category)}20`,
                        color: getCategoryColor(word.category),
                      }}
                    >
                      {getCategoryName(word.category)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Word Modal */}
      {isAddingWord && (
        <div className="modal-backdrop" onClick={() => setIsAddingWord(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">添加新单词</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    单词 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newWord.word}
                    onChange={(e) => setNewWord({ ...newWord, word: e.target.value })}
                    className="input"
                    placeholder="例如: photorealistic"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">翻译</label>
                  <input
                    type="text"
                    value={newWord.translation}
                    onChange={(e) => setNewWord({ ...newWord, translation: e.target.value })}
                    className="input"
                    placeholder="例如: 照片级真实"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">分类</label>
                  <select
                    value={newWord.category}
                    onChange={(e) => setNewWord({ ...newWord, category: e.target.value })}
                    className="input"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">用法说明</label>
                  <textarea
                    value={newWord.usage}
                    onChange={(e) => setNewWord({ ...newWord, usage: e.target.value })}
                    className="textarea h-20"
                    placeholder="描述这个单词的用途..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsAddingWord(false)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleAddWord}
                  disabled={!newWord.word.trim()}
                  className={`btn btn-primary ${
                    !newWord.word.trim() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Word Modal */}
      {editingWord && (
        <div className="modal-backdrop" onClick={() => setEditingWord(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">编辑单词</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    单词 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingWord.word}
                    onChange={(e) => setEditingWord({ ...editingWord, word: e.target.value })}
                    className="input"
                    placeholder="例如: photorealistic"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">翻译</label>
                  <input
                    type="text"
                    value={editingWord.translation || ''}
                    onChange={(e) => setEditingWord({ ...editingWord, translation: e.target.value })}
                    className="input"
                    placeholder="例如: 照片级真实"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">分类</label>
                  <select
                    value={editingWord.category}
                    onChange={(e) => setEditingWord({ ...editingWord, category: e.target.value })}
                    className="input"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">用法说明</label>
                  <textarea
                    value={editingWord.usage || ''}
                    onChange={(e) => setEditingWord({ ...editingWord, usage: e.target.value })}
                    className="textarea h-20"
                    placeholder="描述这个单词的用途..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditingWord(null)}
                  className="btn btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleEditWord}
                  disabled={!editingWord.word.trim()}
                  className={`btn btn-primary ${
                    !editingWord.word.trim() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordLibrary;

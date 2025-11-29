import React, { useState, useEffect, useCallback } from 'react';
import { Prompt, Category, WordItem, PromptFormat } from '../types';

interface PromptEditorProps {
  prompt: Prompt;
  categories: Category[];
  wordLibrary: WordItem[];
  onSave: (updates: Partial<Prompt>) => void;
  onClose: () => void;
  onRestoreVersion: (promptId: string, versionId: string) => void;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  categories,
  wordLibrary,
  onSave,
  onClose,
  onRestoreVersion,
}) => {
  const [title, setTitle] = useState(prompt.title);
  const [content, setContent] = useState(prompt.content);
  const [description, setDescription] = useState(prompt.description || '');
  const [category, setCategory] = useState(prompt.category);
  const [format, setFormat] = useState<PromptFormat>(prompt.format);
  const [tags, setTags] = useState<string[]>(prompt.tags);
  const [tagInput, setTagInput] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showWordLibrary, setShowWordLibrary] = useState(false);
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Update local state when prompt changes
  useEffect(() => {
    setTitle(prompt.title);
    setContent(prompt.content);
    setDescription(prompt.description || '');
    setCategory(prompt.category);
    setFormat(prompt.format);
    setTags(prompt.tags);
    setHasChanges(false);
  }, [prompt.id]);

  // Track changes
  useEffect(() => {
    const changed =
      title !== prompt.title ||
      content !== prompt.content ||
      description !== (prompt.description || '') ||
      category !== prompt.category ||
      format !== prompt.format ||
      JSON.stringify(tags) !== JSON.stringify(prompt.tags);
    setHasChanges(changed);
  }, [title, content, description, category, format, tags, prompt]);

  const handleSave = useCallback(() => {
    onSave({
      title,
      content,
      description: description || undefined,
      category,
      format,
      tags,
    });
    setHasChanges(false);
  }, [title, content, description, category, format, tags, onSave]);

  // Ctrl+S shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, handleSave]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSelectImage = async () => {
    if (window.electronAPI) {
      const imageDataUrl = await window.electronAPI.selectImage();
      if (imageDataUrl) {
        onSave({ previewImage: imageDataUrl });
      }
    }
  };

  const insertWord = (word: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + word + content.substring(end);
      setContent(newContent);
      
      // Set cursor position after inserted word
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + word.length, start + word.length);
      }, 0);
    }
  };

  const filteredWords = wordLibrary.filter((word) => {
    if (!wordSearchQuery) return true;
    const query = wordSearchQuery.toLowerCase();
    return (
      word.word.toLowerCase().includes(query) ||
      word.translation?.toLowerCase().includes(query) ||
      word.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-[500px] h-full bg-slate-800 border-l border-slate-700 flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-slate-200">编辑提示词</h2>
          {hasChanges && (
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
              未保存
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`btn btn-primary text-sm ${
              !hasChanges ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            保存
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="输入提示词标题"
          />
        </div>

        {/* Category & Format */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
            <label className="block text-sm font-medium text-slate-400 mb-1">格式</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as PromptFormat)}
              className="input"
            >
              <option value="text">文本</option>
              <option value="code">代码</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">描述</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="简短描述这个提示词的用途"
          />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-slate-400">内容</label>
            <button
              onClick={() => setShowWordLibrary(!showWordLibrary)}
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${
                showWordLibrary
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              单词库
            </button>
          </div>
          
          {/* Word Library Panel */}
          {showWordLibrary && (
            <div className="mb-2 p-3 bg-slate-900 rounded-lg border border-slate-700">
              <input
                type="text"
                value={wordSearchQuery}
                onChange={(e) => setWordSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 mb-2"
                placeholder="搜索单词..."
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredWords.slice(0, 20).map((word) => (
                  <button
                    key={word.id}
                    onClick={() => insertWord(word.word)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                  >
                    <span className="text-sm text-slate-200">{word.word}</span>
                    {word.translation && (
                      <span className="text-xs text-slate-500 ml-2">{word.translation}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            id="content-editor"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`textarea h-48 ${format === 'code' ? 'code-editor font-mono' : ''}`}
            placeholder="输入提示词内容..."
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">标签</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-300"
              >
                #{tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              className="input flex-1"
              placeholder="添加标签..."
            />
            <button onClick={handleAddTag} className="btn btn-secondary">
              添加
            </button>
          </div>
        </div>

        {/* Preview Image */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">预览图</label>
          {prompt.previewImage ? (
            <div className="relative group">
              <img
                src={prompt.previewImage}
                alt="Preview"
                className="w-full max-h-48 object-contain rounded-lg bg-slate-900 cursor-pointer"
                onClick={() => setShowImagePreview(true)}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowImagePreview(true)}
                  className="px-3 py-1.5 bg-slate-700 rounded text-sm text-slate-200 hover:bg-slate-600"
                >
                  查看
                </button>
                <button
                  onClick={handleSelectImage}
                  className="px-3 py-1.5 bg-slate-700 rounded text-sm text-slate-200 hover:bg-slate-600"
                >
                  更换
                </button>
                <button
                  onClick={() => onSave({ previewImage: undefined })}
                  className="px-3 py-1.5 bg-red-600 rounded text-sm text-white hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSelectImage}
              className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors"
            >
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">添加预览图</span>
            </button>
          )}
        </div>

        {/* Version History */}
        {prompt.versions.length > 0 && (
          <div>
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-300"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showVersions ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              版本历史 ({prompt.versions.length})
            </button>
            
            {showVersions && (
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {prompt.versions
                  .slice()
                  .reverse()
                  .map((version) => (
                    <div
                      key={version.id}
                      className="p-3 bg-slate-900 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">
                          {formatDate(version.createdAt)}
                        </span>
                        <button
                          onClick={() => onRestoreVersion(prompt.id, version.id)}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          恢复此版本
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-3">{version.content}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t border-slate-700 space-y-1 text-xs text-slate-500">
          <p>创建时间: {formatDate(prompt.createdAt)}</p>
          <p>更新时间: {formatDate(prompt.updatedAt)}</p>
        </div>
      </div>

      {/* Image Preview Modal */}
      {showImagePreview && prompt.previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setShowImagePreview(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={prompt.previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowImagePreview(false)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptEditor;

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Prompt, Category } from '../types';

interface PromptListProps {
  prompts: Prompt[];
  categories: Category[];
  selectedPrompt: Prompt | null;
  onSelect: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
}

// Number of items to load initially and per batch
const INITIAL_LOAD = 20;
const LOAD_MORE = 20;

const PromptList: React.FC<PromptListProps> = ({
  prompts,
  categories,
  selectedPrompt,
  onSelect,
  onDelete,
  onToggleFavorite,
  onReorder,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  // All hooks must be called before any conditional returns
  const handleImageClick = useCallback((e: React.MouseEvent, imageSrc: string) => {
    e.stopPropagation();
    setPreviewImage(imageSrc);
  }, []);

  const handleFavoriteToggle = useCallback((e: React.MouseEvent, promptId: string) => {
    e.stopPropagation();
    onToggleFavorite(promptId);
  }, [onToggleFavorite]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, promptId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个提示词吗？')) {
      onDelete(promptId);
    }
  }, [onDelete]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    dragNode.current = e.target as HTMLDivElement;
    e.dataTransfer.effectAllowed = 'move';
    
    // Add some delay to show the dragging effect
    setTimeout(() => {
      if (dragNode.current) {
        dragNode.current.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNode.current) {
      dragNode.current.style.opacity = '1';
    }
    
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onReorder(draggedIndex, dragOverIndex);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragNode.current = null;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleCopyContent = async (e: React.MouseEvent, promptId: string, content: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(promptId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.color || '#6366f1';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || '未分类';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Memoize category lookup maps for performance
  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.color));
    return map;
  }, [categories]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const getCategoryColorFast = useCallback((categoryId: string) => {
    return categoryColorMap.get(categoryId) || '#6366f1';
  }, [categoryColorMap]);

  const getCategoryNameFast = useCallback((categoryId: string) => {
    return categoryNameMap.get(categoryId) || '未分类';
  }, [categoryNameMap]);

  // Visible prompts with lazy loading
  const visiblePrompts = useMemo(() => {
    return prompts.slice(0, visibleCount);
  }, [prompts, visibleCount]);

  const hasMore = visibleCount < prompts.length;

  // Reset visible count when prompts change (e.g., filter applied)
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD);
  }, [prompts.length]);

  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
    if (bottom && hasMore) {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE, prompts.length));
    }
  }, [hasMore, prompts.length]);

  if (prompts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-400 mb-2">暂无提示词</h3>
          <p className="text-sm text-slate-500">点击上方"新建提示词"按钮创建第一个提示词</p>
        </div>
      </div>
    );
  }

  // Render a single prompt card
  const renderPromptCard = (prompt: Prompt, index: number) => (
    <div
      key={prompt.id}
      draggable
      onDragStart={(e) => handleDragStart(e, index)}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => handleDragOver(e, index)}
      onClick={() => onSelect(prompt)}
      className={`card cursor-pointer group relative transition-all duration-200 h-full ${
        selectedPrompt?.id === prompt.id
          ? 'ring-2 ring-primary-500 border-primary-500'
          : ''
      } ${
        dragOverIndex === index ? 'ring-2 ring-primary-400 scale-[1.02]' : ''
      }`}
    >
      {/* Drag Handle */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity drag-handle">
        <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => handleFavoriteToggle(e, prompt.id)}
          className={`p-1 rounded hover:bg-slate-700 transition-colors ${
            prompt.isFavorite ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill={prompt.isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
        <button
          onClick={(e) => handleDeleteClick(e, prompt.id)}
          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Preview Image */}
      {prompt.previewImage && (
        <div 
          className="mb-3 -mx-4 -mt-4 rounded-t-xl overflow-hidden cursor-pointer bg-slate-900 flex items-center justify-center h-32"
          onClick={(e) => handleImageClick(e, prompt.previewImage!)}
        >
          <img
            src={prompt.previewImage}
            alt={prompt.title}
            loading="lazy"
            className="max-w-full max-h-32 object-contain hover:opacity-90 transition-opacity"
          />
        </div>
      )}

      {/* Content */}
      <div className={prompt.previewImage ? '' : 'pt-4'}>
        {/* Category Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${getCategoryColorFast(prompt.category)}20`,
              color: getCategoryColorFast(prompt.category),
            }}
          >
            {getCategoryNameFast(prompt.category)}
          </span>
          {prompt.format !== 'text' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
              {prompt.format}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={(e) => handleCopyContent(e, prompt.id, prompt.content)}
            className={`p-1 rounded transition-colors flex-shrink-0 ${
              copiedId === prompt.id
                ? 'text-green-400'
                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'
            }`}
            title={copiedId === prompt.id ? '已复制' : '复制内容'}
          >
            {copiedId === prompt.id ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-slate-200 mb-2 line-clamp-1">
          {prompt.title}
        </h3>

        {/* Content Preview */}
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">
          {prompt.content || '暂无内容'}
        </p>

        {/* Tags */}
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {prompt.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-700/50 text-slate-400"
              >
                #{tag}
              </span>
            ))}
            {prompt.tags.length > 3 && (
              <span className="text-xs text-slate-500">+{prompt.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{formatDate(prompt.updatedAt)}</span>
          {prompt.versions.length > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {prompt.versions.length} 版本
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-y-auto p-6"
      onScroll={handleScroll}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visiblePrompts.map((prompt, index) => renderPromptCard(prompt, index))}
      </div>
      
      {/* Load more indicator */}
      {hasMore && (
        <div className="flex justify-center py-6">
          <div className="text-sm text-slate-500">
            已显示 {visibleCount} / {prompts.length} 条，向下滚动加载更多...
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImage(null)}
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

export default PromptList;

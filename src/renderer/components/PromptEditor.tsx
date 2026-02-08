import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Prompt, Category, WordItem, WordCategory, PromptFormat, ImageGenApiConfig, ImageGenTask } from '../types';

interface PromptEditorProps {
  prompt: Prompt;
  categories: Category[];
  wordLibrary: WordItem[];
  wordCategories: WordCategory[];
  apiConfig?: ImageGenApiConfig;
  onSave: (updates: Partial<Prompt>) => void;
  onClose: () => void;
  onRestoreVersion: (promptId: string, versionId: string) => void;
  onGenerateImage?: (prompt: string) => Promise<ImageGenTask | null>;
}

const PromptEditor: React.FC<PromptEditorProps> = ({
  prompt,
  categories,
  wordLibrary,
  wordCategories,
  apiConfig,
  onSave,
  onClose,
  onRestoreVersion,
  onGenerateImage,
}) => {
  const [title, setTitle] = useState(prompt.title);
  const [content, setContent] = useState(prompt.content);
  const [contentTranslation, setContentTranslation] = useState(prompt.contentTranslation || '');
  const [description, setDescription] = useState(prompt.description || '');
  const [category, setCategory] = useState(prompt.category);
  const [format, setFormat] = useState<PromptFormat>(prompt.format);
  const [tags, setTags] = useState<string[]>(prompt.tags);
  const [tagInput, setTagInput] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [showWordLibrary, setShowWordLibrary] = useState(false);
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [selectedWordCategory, setSelectedWordCategory] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewModalSrc, setPreviewModalSrc] = useState('');
  const [copied, setCopied] = useState(false);
  const [refImageCopied, setRefImageCopied] = useState(false);
  const [previewImageCopied, setPreviewImageCopied] = useState(false);
  const [showRefUrlInput, setShowRefUrlInput] = useState(false);
  const [refImageUrl, setRefImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genTask, setGenTask] = useState<ImageGenTask | null>(null);

  // Update local state when prompt changes
  useEffect(() => {
    setTitle(prompt.title);
    setContent(prompt.content);
    setContentTranslation(prompt.contentTranslation || '');
    setDescription(prompt.description || '');
    setCategory(prompt.category);
    setFormat(prompt.format);
    setTags(prompt.tags);
    setHasChanges(false);
    setGenTask(null);
    setIsGenerating(false);
  }, [prompt.id]);

  // Track changes
  useEffect(() => {
    const changed =
      title !== prompt.title ||
      content !== prompt.content ||
      contentTranslation !== (prompt.contentTranslation || '') ||
      description !== (prompt.description || '') ||
      category !== prompt.category ||
      format !== prompt.format ||
      JSON.stringify(tags) !== JSON.stringify(prompt.tags);
    setHasChanges(changed);
  }, [title, content, contentTranslation, description, category, format, tags, prompt]);

  const handleSave = useCallback(() => {
    onSave({
      title,
      content,
      contentTranslation: contentTranslation || undefined,
      description: description || undefined,
      category,
      format,
      tags,
    });
    setHasChanges(false);
  }, [title, content, contentTranslation, description, category, format, tags, onSave]);

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

  const handleSelectPreviewImage = async () => {
    if (window.electronAPI) {
      const imageDataUrl = await window.electronAPI.selectImage();
      if (imageDataUrl) {
        onSave({ previewImage: imageDataUrl });
      }
    }
  };

  const handleSelectReferenceImage = async () => {
    if (window.electronAPI) {
      const imageDataUrl = await window.electronAPI.selectImage();
      if (imageDataUrl) {
        onSave({ referenceImage: imageDataUrl });
      }
    }
  };

  const handleReferenceImageUrl = () => {
    if (refImageUrl.trim()) {
      onSave({ referenceImage: refImageUrl.trim() });
      setRefImageUrl('');
      setShowRefUrlInput(false);
    }
  };

  const handlePasteReferenceImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
              onSave({ referenceImage: dataUrl });
            }
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }

    // Check for image URL in text
    const text = e.clipboardData?.getData('text');
    if (text && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(text)) {
      e.preventDefault();
      onSave({ referenceImage: text });
    }
  };

  const handleGenerateImage = async () => {
    if (!onGenerateImage || !content.trim()) return;
    
    setIsGenerating(true);
    setGenTask(null);
    try {
      const task = await onGenerateImage(content);
      if (task) {
        setGenTask(task);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('生成失败: ' + (error as any).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImage = useCallback(async (imageSrc: string, type: 'ref' | 'preview') => {
    try {
      // Create an image element to load the image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageSrc;
      });
      
      // Create a canvas and draw the image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      
      ctx.drawImage(img, 0, 0);
      
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });
      
      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);
      
      if (type === 'ref') {
        setRefImageCopied(true);
        setTimeout(() => setRefImageCopied(false), 2000);
      } else {
        setPreviewImageCopied(true);
        setTimeout(() => setPreviewImageCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy image:', err);
      alert('复制图片失败: ' + (err as Error).message);
    }
  }, []);

  const filteredWords = useMemo(() => {
    return wordLibrary.filter((word) => {
      // Category filter
      if (selectedWordCategory && word.category !== selectedWordCategory) {
        return false;
      }
      // Search filter
      if (!wordSearchQuery) return true;
      const query = wordSearchQuery.toLowerCase();
      return (
        word.word.toLowerCase().includes(query) ||
        word.translation?.toLowerCase().includes(query) ||
        word.tags.some((t) => t.toLowerCase().includes(query))
      );
    });
  }, [wordLibrary, selectedWordCategory, wordSearchQuery]);

  const insertWord = (word: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Check if the word contains English characters (needs spacing)
      const isEnglish = /[a-zA-Z]/.test(word);
      
      let insertText = word;
      if (isEnglish) {
        // Add space before if there's content before cursor and it's not a space/newline
        const charBefore = start > 0 ? content[start - 1] : '';
        const needSpaceBefore = charBefore && !/[\s,，。.!！?？:：;；\n]/.test(charBefore);
        
        // Add space after if there's content after cursor and it's not a space/newline
        const charAfter = end < content.length ? content[end] : '';
        const needSpaceAfter = charAfter && !/[\s,，。.!！?？:：;；\n]/.test(charAfter);
        
        insertText = (needSpaceBefore ? ' ' : '') + word + (needSpaceAfter ? ' ' : '');
      }
      
      const newContent = content.substring(0, start) + insertText + content.substring(end);
      setContent(newContent);
      
      // Set cursor position after inserted word
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + insertText.length, start + insertText.length);
      }, 0);
    }
  };

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

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
            onClick={handleCopyContent}
            className={`p-2 rounded transition-colors ${
              copied 
                ? 'text-green-400 bg-green-400/10' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
            title={copied ? '已复制' : '复制内容'}
          >
            {copied ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
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
              {/* Category Filter */}
              <div className="flex flex-wrap gap-1 mb-2">
                <button
                  onClick={() => setSelectedWordCategory(null)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    !selectedWordCategory
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  全部
                </button>
                {wordCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedWordCategory(selectedWordCategory === cat.id ? null : cat.id)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 ${
                      selectedWordCategory === cat.id
                        ? 'text-white'
                        : 'text-slate-400 hover:bg-slate-600'
                    }`}
                    style={{
                      backgroundColor: selectedWordCategory === cat.id ? cat.color : undefined,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredWords.slice(0, 20).map((word) => {
                  const wordCat = wordCategories.find(c => c.id === word.category);
                  return (
                    <button
                      key={word.id}
                      onClick={() => insertWord(word.word)}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm text-slate-200">{word.word}</span>
                        {word.translation && (
                          <span className="text-xs text-slate-500 truncate">{word.translation}</span>
                        )}
                      </div>
                      {wordCat && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 ml-2"
                          style={{
                            backgroundColor: `${wordCat.color}20`,
                            color: wordCat.color,
                          }}
                        >
                          {wordCat.name}
                        </span>
                      )}
                    </button>
                  );
                })}
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
          
          {apiConfig?.enabled && onGenerateImage && (
            <div className="mt-2 flex items-center justify-between bg-slate-700/30 p-2 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2 overflow-hidden">
                {isGenerating ? (
                  <span className="text-xs text-blue-400 flex items-center gap-1">
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    正在创建任务...
                  </span>
                ) : genTask ? (
                  <span className="text-xs text-green-400 truncate">
                    任务已创建，请在"生图任务"中查看进度
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 truncate">
                    使用: {apiConfig.modelName}
                  </span>
                )}
              </div>
              <button
                onClick={handleGenerateImage}
                disabled={isGenerating || !content.trim()}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 disabled:text-slate-500 rounded text-xs text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                生成图片
              </button>
            </div>
          )}
        </div>

        {/* Content Translation */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">内容翻译</label>
          <textarea
            value={contentTranslation}
            onChange={(e) => setContentTranslation(e.target.value)}
            className="textarea h-24"
            placeholder="输入提示词内容的中文翻译..."
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

        {/* Reference Image (Input) */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">参考图 (输入)</label>
          {prompt.referenceImage ? (
            <div className="relative group">
              <img
                src={prompt.referenceImage}
                alt="Reference"
                loading="lazy"
                className="w-full max-h-48 object-contain rounded-lg bg-slate-900 cursor-pointer"
                onClick={() => {
                  setPreviewModalSrc(prompt.referenceImage!);
                  setShowImagePreview(true);
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setPreviewModalSrc(prompt.referenceImage!);
                    setShowImagePreview(true);
                  }}
                  className="px-3 py-1.5 bg-slate-700 rounded text-sm text-slate-200 hover:bg-slate-600"
                >
                  查看
                </button>
                <button
                  onClick={() => handleCopyImage(prompt.referenceImage!, 'ref')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    refImageCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {refImageCopied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={handleSelectReferenceImage}
                  className="px-3 py-1.5 bg-slate-700 rounded text-sm text-slate-200 hover:bg-slate-600"
                >
                  更换
                </button>
                <button
                  onClick={() => onSave({ referenceImage: undefined })}
                  className="px-3 py-1.5 bg-red-600 rounded text-sm text-white hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Paste Area */}
              <div
                onPaste={handlePasteReferenceImage}
                tabIndex={0}
                className="w-full h-20 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors cursor-pointer focus:outline-none focus:border-primary-500"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    (e.target as HTMLElement).focus();
                  }
                }}
              >
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-xs">点击此处并粘贴图片 (Ctrl+V)</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSelectReferenceImage}
                  className="flex-1 py-2 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  本地上传
                </button>
                <button
                  onClick={() => setShowRefUrlInput(!showRefUrlInput)}
                  className={`flex-1 py-2 px-3 border rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
                    showRefUrlInput
                      ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  链接地址
                </button>
              </div>

              {/* URL Input */}
              {showRefUrlInput && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refImageUrl}
                    onChange={(e) => setRefImageUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReferenceImageUrl()}
                    className="input flex-1"
                    placeholder="输入图片 URL..."
                    autoFocus
                  />
                  <button
                    onClick={handleReferenceImageUrl}
                    disabled={!refImageUrl.trim()}
                    className={`btn btn-primary ${
                      !refImageUrl.trim() ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    确定
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Image (Output) */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">预览图 (输出)</label>
          {prompt.previewImage ? (
            <div className="relative group">
              <img
                src={prompt.previewImage}
                alt="Preview"
                loading="lazy"
                className="w-full max-h-48 object-contain rounded-lg bg-slate-900 cursor-pointer"
                onClick={() => {
                  setPreviewModalSrc(prompt.previewImage!);
                  setShowImagePreview(true);
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setPreviewModalSrc(prompt.previewImage!);
                    setShowImagePreview(true);
                  }}
                  className="px-3 py-1.5 bg-slate-700 rounded text-sm text-slate-200 hover:bg-slate-600"
                >
                  查看
                </button>
                <button
                  onClick={() => handleCopyImage(prompt.previewImage!, 'preview')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    previewImageCopied
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {previewImageCopied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={handleSelectPreviewImage}
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
              onClick={handleSelectPreviewImage}
              className="w-full h-20 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors"
            >
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">上传预览图</span>
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
      {showImagePreview && previewModalSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setShowImagePreview(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={previewModalSrc}
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

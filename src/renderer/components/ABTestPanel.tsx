import React, { useState } from 'react';
import { ABTest, Prompt } from '../types';

interface ABTestPanelProps {
  tests: ABTest[];
  prompts: Prompt[];
  onCreateTest: (name: string, prompts: string[]) => Promise<ABTest>;
  onDeleteTest: (testId: string) => void;
  onRunTest: (testId: string) => void;
  onStopTest: (testId: string) => void;
  onRateVariant: (testId: string, variantId: string, rating: number) => void;
  onPickWinner: (testId: string, variantId: string) => void;
  onUpdateVariantPrompt: (testId: string, variantId: string, prompt: string) => void;
  onUpdateVariantNegativePrompt: (testId: string, variantId: string, negativePrompt: string) => void;
  onAddVariant: (testId: string, prompt?: string) => void;
  onRemoveVariant: (testId: string, variantId: string) => void;
}

const StarRating: React.FC<{ rating?: number; onChange: (r: number) => void }> = ({ rating, onChange }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(star => (
      <button
        key={star}
        onClick={() => onChange(star)}
        className="focus:outline-none transition-colors"
      >
        <svg
          className={`w-5 h-5 ${star <= (rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
          fill={star <= (rating || 0) ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    ))}
  </div>
);

const ABTestPanel: React.FC<ABTestPanelProps> = ({
  tests,
  prompts,
  onCreateTest,
  onDeleteTest,
  onRunTest,
  onStopTest,
  onRateVariant,
  onPickWinner,
  onUpdateVariantPrompt,
  onUpdateVariantNegativePrompt,
  onAddVariant,
  onRemoveVariant,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [newTestName, setNewTestName] = useState('');
  const [newTestPrompts, setNewTestPrompts] = useState(['', '']);
  const [showFromPrompt, setShowFromPrompt] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const selectedTest = tests.find(t => t.id === selectedTestId);

  const handleCreate = async () => {
    const validPrompts = newTestPrompts.filter(p => p.trim());
    if (!newTestName.trim() || validPrompts.length < 2) return;
    const test = await onCreateTest(newTestName.trim(), validPrompts);
    setSelectedTestId(test.id);
    setShowCreateForm(false);
    setNewTestName('');
    setNewTestPrompts(['', '']);
  };

  const handleImportFromPrompt = (prompt: Prompt) => {
    setNewTestPrompts(prev => {
      const firstEmpty = prev.findIndex(p => !p.trim());
      if (firstEmpty >= 0) {
        const updated = [...prev];
        updated[firstEmpty] = prompt.content;
        return updated;
      }
      return [...prev, prompt.content];
    });
    setShowFromPrompt(false);
  };

  // --- Lightbox ---
  const renderLightbox = () => {
    if (!lightboxImage) return null;
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
        onClick={() => setLightboxImage(null)}
      >
        <img
          src={lightboxImage}
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          onClick={e => e.stopPropagation()}
        />
        <button
          onClick={() => setLightboxImage(null)}
          className="absolute top-4 right-4 text-white/80 hover:text-white"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  };

  // --- Create Form ---
  if (showCreateForm) {
    return (
      <div className="h-full flex flex-col">
        <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-slate-200">新建 A/B 测试</h1>
          <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">测试名称</label>
            <input
              type="text"
              value={newTestName}
              onChange={e => setNewTestName(e.target.value)}
              placeholder="例如：风景描述 Prompt 对比"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Prompt 变体（至少 2 个，将分别发送给生图模型）</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFromPrompt(true)}
                  className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                >
                  从已有导入
                </button>
                {newTestPrompts.length < 5 && (
                  <button
                    onClick={() => setNewTestPrompts(p => [...p, ''])}
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    + 添加变体
                  </button>
                )}
              </div>
            </div>

            {showFromPrompt && (
              <div className="mb-4 p-3 bg-slate-800/80 border border-slate-600 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">选择已有 Prompt</span>
                  <button onClick={() => setShowFromPrompt(false)} className="text-slate-500 hover:text-slate-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {prompts.filter(p => p.content.trim()).map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleImportFromPrompt(p)}
                      className="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 truncate"
                    >
                      <span className="font-medium">{p.title}</span>
                      <span className="text-slate-500 ml-2">{p.content.slice(0, 60)}...</span>
                    </button>
                  ))}
                  {prompts.filter(p => p.content.trim()).length === 0 && (
                    <p className="text-sm text-slate-500 py-2">没有可用的 Prompt</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {newTestPrompts.map((p, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 font-medium">变体 {'ABCDEFGHIJ'[i]}</span>
                    {newTestPrompts.length > 2 && (
                      <button
                        onClick={() => setNewTestPrompts(prev => prev.filter((_, j) => j !== i))}
                        className="text-slate-500 hover:text-red-400 text-xs"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  <textarea
                    value={p}
                    onChange={e => {
                      const updated = [...newTestPrompts];
                      updated[i] = e.target.value;
                      setNewTestPrompts(updated);
                    }}
                    placeholder={`输入第 ${i + 1} 个 Prompt 变体...`}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newTestName.trim() || newTestPrompts.filter(p => p.trim()).length < 2}
            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            创建测试
          </button>
        </div>
      </div>
    );
  }

  // --- Detail View ---
  if (selectedTest) {
    const isRunning = selectedTest.status === 'running';
    const isCompleted = selectedTest.status === 'completed';

    return (
      <div className="h-full flex flex-col">
        {renderLightbox()}
        <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTestId(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-slate-200">{selectedTest.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              selectedTest.status === 'draft' ? 'bg-slate-700 text-slate-300' :
              selectedTest.status === 'running' ? 'bg-blue-600/20 text-blue-400' :
              'bg-green-600/20 text-green-400'
            }`}>
              {selectedTest.status === 'draft' ? '草稿' : selectedTest.status === 'running' ? '生成中' : '已完成'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedTest.variants.length < 5 && !isRunning && (
              <button
                onClick={() => onAddVariant(selectedTest.id)}
                className="text-sm px-3 py-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                + 添加变体
              </button>
            )}
            <button
              onClick={() => onRunTest(selectedTest.id)}
              disabled={isRunning || selectedTest.variants.filter(v => v.prompt.trim()).length < 2}
              className="btn btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {isCompleted ? '重新生图' : '开始生图'}
                </>
              )}
            </button>
            {isRunning && (
              <button
                onClick={() => onStopTest(selectedTest.id)}
                className="text-sm px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                停止
              </button>
            )}
          </div>
        </header>

        {/* Variants side by side */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-4 h-full" style={{ gridTemplateColumns: `repeat(${selectedTest.variants.length}, minmax(260px, 1fr))` }}>
            {selectedTest.variants.map(variant => (
              <div
                key={variant.id}
                className={`flex flex-col rounded-xl border ${
                  variant.isWinner
                    ? 'border-yellow-500/50 bg-yellow-500/5'
                    : 'border-slate-700 bg-slate-800/30'
                } overflow-hidden`}
              >
                {/* Variant header */}
                <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{variant.label}</span>
                    {variant.isWinner && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 font-medium">
                        🏆 获胜
                      </span>
                    )}
                    {variant.status === 'running' && (
                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {variant.status === 'failed' && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400">失败</span>
                    )}
                  </div>
                  {!isRunning && selectedTest.variants.length > 2 && (
                    <button
                      onClick={() => onRemoveVariant(selectedTest.id, variant.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Prompt input */}
                <div className="px-4 py-3 border-b border-slate-700/50 space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">正向 Prompt</label>
                    <textarea
                      value={variant.prompt}
                      onChange={e => onUpdateVariantPrompt(selectedTest.id, variant.id, e.target.value)}
                      disabled={isRunning}
                      rows={3}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none disabled:opacity-50"
                      placeholder="输入正向 Prompt..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">反向 Prompt</label>
                    <textarea
                      value={variant.negativePrompt || ''}
                      onChange={e => onUpdateVariantNegativePrompt(selectedTest.id, variant.id, e.target.value)}
                      disabled={isRunning}
                      rows={2}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none disabled:opacity-50"
                      placeholder="反向 Prompt（可选）..."
                    />
                  </div>
                </div>

                {/* Generated Image Result */}
                <div className="flex-1 px-4 py-3 flex flex-col items-center justify-center min-h-[200px]">
                  {variant.status === 'running' ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-slate-400">图片生成中...</span>
                    </div>
                  ) : variant.error ? (
                    <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 w-full">{variant.error}</div>
                  ) : variant.resultImage ? (
                    <img
                      src={variant.resultImage}
                      className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-contain"
                      onClick={() => setLightboxImage(variant.resultImage!)}
                      alt={`变体 ${variant.label} 生成结果`}
                    />
                  ) : (
                    <div className="text-sm text-slate-500 italic text-center">
                      <svg className="w-12 h-12 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      点击"开始生图"查看结果
                    </div>
                  )}
                </div>

                {/* Rating & Pick Winner */}
                {variant.status === 'completed' && variant.resultImage && (
                  <div className="px-4 py-3 border-t border-slate-700/50 flex items-center justify-between">
                    <StarRating
                      rating={variant.rating}
                      onChange={r => onRateVariant(selectedTest.id, variant.id, r)}
                    />
                    <button
                      onClick={() => onPickWinner(selectedTest.id, variant.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        variant.isWinner
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                      }`}
                    >
                      {variant.isWinner ? '🏆 已选为最优' : '选为最优'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- List View ---
  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-slate-200">A/B 测试</h1>
          <span className="text-sm text-slate-500">{tests.length} 个测试</span>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建测试
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400 mb-2">还没有 A/B 测试</p>
            <p className="text-sm text-slate-500 mb-4">对比不同 Prompt 变体的生图效果，找出最佳用词</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              创建第一个测试
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(test => {
              const completedImages = test.variants.filter(v => v.resultImage);
              return (
                <div
                  key={test.id}
                  className="group bg-slate-800/30 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedTestId(test.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-medium text-slate-200 truncate">{test.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          test.status === 'draft' ? 'bg-slate-700 text-slate-300' :
                          test.status === 'running' ? 'bg-blue-600/20 text-blue-400' :
                          'bg-green-600/20 text-green-400'
                        }`}>
                          {test.status === 'draft' ? '草稿' : test.status === 'running' ? '生成中' : '已完成'}
                        </span>
                      </div>
                      {/* Thumbnail strip */}
                      {completedImages.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {completedImages.slice(0, 4).map(v => (
                            <img
                              key={v.id}
                              src={v.resultImage}
                              className="w-12 h-12 rounded object-cover border border-slate-600"
                              alt={v.label}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{test.variants.length} 个变体</span>
                        {test.variants.some(v => v.isWinner) && (
                          <span className="text-yellow-400">🏆 已选最优</span>
                        )}
                        {test.variants.some(v => v.rating) && (
                          <span>最高评分: {Math.max(...test.variants.map(v => v.rating || 0))} ⭐</span>
                        )}
                        <span>{new Date(test.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteTest(test.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ABTestPanel;

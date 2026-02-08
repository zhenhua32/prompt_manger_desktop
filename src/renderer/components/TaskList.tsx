import React, { useMemo } from 'react';
import { ImageGenTask } from '../types';

interface TaskProps {
  task: ImageGenTask;
  onRefresh: (task: ImageGenTask) => void;
  onDelete: (taskId: string) => void;
  onPreview: (url: string) => void;
}

const TaskItem = React.memo(({ task, onRefresh, onDelete, onPreview }: TaskProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">等待中</span>;
      case 'processing':
        return <span className="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300 animate-pulse">生成中</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-300">完成</span>;
      case 'failed':
        return <span className="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-300">失败</span>;
      default:
        return null;
    }
  };

  return (
    <div 
      className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden group"
      // Optimization: skip rendering content for off-screen items
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 140px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {getStatusBadge(task.status)}
          <span className="text-xs text-slate-500">{new Date(task.createdAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === 'processing' && (
            <button 
              onClick={() => onRefresh(task)}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-blue-400"
              title="刷新状态"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {(task.status === 'failed' || task.status === 'pending') && task.taskId && (
            <button 
              onClick={() => onRefresh(task)}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-green-400"
              title="手动查询结果"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button 
            onClick={() => onDelete(task.id)}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
            title="删除任务"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex gap-4">
          {/* Result Image */}
          <div className="w-24 h-24 flex-shrink-0 bg-slate-900 rounded border border-slate-700 overflow-hidden flex items-center justify-center">
            {task.status === 'completed' && (task.resultImageUrl || task.resultImageBase64) ? (
              <img 
                src={task.resultImageUrl || task.resultImageBase64} 
                alt="Generation result" 
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                loading="lazy"
                decoding="async"
                onClick={() => {
                  const url = task.resultImageUrl || task.resultImageBase64;
                  if (url) onPreview(url);
                }}
              />
            ) : task.status === 'failed' ? (
              <svg className="w-8 h-8 text-red-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                <span className="animate-spin text-2xl mb-1">⟳</span>
                <span className="text-[10px]">生成中...</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 mb-1">Prompt:</p>
            <p className="text-sm text-slate-300 line-clamp-3 bg-slate-900/50 p-2 rounded border border-slate-700/50">
              {task.prompt}
            </p>
            {task.taskId && (
              <p className="text-[10px] text-slate-500 mt-1.5 font-mono flex items-center gap-1">
                <span className="text-slate-600">Task ID:</span>
                <span className="select-all">{task.taskId}</span>
              </p>
            )}
            {task.error && (
              <p className="text-xs text-red-400 mt-1.5">
                Error: {task.error}
              </p>
            )}
            {task.modelName && (
              <p className="text-[10px] text-slate-500 mt-1.5 text-right">
                Model: {task.modelName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

interface TaskListProps {
  tasks: ImageGenTask[];
  onRefresh: (task: ImageGenTask) => void;
  onDelete: (taskId: string) => void;
  onClearFinished: () => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onRefresh, onDelete, onClearFinished }) => {
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  // Memoize sorted tasks to prevent re-sorting on every render if tasks hasn't changed
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>暂无生图任务</p>
        <p className="text-xs mt-2">在提示词编辑器中点击"生成图片"即可创建任务</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h3 className="font-semibold text-slate-200">任务列表 ({tasks.length})</h3>
        <button 
          onClick={onClearFinished}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors"
        >
          清除已完成/失败任务
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedTasks.map(task => (
          <TaskItem 
            key={task.id} 
            task={task} 
            onRefresh={onRefresh} 
            onDelete={onDelete}
            onPreview={setPreviewImage}
          />
        ))}
      </div>

      {/* Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              关闭
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TaskList);

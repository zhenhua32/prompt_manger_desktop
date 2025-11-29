import React, { useState } from 'react';
import { Template, Category } from '../types';

interface TemplateManagerProps {
  templates: Template[];
  categories: Category[];
  onAddTemplate: (template: Partial<Template>) => Promise<Template>;
  onDeleteTemplate: (id: string) => void;
  onUseTemplate: (template: Template) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates,
  categories,
  onAddTemplate,
  onDeleteTemplate,
  onUseTemplate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: '',
    description: '',
    category: 'general',
  });
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const filteredTemplates = templates.filter((template) => {
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      template.content.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query)
    );
  });

  const handleAddTemplate = async () => {
    if (newTemplate.name.trim() && newTemplate.content.trim()) {
      await onAddTemplate({
        name: newTemplate.name.trim(),
        content: newTemplate.content.trim(),
        description: newTemplate.description.trim() || undefined,
        category: newTemplate.category,
        variables: extractVariables(newTemplate.content),
      });
      setNewTemplate({ name: '', content: '', description: '', category: 'general' });
      setIsAddingTemplate(false);
    }
  };

  // Extract variables like {{variable_name}} from template content
  const extractVariables = (content: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: { name: string; defaultValue?: string }[] = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (!variables.some((v) => v.name === name)) {
        variables.push({ name });
      }
    }
    
    return variables;
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-slate-200">模板库</h1>
          <span className="text-sm text-slate-500">{templates.length} 个模板</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索模板..."
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
            onClick={() => setIsAddingTemplate(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建模板
          </button>
        </div>
      </header>

      {/* Template List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTemplates.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-400 mb-2">暂无模板</h3>
              <p className="text-sm text-slate-500">创建模板以便快速生成提示词</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="card group relative">
                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setSelectedTemplate(template)}
                    className="p-1.5 rounded bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteTemplate(template.id)}
                    className="p-1.5 rounded bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="mb-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                    style={{
                      backgroundColor: `${getCategoryColor(template.category)}20`,
                      color: getCategoryColor(template.category),
                    }}
                  >
                    {getCategoryName(template.category)}
                  </span>
                  <h3 className="text-sm font-medium text-slate-200 mb-1">{template.name}</h3>
                  {template.description && (
                    <p className="text-xs text-slate-500 mb-2">{template.description}</p>
                  )}
                </div>

                {/* Preview */}
                <div className="p-3 bg-slate-900 rounded-lg mb-3">
                  <p className="text-xs text-slate-400 line-clamp-4 font-mono">
                    {template.content}
                  </p>
                </div>

                {/* Variables */}
                {template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.variables.map((variable) => (
                      <span
                        key={variable.name}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-900/30 text-purple-400"
                      >
                        {`{{${variable.name}}}`}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{formatDate(template.createdAt)}</span>
                  <button
                    onClick={() => onUseTemplate(template)}
                    className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                  >
                    使用模板 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Template Modal */}
      {isAddingTemplate && (
        <div className="modal-backdrop" onClick={() => setIsAddingTemplate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">创建新模板</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    模板名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="input"
                    placeholder="例如: 产品描述生成器"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">分类</label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
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
                  <label className="block text-sm font-medium text-slate-400 mb-1">描述</label>
                  <input
                    type="text"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    className="input"
                    placeholder="简短描述模板用途"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    模板内容 <span className="text-red-400">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    使用 {`{{变量名}}`} 定义可替换的变量
                  </p>
                  <textarea
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    className="textarea h-40 font-mono text-sm"
                    placeholder={`例如:\n请为以下产品生成营销文案:\n产品名称: {{product_name}}\n产品特点: {{features}}\n目标受众: {{target_audience}}`}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsAddingTemplate(false)} className="btn btn-secondary">
                  取消
                </button>
                <button
                  onClick={handleAddTemplate}
                  disabled={!newTemplate.name.trim() || !newTemplate.content.trim()}
                  className={`btn btn-primary ${
                    !newTemplate.name.trim() || !newTemplate.content.trim()
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedTemplate && (
        <div className="modal-backdrop" onClick={() => setSelectedTemplate(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">{selectedTemplate.name}</h3>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedTemplate.description && (
                <p className="text-sm text-slate-400 mb-4">{selectedTemplate.description}</p>
              )}
              <div className="p-4 bg-slate-900 rounded-lg mb-4 max-h-80 overflow-y-auto">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {selectedTemplate.content}
                </pre>
              </div>
              {selectedTemplate.variables.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-400 mb-2">变量:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable) => (
                      <span
                        key={variable.name}
                        className="inline-flex items-center px-2 py-1 rounded text-sm bg-purple-900/30 text-purple-400"
                      >
                        {variable.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  onUseTemplate(selectedTemplate);
                  setSelectedTemplate(null);
                }}
                className="btn btn-primary w-full"
              >
                使用此模板
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;

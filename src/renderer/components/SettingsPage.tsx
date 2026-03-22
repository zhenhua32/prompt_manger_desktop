import React, { useState } from 'react';
import { ImageGenApiConfig, LLMApiConfig } from '../types';

interface SettingsPageProps {
  imageGenConfig: ImageGenApiConfig;
  llmConfig: LLMApiConfig;
  onSaveImageGenConfig: (config: ImageGenApiConfig) => void;
  onSaveLlmConfig: (config: LLMApiConfig) => void;
}

type Tab = 'imageGen' | 'llm';

const SettingsPage: React.FC<SettingsPageProps> = ({
  imageGenConfig,
  llmConfig,
  onSaveImageGenConfig,
  onSaveLlmConfig,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('llm');

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 border-b border-slate-700 flex items-center px-6 bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-200">设置</h1>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Tab Bar */}
        <div className="w-48 border-r border-slate-700 bg-slate-800/30 py-4 px-3 flex-shrink-0">
          <button
            onClick={() => setActiveTab('llm')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-1 ${
              activeTab === 'llm'
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            大模型润色
          </button>
          <button
            onClick={() => setActiveTab('imageGen')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === 'imageGen'
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            生图模型
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'llm' && <LLMConfigSection config={llmConfig} onSave={onSaveLlmConfig} />}
          {activeTab === 'imageGen' && <ImageGenConfigSection config={imageGenConfig} onSave={onSaveImageGenConfig} />}
        </div>
      </div>
    </div>
  );
};

// ─── LLM Config Section ──────────────────────────

const LLMConfigSection: React.FC<{ config: LLMApiConfig; onSave: (c: LLMApiConfig) => void }> = ({ config, onSave }) => {
  const [formData, setFormData] = useState<LLMApiConfig>({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleChange = (field: keyof LLMApiConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!formData.apiUrl || !formData.apiKey) {
      setTestResult({ ok: false, message: '请先填写 API 地址和密钥' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${formData.apiKey}`,
      };
      let response: { ok: boolean; status: number; statusText: string; data: any };
      if (window.electronAPI) {
        response = await window.electronAPI.proxyFetch(`${formData.apiUrl}/v1/models`, {
          method: 'GET',
          headers,
        });
      } else {
        const res = await fetch(`${formData.apiUrl}/v1/models`, { method: 'GET', headers });
        const contentType = res.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data = await res.text();
        }
        response = { ok: res.ok, status: res.status, statusText: res.statusText, data };
      }
      if (response.ok) {
        setTestResult({ ok: true, message: '连接成功！' });
      } else {
        const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        setTestResult({ ok: false, message: `连接失败 (${response.status}): ${text.slice(0, 200)}` });
      }
    } catch (error: any) {
      setTestResult({ ok: false, message: `连接失败: ${error.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-1">大模型润色配置</h2>
        <p className="text-sm text-slate-400">配置 OpenAI 格式的大语言模型 API，用于润色和优化提示词。</p>
      </div>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            API 地址
            <span className="text-slate-500 font-normal ml-2">（不含 /v1/chat/completions 后缀）</span>
          </label>
          <input
            type="text"
            value={formData.apiUrl}
            onChange={e => handleChange('apiUrl', e.target.value)}
            placeholder="例如: https://api.openai.com"
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">API 密钥</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={formData.apiKey}
              onChange={e => handleChange('apiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 pr-20 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">模型名称</label>
          <input
            type="text"
            value={formData.modelName}
            onChange={e => handleChange('modelName', e.target.value)}
            placeholder="例如: gpt-4o, deepseek-chat"
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            系统提示词
            <span className="text-slate-500 font-normal ml-2">（定义润色风格和规则）</span>
          </label>
          <textarea
            value={formData.systemPrompt}
            onChange={e => handleChange('systemPrompt', e.target.value)}
            rows={6}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium text-slate-300">启用润色功能</span>
            <p className="text-xs text-slate-500 mt-0.5">启用后可在提示词编辑器中使用 AI 润色</p>
          </div>
          <button
            onClick={() => handleChange('enabled', !formData.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${formData.enabled ? 'bg-primary-500' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${formData.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} className="btn btn-primary px-6">
            {saved ? '✓ 已保存' : '保存配置'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn px-6 bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                测试中...
              </span>
            ) : '测试连接'}
          </button>
        </div>
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${testResult.ok ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Image Gen Config Section ──────────────────────────

const ImageGenConfigSection: React.FC<{ config: ImageGenApiConfig; onSave: (c: ImageGenApiConfig) => void }> = ({ config, onSave }) => {
  const [formData, setFormData] = useState<ImageGenApiConfig>({ ...config, customHeaders: config.customHeaders || {} });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const handleChange = (field: keyof ImageGenApiConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleAddHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      const newHeaders = { ...formData.customHeaders, [headerKey.trim()]: headerValue.trim() };
      handleChange('customHeaders', newHeaders);
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    const newHeaders = { ...formData.customHeaders };
    delete newHeaders[key];
    handleChange('customHeaders', newHeaders);
  };

  const handleSave = () => {
    onSave(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!formData.apiUrl || !formData.apiKey) {
      setTestResult({ ok: false, message: '请先填写 API 地址和密钥' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${formData.apiKey}`,
        ...formData.customHeaders,
      };
      let response: { ok: boolean; status: number; statusText: string; data: any };
      if (window.electronAPI) {
        response = await window.electronAPI.proxyFetch(`${formData.apiUrl}/v1/models`, {
          method: 'GET',
          headers,
        });
      } else {
        const res = await fetch(`${formData.apiUrl}/v1/models`, { method: 'GET', headers });
        const contentType = res.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data = await res.text();
        }
        response = { ok: res.ok, status: res.status, statusText: res.statusText, data };
      }
      if (response.ok) {
        setTestResult({ ok: true, message: '连接成功！' });
      } else {
        const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        setTestResult({ ok: false, message: `连接失败 (${response.status}): ${text.slice(0, 200)}` });
      }
    } catch (error: any) {
      setTestResult({ ok: false, message: `连接失败: ${error.message}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-1">生图模型配置</h2>
        <p className="text-sm text-slate-400">配置 OpenAI 格式的生图 API 接口，用于直接在应用中测试提示词生成图片。</p>
      </div>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            API 地址
            <span className="text-slate-500 font-normal ml-2">（不含 /v1/images/generations 后缀）</span>
          </label>
          <input
            type="text"
            value={formData.apiUrl}
            onChange={e => handleChange('apiUrl', e.target.value)}
            placeholder="例如: https://api.example.com"
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">API 密钥</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={formData.apiKey}
              onChange={e => handleChange('apiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 pr-20 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">模型名称</label>
          <input
            type="text"
            value={formData.modelName}
            onChange={e => handleChange('modelName', e.target.value)}
            placeholder="例如: dall-e-3, stable-diffusion-xl"
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            自定义请求头
            <span className="text-slate-500 font-normal ml-2">（例如: X-ModelScope-Async-Mode: true）</span>
          </label>
          <div className="space-y-2 mb-2">
            {Object.entries(formData.customHeaders || {}).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-slate-300">
                  {key}: <span className="text-slate-400">{value}</span>
                </div>
                <button
                  onClick={() => handleRemoveHeader(key)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                  title="删除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={headerKey}
              onChange={e => setHeaderKey(e.target.value)}
              placeholder="Header Key"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              value={headerValue}
              onChange={e => setHeaderValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleAddHeader}
              disabled={!headerKey.trim() || !headerValue.trim()}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-slate-200 transition-colors"
            >
              添加
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium text-slate-300">启用生图功能</span>
            <p className="text-xs text-slate-500 mt-0.5">启用后可在提示词编辑器中直接生成图片</p>
          </div>
          <button
            onClick={() => handleChange('enabled', !formData.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${formData.enabled ? 'bg-primary-500' : 'bg-slate-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${formData.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} className="btn btn-primary px-6">
            {saved ? '✓ 已保存' : '保存配置'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn px-6 bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-50"
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                测试中...
              </span>
            ) : '测试连接'}
          </button>
        </div>
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${testResult.ok ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;

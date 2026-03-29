import React, { useState } from 'react';
import { ImageGenApiConfig, ImageGenProvider } from '../types';

const PROVIDER_PRESETS: Record<ImageGenProvider, { label: string; description: string; defaultUrl: string; defaultModel: string; needsKey: boolean }> = {
  openai: { label: 'OpenAI 兼容', description: '支持 OpenAI、LocalAI、vLLM 等兼容接口', defaultUrl: '', defaultModel: '', needsKey: true },
  comfyui: { label: 'ComfyUI', description: '需安装 comfyui-openai-api 插件', defaultUrl: 'http://localhost:8188', defaultModel: 'default', needsKey: false },
  custom: { label: '自定义', description: '自定义 API 端点和请求格式', defaultUrl: '', defaultModel: '', needsKey: false },
};

const SAMPLER_OPTIONS = [
  'Euler', 'Euler a', 'DPM++ 2M', 'DPM++ 2M Karras', 'DPM++ SDE', 'DPM++ SDE Karras',
  'DPM++ 2M SDE', 'DPM++ 2M SDE Karras', 'DDIM', 'UniPC', 'LMS', 'Heun',
];

interface ApiConfigPanelProps {
  config: ImageGenApiConfig;
  onSave: (config: ImageGenApiConfig) => void;
}

const ApiConfigPanel: React.FC<ApiConfigPanelProps> = ({ config, onSave }) => {
  const [formData, setFormData] = useState<ImageGenApiConfig>({ 
    ...config,
    provider: config.provider || 'openai',
    customHeaders: config.customHeaders || {},
    defaultParams: config.defaultParams || {},
  });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  
  // Local state for header inputs
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const handleChange = (field: keyof ImageGenApiConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleParamChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      defaultParams: { ...prev.defaultParams, [field]: value },
    }));
    setSaved(false);
  };

  const handleProviderChange = (provider: ImageGenProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    setFormData(prev => ({
      ...prev,
      provider,
      apiUrl: prev.apiUrl || preset.defaultUrl,
      modelName: prev.modelName || preset.defaultModel,
    }));
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
    if (!formData.apiUrl) {
      setTestResult({ ok: false, message: '请先填写 API 地址' });
      return;
    }
    if (PROVIDER_PRESETS[formData.provider || 'openai'].needsKey && !formData.apiKey) {
      setTestResult({ ok: false, message: '请先填写 API 密钥' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      let response: { ok: boolean, status: number, statusText: string, data: any };
      
      const headers: Record<string, string> = {
        ...formData.customHeaders,
      };
      if (formData.apiKey) {
        headers['Authorization'] = `Bearer ${formData.apiKey}`;
      }

      // Different test endpoints per provider
      const provider = formData.provider || 'openai';
      let testUrl: string;
      switch (provider) {
        case 'comfyui':
        case 'openai':
        case 'custom':
        default:
          testUrl = `${formData.apiUrl}/v1/models`;
          break;
      }

      if (window.electronAPI) {
        // Use proxy fetch
         response = await window.electronAPI.proxyFetch(testUrl, {
          method: 'GET',
          headers,
        });
      } else {
        const res = await fetch(testUrl, {
          method: 'GET',
          headers,
        });
        let data;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          data = await res.text();
        }
        response = {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          data
        };
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
        <p className="text-sm text-slate-400">配置生图 API 接口，支持远程 API 和本地模型服务。</p>
      </div>

      <div className="space-y-5">
        {/* Provider Select */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">服务类型</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(PROVIDER_PRESETS) as [ImageGenProvider, typeof PROVIDER_PRESETS['openai']][]).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handleProviderChange(key)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  (formData.provider || 'openai') === key
                    ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <div className="text-sm font-medium">{preset.label}</div>
                <div className="text-xs mt-0.5 opacity-70">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* API URL */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            API 地址
            {(formData.provider || 'openai') === 'comfyui' && (
              <span className="text-slate-500 font-normal ml-2">（需安装 comfyui-openai-api 插件）</span>
            )}
            {(formData.provider || 'openai') !== 'comfyui' && (
              <span className="text-slate-500 font-normal ml-2">（不含 /v1/images/generations 后缀）</span>
            )}
          </label>
          <input
            type="text"
            value={formData.apiUrl}
            onChange={(e) => handleChange('apiUrl', e.target.value)}
            placeholder={PROVIDER_PRESETS[formData.provider || 'openai'].defaultUrl || '例如: https://api.example.com'}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            API 密钥
            {!PROVIDER_PRESETS[formData.provider || 'openai'].needsKey && (
              <span className="text-slate-500 font-normal ml-2">（本地服务通常不需要）</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={formData.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              placeholder={PROVIDER_PRESETS[formData.provider || 'openai'].needsKey ? 'sk-...' : '可留空'}
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

        {/* Model Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            模型名称
          </label>
          <input
            type="text"
            value={formData.modelName}
            onChange={(e) => handleChange('modelName', e.target.value)}
            placeholder="例如: dall-e-3, stable-diffusion-xl"
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Custom Headers */}
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
              onChange={(e) => setHeaderKey(e.target.value)}
              placeholder="Header Key"
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="text"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
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

        {/* Generation Parameters */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            默认生图参数
            <span className="text-slate-500 font-normal ml-2">（本地模型可控制更多参数）</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">宽度 (px)</label>
              <input
                type="number"
                value={formData.defaultParams?.width || ''}
                onChange={(e) => handleParamChange('width', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="512"
                min={64}
                max={2048}
                step={64}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">高度 (px)</label>
              <input
                type="number"
                value={formData.defaultParams?.height || ''}
                onChange={(e) => handleParamChange('height', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="512"
                min={64}
                max={2048}
                step={64}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">迭代步数 (Steps)</label>
              <input
                type="number"
                value={formData.defaultParams?.steps || ''}
                onChange={(e) => handleParamChange('steps', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="20"
                min={1}
                max={150}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">CFG Scale</label>
              <input
                type="number"
                value={formData.defaultParams?.cfgScale || ''}
                onChange={(e) => handleParamChange('cfgScale', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="7"
                min={1}
                max={30}
                step={0.5}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          {/* Sampler */}
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">采样器 (Sampler)</label>
            <select
              value={formData.defaultParams?.sampler || ''}
              onChange={(e) => handleParamChange('sampler', e.target.value || undefined)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">默认</option>
              {SAMPLER_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {/* Default Negative Prompt */}
          <div className="mt-3">
            <label className="block text-xs text-slate-500 mb-1">默认负面提示词</label>
            <textarea
              value={formData.defaultParams?.negativePrompt || ''}
              onChange={(e) => handleParamChange('negativePrompt', e.target.value || undefined)}
              placeholder="例如: lowres, bad anatomy, worst quality..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="text-sm font-medium text-slate-300">启用生图功能</span>
            <p className="text-xs text-slate-500 mt-0.5">启用后可在提示词编辑器中直接生成图片</p>
          </div>
          <button
            onClick={() => handleChange('enabled', !formData.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              formData.enabled ? 'bg-primary-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                formData.enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="btn btn-primary px-6"
          >
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

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${
            testResult.ok 
              ? 'bg-green-900/30 border border-green-700 text-green-300' 
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiConfigPanel;

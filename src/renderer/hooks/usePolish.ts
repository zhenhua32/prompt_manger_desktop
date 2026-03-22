import { useState, useEffect, useCallback, useRef } from 'react';
import { LLMApiConfig } from '../types';

const STORAGE_KEY = 'llmApiConfig';

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的 AI 绘画提示词优化专家。请对用户提供的提示词进行润色和优化，使其能更好地被 AI 绘画模型理解和执行。

优化规则：
1. 保持原始提示词的核心意图不变
2. 补充必要的画面细节描述（光照、构图、风格等）
3. 优化词语顺序，将最重要的描述放在前面
4. 适当添加质量提升相关的关键词
5. 输出为英文提示词
6. 只输出优化后的提示词，不要添加任何解释`;

const DEFAULT_CONFIG: LLMApiConfig = {
  apiUrl: '',
  apiKey: '',
  modelName: '',
  enabled: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

export function usePolish() {
  const [llmConfig, setLlmConfig] = useState<LLMApiConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const configRef = useRef<LLMApiConfig>(DEFAULT_CONFIG);

  useEffect(() => { configRef.current = llmConfig; }, [llmConfig]);

  // Load config from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.electronAPI) {
          const stored = await window.electronAPI.storeGet(STORAGE_KEY);
          if (stored) setLlmConfig({ ...DEFAULT_CONFIG, ...stored });
        }
      } catch (error) {
        console.error('Failed to load LLM config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const saveLlmConfig = useCallback(async (config: LLMApiConfig) => {
    setLlmConfig(config);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEY, config);
    }
  }, []);

  const polishPrompt = useCallback(async (promptContent: string): Promise<string> => {
    const config = configRef.current;
    if (!config.apiUrl || !config.apiKey || !config.modelName) {
      throw new Error('请先在设置中配置大模型 API');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    const body = JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: promptContent },
      ],
      temperature: 0.7,
    });

    let response: { ok: boolean; status: number; statusText: string; data: any };

    if (window.electronAPI) {
      response = await window.electronAPI.proxyFetch(`${config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body,
      });
    } else {
      const res = await fetch(`${config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body,
      });
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      response = { ok: res.ok, status: res.status, statusText: res.statusText, data };
    }

    if (!response.ok) {
      const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
    }

    const data = response.data;
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message?.content?.trim() || '';
    }

    throw new Error('API 返回格式异常');
  }, []);

  const translateContent = useCallback(async (text: string): Promise<string> => {
    const config = configRef.current;
    if (!config.apiUrl || !config.apiKey || !config.modelName) {
      throw new Error('请先在设置中配置大模型 API');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    const systemPrompt = '你是一个专业翻译。请将用户提供的文本翻译为中文。如果文本已经是中文，则翻译为英文。只输出翻译结果，不要添加任何解释或额外内容。';

    const body = JSON.stringify({
      model: config.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    });

    let response: { ok: boolean; status: number; statusText: string; data: any };

    if (window.electronAPI) {
      response = await window.electronAPI.proxyFetch(`${config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body,
      });
    } else {
      const res = await fetch(`${config.apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body,
      });
      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      response = { ok: res.ok, status: res.status, statusText: res.statusText, data };
    }

    if (!response.ok) {
      const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
    }

    const data = response.data;
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message?.content?.trim() || '';
    }

    throw new Error('API 返回格式异常');
  }, []);

  return {
    llmConfig,
    saveLlmConfig,
    polishPrompt,
    translateContent,
    loading,
  };
}

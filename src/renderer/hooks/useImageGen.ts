import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ImageGenApiConfig, ImageGenTask, ImageGenTaskStatus, ImageGenParams } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEYS = {
  API_CONFIG: 'imageGenApiConfig',
  TASKS: 'imageGenTasks',
};

const DEFAULT_CONFIG: ImageGenApiConfig = {
  apiUrl: '',
  apiKey: '',
  modelName: '',
  enabled: false,
  provider: 'openai',
};

export function useImageGen() {
  const [apiConfig, setApiConfig] = useState<ImageGenApiConfig>(DEFAULT_CONFIG);
  const [tasks, setTasks] = useState<ImageGenTask[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksRef = useRef<ImageGenTask[]>([]);
  const isPollingRef = useRef(false);
  const apiConfigRef = useRef<ImageGenApiConfig>(DEFAULT_CONFIG);

  // Keep refs in sync
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { apiConfigRef.current = apiConfig; }, [apiConfig]);

  // Derived boolean for polling control — only changes on true↔false transition
  const hasProcessingTasks = useMemo(
    () => tasks.some(t => t.status === 'processing'),
    [tasks]
  );

  // Load config and tasks from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.electronAPI) {
          const [storedConfig, storedTasks] = await Promise.all([
            window.electronAPI.storeGet(STORAGE_KEYS.API_CONFIG),
            window.electronAPI.storeGet(STORAGE_KEYS.TASKS),
          ]);
          if (storedConfig) setApiConfig(storedConfig);
          if (storedTasks) setTasks(storedTasks);
        }
      } catch (error) {
        console.error('Failed to load image gen data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Save config
  const saveApiConfig = useCallback(async (config: ImageGenApiConfig) => {
    setApiConfig(config);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEYS.API_CONFIG, config);
    }
  }, []);

  // Save tasks helper (persists to store)
  const persistTasks = useCallback((newTasks: ImageGenTask[]) => {
    if (window.electronAPI) {
      window.electronAPI.storeSet(STORAGE_KEYS.TASKS, newTasks).catch(console.error);
    }
  }, []);

  // Build request config based on provider type
  const buildRequest = useCallback((prompt: string, negativePrompt?: string, params?: ImageGenParams) => {
    const config = apiConfigRef.current;
    const mergedParams = { ...config.defaultParams, ...params };
    const provider = config.provider || 'openai';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.customHeaders,
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    let url: string;
    let body: any;

    switch (provider) {
      case 'comfyui': {
        // ComfyUI native API: parse workflow, inject prompt, POST to /prompt
        if (!config.comfyuiWorkflow) {
          throw new Error('请先配置 ComfyUI 工作流 JSON');
        }
        let workflow: Record<string, any>;
        try {
          workflow = JSON.parse(config.comfyuiWorkflow);
        } catch {
          throw new Error('工作流 JSON 格式错误，请从 ComfyUI 导出 API 格式的工作流');
        }

        // Inject positive prompt
        if (config.comfyuiPositiveNodeId && workflow[config.comfyuiPositiveNodeId]) {
          workflow[config.comfyuiPositiveNodeId].inputs.text = prompt;
        }
        // Inject negative prompt
        if (config.comfyuiNegativeNodeId && workflow[config.comfyuiNegativeNodeId]) {
          const neg = negativePrompt || mergedParams.negativePrompt;
          if (neg) {
            workflow[config.comfyuiNegativeNodeId].inputs.text = neg;
          }
        }

        url = `${config.apiUrl}/prompt`;
        body = { prompt: workflow };
        break;
      }
      case 'openai':
      case 'custom':
      default: {
        url = `${config.apiUrl}/v1/images/generations`;
        body = {
          model: config.modelName,
          prompt,
          n: 1,
          response_format: 'url',
          ...(negativePrompt || mergedParams.negativePrompt ? { negative_prompt: negativePrompt || mergedParams.negativePrompt } : {}),
          ...(mergedParams.width ? { size: `${mergedParams.width}x${mergedParams.height || mergedParams.width}` } : {}),
        };
        break;
      }
    }

    return { url, headers, body };
  }, []);

  // Parse response based on provider type
  const parseResponse = useCallback((data: any, provider: string): {
    taskId?: string;
    status: ImageGenTaskStatus;
    imageUrl?: string;
    imageBase64?: string;
    error?: string;
  } => {
    switch (provider) {
      case 'comfyui': {
        // ComfyUI /prompt returns {"prompt_id": "xxx", "number": N, "node_errors": {}}
        if (data.prompt_id) {
          return { taskId: data.prompt_id, status: 'processing' };
        }
        if (data.error) {
          return { status: 'failed', error: typeof data.error === 'string' ? data.error : JSON.stringify(data.error) };
        }
        if (data.node_errors && Object.keys(data.node_errors).length > 0) {
          const firstError = Object.values(data.node_errors)[0] as any;
          return { status: 'failed', error: firstError?.errors?.[0]?.message || '工作流节点执行错误' };
        }
        return { status: 'failed', error: 'ComfyUI 返回格式异常' };
      }
      default: {
        // OpenAI / ComfyUI / Custom — existing logic
        if (data.task_id) {
          return { taskId: data.task_id, status: 'processing' };
        }
        if (data.data && data.data.length > 0) {
          const item = data.data[0];
          if (item.url) {
            return { taskId: item.task_id, status: 'completed', imageUrl: item.url };
          }
          if (item.b64_json) {
            return { taskId: item.task_id, status: 'completed', imageBase64: `data:image/png;base64,${item.b64_json}` };
          }
          return { taskId: item.task_id, status: 'processing' };
        }
        return { status: 'failed', error: 'API 返回格式异常' };
      }
    }
  }, []);

  // Submit image generation request
  const generateImage = useCallback(async (prompt: string, negativePrompt?: string, params?: ImageGenParams): Promise<ImageGenTask | null> => {
    const provider = apiConfig.provider || 'openai';

    if (!apiConfig.apiUrl) {
      throw new Error('请先配置 API 地址');
    }
    if (provider !== 'comfyui' && !apiConfig.modelName) {
      throw new Error('请先配置模型名称');
    }
    if (provider === 'comfyui' && !apiConfig.comfyuiWorkflow) {
      throw new Error('请先配置 ComfyUI 工作流 JSON');
    }
    // Only require apiKey for non-local providers that typically need auth
    if (!apiConfig.apiKey && provider === 'openai') {
      throw new Error('请先配置 API 密钥');
    }

    const mergedParams = { ...apiConfig.defaultParams, ...params };
    const task: ImageGenTask = {
      id: uuidv4(),
      taskId: '',
      prompt,
      negativePrompt: negativePrompt || mergedParams.negativePrompt,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelName: apiConfig.modelName,
      params: mergedParams,
    };

    try {
      const { url, headers, body } = buildRequest(prompt, negativePrompt, params);

      let response: { ok: boolean, status: number, statusText: string, data: any };

      if (window.electronAPI) {
        response = await window.electronAPI.proxyFetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const contentType = res.headers.get('content-type');
        let data;
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

      if (!response.ok) {
        const errorText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
      }

      const parsed = parseResponse(response.data, provider);

      if (parsed.status === 'failed') {
        throw new Error(parsed.error || '生成失败');
      }

      task.taskId = parsed.taskId || task.id;
      task.status = parsed.status;
      if (parsed.imageUrl) task.resultImageUrl = parsed.imageUrl;
      if (parsed.imageBase64) task.resultImageBase64 = parsed.imageBase64;

      task.updatedAt = new Date().toISOString();
      setTasks(prev => {
        const newTasks = [task, ...prev];
        persistTasks(newTasks);
        return newTasks;
      });
      return task;
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message || '未知错误';
      task.updatedAt = new Date().toISOString();
      setTasks(prev => {
        const newTasks = [task, ...prev];
        persistTasks(newTasks);
        return newTasks;
      });
      return task;
    }
  }, [apiConfig, persistTasks, buildRequest, parseResponse]);

  // Helper: fetch via proxy or direct
  const doFetch = useCallback(async (url: string, options: RequestInit & { headers?: Record<string, string> } = {}) => {
    if (window.electronAPI) {
      return window.electronAPI.proxyFetch(url, options);
    }
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, data };
  }, []);

  // Poll ComfyUI history and fetch result image
  const pollComfyUI = useCallback(async (promptId: string, internalId: string) => {
    const config = apiConfigRef.current;
    if (!config.apiUrl) return null;

    try {
      const response = await doFetch(`${config.apiUrl}/history/${encodeURIComponent(promptId)}`);
      if (!response.ok) return null;

      const history = response.data;
      const entry = history[promptId];
      if (!entry) return null; // Not finished yet

      // Check for errors in outputs
      if (entry.status?.status_str === 'error') {
        return {
          id: internalId,
          updates: {
            status: 'failed' as ImageGenTaskStatus,
            error: entry.status?.messages?.[0]?.[1]?.message || '工作流执行失败',
            updatedAt: new Date().toISOString(),
          }
        };
      }

      // Find SaveImage / PreviewImage output nodes
      const outputs = entry.outputs || {};
      let imageFilename: string | undefined;
      let imageSubfolder: string | undefined;
      let imageType: string | undefined;

      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId];
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          const img = nodeOutput.images[0];
          imageFilename = img.filename;
          imageSubfolder = img.subfolder || '';
          imageType = img.type || 'output';
          break;
        }
      }

      if (!imageFilename) {
        // Outputs exist but no images — workflow may not have SaveImage node
        if (Object.keys(outputs).length > 0) {
          return {
            id: internalId,
            updates: {
              status: 'failed' as ImageGenTaskStatus,
              error: '工作流中未找到图片输出节点（需要 SaveImage 或 PreviewImage 节点）',
              updatedAt: new Date().toISOString(),
            }
          };
        }
        return null; // Still processing
      }

      // Fetch the actual image
      const viewParams = new URLSearchParams({
        filename: imageFilename,
        subfolder: imageSubfolder || '',
        type: imageType || 'output',
      });
      const imageResponse = await doFetch(`${config.apiUrl}/view?${viewParams.toString()}`);

      if (!imageResponse.ok) {
        return {
          id: internalId,
          updates: {
            status: 'failed' as ImageGenTaskStatus,
            error: `获取图片失败 (${imageResponse.status})`,
            updatedAt: new Date().toISOString(),
          }
        };
      }

      // imageResponse.data is a base64 data URL from proxy-fetch
      return {
        id: internalId,
        updates: {
          status: 'completed' as ImageGenTaskStatus,
          resultImageBase64: typeof imageResponse.data === 'string' && imageResponse.data.startsWith('data:')
            ? imageResponse.data
            : undefined,
          resultImageUrl: typeof imageResponse.data === 'string' && !imageResponse.data.startsWith('data:')
            ? `${config.apiUrl}/view?${viewParams.toString()}`
            : undefined,
          updatedAt: new Date().toISOString(),
        }
      };
    } catch (err) {
      console.error('[Poll ComfyUI] Failed:', err);
      return null;
    }
  }, [doFetch]);

  // Poll task status — optimized to batch updates
  const pollTaskStatus = useCallback(async (taskId: string, internalId: string) => {
    const config = apiConfigRef.current;
    if (!config.apiUrl || !config.apiKey) return null;

    const url = `${config.apiUrl}/v1/tasks/${taskId}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'X-ModelScope-Task-Type': 'image_generation',
      ...config.customHeaders,
    };

    try {
      let response: { ok: boolean, status: number, statusText: string, data: any };

      if (window.electronAPI) {
        response = await window.electronAPI.proxyFetch(url, {
          method: 'GET',
          headers,
        });
      } else {
        const res = await fetch(url, {
          method: 'GET',
          headers,
        });
        const contentType = res.headers.get('content-type');
        let data;
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

      if (!response.ok) {
        return null;
      }

      const data = response.data;
      let newStatus: ImageGenTaskStatus = 'processing';
      let resultUrl: string | undefined;
      let resultBase64: string | undefined;
      let error: string | undefined;

      const status = data.status || data.task_status || '';
      const statusLower = status.toLowerCase();

      if (statusLower === 'completed' || statusLower === 'success' || statusLower === 'succeeded' || statusLower === 'succeed') {
        newStatus = 'completed';
        if (data.output_images && data.output_images.length > 0) resultUrl = data.output_images[0];
        else if (data.data && data.data.length > 0) {
          resultUrl = data.data[0].url;
          if (data.data[0].b64_json) resultBase64 = `data:image/png;base64,${data.data[0].b64_json}`;
        }
        else if (data.output?.image_url) resultUrl = data.output.image_url;
        else if (data.output?.results && data.output.results.length > 0) resultUrl = data.output.results[0]?.url || data.output.results[0]?.orig_url;
        else if (data.result?.image_url) resultUrl = data.result.image_url;
        else if (data.url) resultUrl = data.url;
      } else if (statusLower === 'failed' || statusLower === 'error') {
        newStatus = 'failed';
        error = data.error?.message || data.message || '生成失败';
      } else if (statusLower === 'pending' || statusLower === 'processing' || statusLower === 'running') {
        newStatus = 'processing';
      } else {
        const nestedStatus = (data.output?.task_status || '').toLowerCase();
        if (nestedStatus === 'succeeded' || nestedStatus === 'succeed') {
          newStatus = 'completed';
          if (data.output?.results) resultUrl = data.output.results[0]?.url || data.output.results[0]?.orig_url;
        } else if (nestedStatus === 'failed') {
          newStatus = 'failed';
          error = data.output?.message || '生成失败';
        }
      }

      // Return update object instead of setting state directly
      return {
        id: internalId,
        updates: {
          status: newStatus,
          resultImageUrl: resultUrl,
          resultImageBase64: resultBase64,
          error: newStatus === 'completed' ? undefined : error,
          updatedAt: new Date().toISOString(),
        }
      };

    } catch (err) {
      console.error('[Poll] Failed to poll task status:', err);
      return null;
    }
  }, []);

  // Sequential polling logic
  const pollOnce = useCallback(async () => {
    if (isPollingRef.current) return;
    
    // Check processing tasks from REF to avoid closure staleness
    const currentProcessing = tasksRef.current.filter(t => t.status === 'processing');
    if (currentProcessing.length === 0) return;

    isPollingRef.current = true;
    const now = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000;
    const provider = apiConfigRef.current.provider || 'openai';
    
    // Batch updates
    const updates = new Map<string, any>();

    try {
      for (const t of currentProcessing) {
        const elapsed = now - new Date(t.createdAt).getTime();
        if (elapsed > TIMEOUT_MS) {
          updates.set(t.id, {
            status: 'failed',
            error: '查询超时（5分钟）',
            updatedAt: new Date().toISOString()
          });
          continue;
        }

        if (t.taskId) {
          const result = provider === 'comfyui'
            ? await pollComfyUI(t.taskId, t.id)
            : await pollTaskStatus(t.taskId, t.id);
          // Only update if status CHANGED or completed/failed
          if (result) {
            const currentTask = tasksRef.current.find(curr => curr.id === t.id);
            if (currentTask && (currentTask.status !== result.updates.status || result.updates.status === 'completed')) {
              updates.set(result.id, result.updates);
            }
          }
        }
      }

      // Apply batch updates if any
      if (updates.size > 0) {
        setTasks(prev => {
          let hasChanges = false;
          const newTasks = prev.map(t => {
            if (updates.has(t.id)) {
              hasChanges = true;
              return { ...t, ...updates.get(t.id) };
            }
            return t;
          });
          
          if (hasChanges) {
            persistTasks(newTasks);
            return newTasks;
          }
          return prev;
        });
      }

    } finally {
      isPollingRef.current = false;
    }
  }, [persistTasks, pollTaskStatus, pollComfyUI]); // pollTaskStatus, pollComfyUI are stable

  // Polling loop management
  useEffect(() => {
    const runLoop = async () => {
      if (!hasProcessingTasks) {
        if (pollingTimerRef.current) {
          clearTimeout(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        return;
      }

      await pollOnce();
      
      // Use ref to check if we should continue (tasks might have updated during await)
      if (tasksRef.current.some(t => t.status === 'processing')) {
        pollingTimerRef.current = setTimeout(runLoop, 3000);
      }
    };

    runLoop();

    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, [hasProcessingTasks, pollOnce]);

  // Manually refresh a task
  const refreshTask = useCallback(async (task: ImageGenTask) => {
    if (task.taskId) {
      const provider = apiConfigRef.current.provider || 'openai';
      const result = provider === 'comfyui'
        ? await pollComfyUI(task.taskId, task.id)
        : await pollTaskStatus(task.taskId, task.id);
      if (result) {
        setTasks(prev => {
          const newTasks = prev.map(t => 
            t.id === task.id ? { ...t, ...result.updates } : t
          );
          persistTasks(newTasks);
          return newTasks;
        });
      }
    }
  }, [pollTaskStatus, pollComfyUI, persistTasks]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const newTasks = prev.filter(t => t.id !== taskId);
      persistTasks(newTasks);
      return newTasks;
    });
  }, [persistTasks]);

  const clearFinishedTasks = useCallback(() => {
    setTasks(prev => {
      const newTasks = prev.filter(t => t.status === 'processing' || t.status === 'pending');
      persistTasks(newTasks);
      return newTasks;
    });
  }, [persistTasks]);

  return {
    apiConfig,
    tasks,
    loading,
    saveApiConfig,
    generateImage,
    refreshTask,
    deleteTask,
    clearFinishedTasks,
  };
}

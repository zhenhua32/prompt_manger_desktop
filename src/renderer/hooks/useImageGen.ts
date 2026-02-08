import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ImageGenApiConfig, ImageGenTask, ImageGenTaskStatus } from '../types';
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

  // Submit image generation request
  const generateImage = useCallback(async (prompt: string): Promise<ImageGenTask | null> => {
    if (!apiConfig.apiUrl || !apiConfig.apiKey || !apiConfig.modelName) {
      throw new Error('请先配置 API 地址、密钥和模型名称');
    }

    const task: ImageGenTask = {
      id: uuidv4(),
      taskId: '',
      prompt,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelName: apiConfig.modelName,
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`,
        ...apiConfig.customHeaders,
      };

      let response: { ok: boolean, status: number, statusText: string, data: any };

      if (window.electronAPI) {
        response = await window.electronAPI.proxyFetch(`${apiConfig.apiUrl}/v1/images/generations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: apiConfig.modelName,
            prompt,
            n: 1,
            response_format: 'url',
          }),
        });
      } else {
        const res = await fetch(`${apiConfig.apiUrl}/v1/images/generations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: apiConfig.modelName,
            prompt,
            n: 1,
            response_format: 'url',
          }),
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

      const data = response.data;

      if (data.task_id) {
        task.taskId = data.task_id;
        task.status = 'processing';
      } else if (data.data && data.data.length > 0) {
        task.taskId = data.data[0].task_id || task.id;
        if (data.data[0].url) {
          task.resultImageUrl = data.data[0].url;
          task.status = 'completed';
        } else if (data.data[0].b64_json) {
          task.resultImageBase64 = `data:image/png;base64,${data.data[0].b64_json}`;
          task.status = 'completed';
        } else {
          task.status = 'processing';
        }
      } else {
        throw new Error('API 返回格式异常');
      }

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
  }, [apiConfig, persistTasks]);

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
          const result = await pollTaskStatus(t.taskId, t.id);
          // Only update if status CHANGED or completed/failed
          // This prevents re-renders when task is still just 'processing'
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
  }, [persistTasks, pollTaskStatus]); // pollTaskStatus is stable

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
      const result = await pollTaskStatus(task.taskId, task.id);
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
  }, [pollTaskStatus, persistTasks]);

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

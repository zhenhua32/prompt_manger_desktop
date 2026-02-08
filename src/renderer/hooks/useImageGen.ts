import { useState, useEffect, useCallback, useRef } from 'react';
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
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksRef = useRef<ImageGenTask[]>([]);
  const isPollingRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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

  // Save tasks
  const saveTasks = useCallback((newTasks: ImageGenTask[]) => {
    setTasks(newTasks);
    if (window.electronAPI) {
      window.electronAPI.storeSet(STORAGE_KEYS.TASKS, newTasks).catch(console.error);
    }
  }, []);

  // Submit image generation request (OpenAI format)
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
        // Use IPC proxy fetch
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
        // Fallback or dev mode without Electron
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

      // Handle async task_id response
      if (data.task_id) {
        task.taskId = data.task_id;
        task.status = 'processing';
      }
      // Handle direct response (some APIs return results immediately)
      else if (data.data && data.data.length > 0) {
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
      const newTasks = [task, ...tasks];
      saveTasks(newTasks);
      return task;
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message || '未知错误';
      task.updatedAt = new Date().toISOString();
      const newTasks = [task, ...tasks];
      saveTasks(newTasks);
      return task;
    }
  }, [apiConfig, tasks, saveTasks]);

  // Poll task status
  const pollTaskStatus = useCallback(async (taskId: string, internalId: string) => {
    if (!apiConfig.apiUrl || !apiConfig.apiKey) return;

    const url = `${apiConfig.apiUrl}/v1/tasks/${taskId}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiConfig.apiKey}`,
      'X-ModelScope-Task-Type': 'image_generation',
      ...apiConfig.customHeaders,
    };

    console.log('[Poll] >>> GET', url);
    console.log('[Poll] >>> Headers:', JSON.stringify(headers));

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

      console.log('[Poll] <<< Status:', response.status, 'OK:', response.ok);
      console.log('[Poll] <<< Data:', JSON.stringify(response.data).slice(0, 800));

      if (!response.ok) {
        console.warn('[Poll] Response not ok:', response.status, response.data);
        return;
      }

      const data = response.data;

      let newStatus: ImageGenTaskStatus = 'processing';
      let resultUrl: string | undefined;
      let resultBase64: string | undefined;
      let error: string | undefined;

      // Normalize: check both data.status and data.task_status
      const status = data.status || data.task_status || '';
      const statusLower = status.toLowerCase();

      // Parse various response formats
      if (statusLower === 'completed' || statusLower === 'success' || statusLower === 'succeeded' || statusLower === 'succeed') {
        newStatus = 'completed';
        // ModelScope format: output_images array
        if (data.output_images && data.output_images.length > 0) {
          resultUrl = data.output_images[0];
        }
        // OpenAI format: data[].url
        else if (data.data && data.data.length > 0) {
          resultUrl = data.data[0].url;
          if (data.data[0].b64_json) {
            resultBase64 = `data:image/png;base64,${data.data[0].b64_json}`;
          }
        }
        // Other formats
        else if (data.output?.image_url) {
          resultUrl = data.output.image_url;
        } else if (data.output?.results && data.output.results.length > 0) {
          resultUrl = data.output.results[0]?.url || data.output.results[0]?.orig_url;
        } else if (data.result?.image_url) {
          resultUrl = data.result.image_url;
        } else if (data.url) {
          resultUrl = data.url;
        }
      } else if (statusLower === 'failed' || statusLower === 'error') {
        newStatus = 'failed';
        error = data.error?.message || data.message || '生成失败';
      } else if (statusLower === 'pending' || statusLower === 'processing' || statusLower === 'running') {
        newStatus = 'processing';
      } else {
        // Unknown status - try nested output.task_status
        console.log('[Poll] Unknown status:', status, '- checking for nested output data');
        const nestedStatus = (data.output?.task_status || '').toLowerCase();
        if (nestedStatus === 'succeeded' || nestedStatus === 'succeed') {
          newStatus = 'completed';
          if (data.output?.results) {
            resultUrl = data.output.results[0]?.url || data.output.results[0]?.orig_url;
          }
        } else if (nestedStatus === 'failed') {
          newStatus = 'failed';
          error = data.output?.message || '生成失败';
        }
      }

      setTasks(prev => {
        const updated = prev.map(t => {
          if (t.id === internalId) {
            return {
              ...t,
              status: newStatus,
              resultImageUrl: resultUrl || t.resultImageUrl,
              resultImageBase64: resultBase64 || t.resultImageBase64,
              error: newStatus === 'completed' ? undefined : (error || t.error),
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });
        if (window.electronAPI) {
          window.electronAPI.storeSet(STORAGE_KEYS.TASKS, updated).catch(console.error);
        }
        return updated;
      });
    } catch (err) {
      console.error('[Poll] Failed to poll task status:', err);
    }
  }, [apiConfig]);

  // Sequential polling: wait for current poll to finish before scheduling next
  const pollOnce = useCallback(async () => {
    if (isPollingRef.current) return; // Skip if already polling
    
    const now = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const currentProcessing = tasksRef.current.filter(t => t.status === 'processing');
    if (currentProcessing.length === 0) return;

    isPollingRef.current = true;
    console.log('[Poll] Polling', currentProcessing.length, 'processing tasks');

    try {
      for (const t of currentProcessing) {
        // Check if task has exceeded 5 minute timeout
        const elapsed = now - new Date(t.createdAt).getTime();
        if (elapsed > TIMEOUT_MS) {
          console.warn('[Poll] Task', t.taskId, 'timed out after 5 minutes');
          setTasks(prev => {
            const updated = prev.map(task => {
              if (task.id === t.id) {
                return { ...task, status: 'failed' as ImageGenTaskStatus, error: '查询超时（5分钟），请手动检查任务状态', updatedAt: new Date().toISOString() };
              }
              return task;
            });
            if (window.electronAPI) {
              window.electronAPI.storeSet(STORAGE_KEYS.TASKS, updated).catch(console.error);
            }
            return updated;
          });
          continue;
        }

        if (t.taskId) {
          await pollTaskStatus(t.taskId, t.id);
        }
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [pollTaskStatus]);

  // Auto-poll for processing tasks using setTimeout chain (not setInterval)
  useEffect(() => {
    const hasProcessing = tasks.some(t => t.status === 'processing');
    if (!hasProcessing) {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const scheduleNext = () => {
      pollingRef.current = setTimeout(async () => {
        await pollOnce();
        // Only schedule next if there are still processing tasks
        if (tasksRef.current.some(t => t.status === 'processing')) {
          scheduleNext();
        }
      }, 2000);
    };

    scheduleNext();

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [tasks, pollOnce]);

  // Manually refresh a task
  const refreshTask = useCallback(async (task: ImageGenTask) => {
    if (task.taskId) {
      await pollTaskStatus(task.taskId, task.id);
    }
  }, [pollTaskStatus]);

  // Delete a task
  const deleteTask = useCallback((taskId: string) => {
    const newTasks = tasks.filter(t => t.id !== taskId);
    saveTasks(newTasks);
  }, [tasks, saveTasks]);

  // Clear all completed / failed tasks
  const clearFinishedTasks = useCallback(() => {
    const newTasks = tasks.filter(t => t.status === 'processing' || t.status === 'pending');
    saveTasks(newTasks);
  }, [tasks, saveTasks]);

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

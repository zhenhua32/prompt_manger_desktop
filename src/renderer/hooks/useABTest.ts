import { useState, useEffect, useCallback, useRef } from 'react';
import { ABTest, ImageGenTask, ImageGenParams } from '../types';

const STORAGE_KEY = 'abTests';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

type GenerateImageFn = (prompt: string, negativePrompt?: string, params?: ImageGenParams) => Promise<ImageGenTask | null>;

export function useABTest(
  generateImage: GenerateImageFn,
  imageGenTasks: ImageGenTask[],
) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const testsRef = useRef(tests);
  useEffect(() => { testsRef.current = tests; }, [tests]);

  // Load from storage
  useEffect(() => {
    const load = async () => {
      try {
        if (window.electronAPI) {
          const stored = await window.electronAPI.storeGet(STORAGE_KEY);
          if (stored) setTests(stored);
        }
      } catch (e) {
        console.error('Failed to load AB tests:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Persist
  const persist = useCallback(async (data: ABTest[]) => {
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEY, data);
    }
  }, []);

  // Sync variant status from imageGenTasks
  useEffect(() => {
    setTests(prev => {
      let changed = false;
      const updated = prev.map(test => {
        if (test.status !== 'running') return test;

        const newVariants = test.variants.map(v => {
          if (!v.taskId || v.status === 'completed' || v.status === 'failed') return v;
          const task = imageGenTasks.find(t => t.id === v.taskId);
          if (!task) return v;

          if (task.status === 'completed') {
            changed = true;
            const img = task.resultImageBase64 || task.resultImageUrl || '';
            return { ...v, status: 'completed' as const, resultImage: img, error: undefined };
          }
          if (task.status === 'failed') {
            changed = true;
            return { ...v, status: 'failed' as const, error: task.error || '生成失败' };
          }
          return v;
        });

        const anyRunning = newVariants.some(v => v.status === 'running');
        const testStatus = anyRunning ? 'running' as const : 'completed' as const;

        if (testStatus !== test.status || changed) {
          changed = true;
          return { ...test, variants: newVariants, status: testStatus, updatedAt: new Date().toISOString() };
        }
        return test;
      });

      if (changed) {
        persist(updated);
        return updated;
      }
      return prev;
    });
  }, [imageGenTasks, persist]);

  const createTest = useCallback(async (name: string, prompts: string[], params?: ImageGenParams): Promise<ABTest> => {
    const labels = 'ABCDEFGHIJ';
    const test: ABTest = {
      id: generateId(),
      name,
      params,
      variants: prompts.map((p, i) => ({
        id: generateId(),
        label: `变体 ${labels[i] || i + 1}`,
        prompt: p,
        status: 'pending' as const,
      })),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [test, ...tests];
    setTests(updated);
    await persist(updated);
    return test;
  }, [tests, persist]);

  const deleteTest = useCallback(async (testId: string) => {
    const updated = tests.filter(t => t.id !== testId);
    setTests(updated);
    await persist(updated);
  }, [tests, persist]);

  const runTest = useCallback(async (testId: string) => {
    // Read test data from ref BEFORE calling setTests (avoids React 18 eager-state timing issues)
    const currentTest = testsRef.current.find(t => t.id === testId);
    if (!currentTest || currentTest.variants.filter(v => v.prompt.trim()).length < 2) return;

    // Capture variant info we need for generation
    const variantsToRun = currentTest.variants.map(v => ({
      id: v.id,
      prompt: v.prompt,
      negativePrompt: v.negativePrompt,
    }));
    const testParams = currentTest.params;

    // Reset variants in UI to show running state
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        return {
          ...t,
          status: 'running' as const,
          variants: t.variants.map(v => ({
            ...v,
            status: 'running' as const,
            resultImage: undefined,
            error: undefined,
            taskId: undefined,
          })),
        };
      });
      persist(updated);
      return updated;
    });

    // Fire all image gen requests in parallel, keep full task objects
    const results = await Promise.all(
      variantsToRun.map(async (variant) => {
        try {
          const task = await generateImage(variant.prompt, variant.negativePrompt, testParams);
          return { variantId: variant.id, task };
        } catch (e: any) {
          return { variantId: variant.id, task: null as ImageGenTask | null, error: e.message };
        }
      })
    );

    // Link variant -> task, using returned task objects directly
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        const newVariants = t.variants.map(v => {
          const r = results.find(r => r.variantId === v.id);
          if (!r) return v;
          if (!r.task) {
            return { ...v, status: 'failed' as const, error: r.error || '生成失败' };
          }
          const task = r.task;
          if (task.status === 'completed' || task.status === 'failed') {
            const img = task.resultImageBase64 || task.resultImageUrl || '';
            return {
              ...v,
              taskId: task.id,
              status: task.status === 'completed' ? 'completed' as const : 'failed' as const,
              resultImage: task.status === 'completed' ? img : undefined,
              error: task.status === 'failed' ? (task.error || '生成失败') : undefined,
            };
          }
          // Still processing (e.g. ComfyUI async) — sync effect will handle completion later
          return { ...v, taskId: task.id };
        });
        const allDone = newVariants.every(v => v.status === 'completed' || v.status === 'failed');
        return {
          ...t,
          variants: newVariants,
          status: allDone ? 'completed' as const : t.status,
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [generateImage, persist]);

  const rateVariant = useCallback(async (testId: string, variantId: string, rating: number) => {
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        return {
          ...t,
          variants: t.variants.map(v => v.id === variantId ? { ...v, rating } : v),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const pickWinner = useCallback(async (testId: string, variantId: string) => {
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        return {
          ...t,
          variants: t.variants.map(v => ({ ...v, isWinner: v.id === variantId })),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const updateVariantPrompt = useCallback(async (testId: string, variantId: string, prompt: string) => {
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        return {
          ...t,
          variants: t.variants.map(v => v.id === variantId ? { ...v, prompt } : v),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const updateVariantNegativePrompt = useCallback(async (testId: string, variantId: string, negativePrompt: string) => {
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        return {
          ...t,
          variants: t.variants.map(v => v.id === variantId ? { ...v, negativePrompt } : v),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const addVariant = useCallback(async (testId: string, prompt: string = '') => {
    const labels = 'ABCDEFGHIJ';
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        const idx = t.variants.length;
        return {
          ...t,
          variants: [...t.variants, {
            id: generateId(),
            label: `变体 ${labels[idx] || idx + 1}`,
            prompt,
            status: 'pending' as const,
          }],
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeVariant = useCallback(async (testId: string, variantId: string) => {
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        return {
          ...t,
          variants: t.variants.filter(v => v.id !== variantId),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const stopTest = useCallback(async (testId: string) => {
    setTests(prev => {
      const updated = prev.map(t => {
        if (t.id !== testId) return t;
        const newVariants = t.variants.map(v =>
          v.status === 'running'
            ? { ...v, status: 'failed' as const, error: '已手动停止' }
            : v
        );
        return {
          ...t,
          variants: newVariants,
          status: 'completed' as const,
          updatedAt: new Date().toISOString(),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  return {
    tests,
    loading,
    createTest,
    deleteTest,
    runTest,
    stopTest,
    rateVariant,
    pickWinner,
    updateVariantPrompt,
    updateVariantNegativePrompt,
    addVariant,
    removeVariant,
  };
}

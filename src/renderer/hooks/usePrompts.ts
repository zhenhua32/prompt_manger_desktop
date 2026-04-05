import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Prompt, Category, WordItem, WordCategory, Template, SearchFilter } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { defaultCategories, defaultWordLibrary, defaultWordCategories } from '../data/defaults';

const STORAGE_KEYS = {
  PROMPTS: 'prompts',
  CATEGORIES: 'categories',
  WORD_LIBRARY: 'wordLibrary',
  WORD_CATEGORIES: 'wordCategories',
  TEMPLATES: 'templates',
};

export function usePrompts() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [wordLibrary, setWordLibrary] = useState<WordItem[]>(defaultWordLibrary);
  const [wordCategories, setWordCategories] = useState<WordCategory[]>(defaultWordCategories);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>({ query: '' });

  // --- Debounced persistence ---
  const isLoadedRef = useRef(false);
  const promptsRef = useRef<Prompt[]>([]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Keep promptsRef in sync for flush-on-unmount
  useEffect(() => { promptsRef.current = prompts; }, [prompts]);

  /** Schedule a debounced save for a given storage key */
  const debouncedSave = useCallback((key: string, getData: () => any, delay = 500) => {
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      window.electronAPI?.storeSet(key, getData()).catch(console.error);
    }, delay);
  }, []);

  // Flush all pending saves on unmount (prevents data loss on app close)
  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
      // Synchronously flush prompts (most critical data)
      if (isLoadedRef.current) {
        window.electronAPI?.storeSet(STORAGE_KEYS.PROMPTS, promptsRef.current).catch(console.error);
      }
    };
  }, []);

  // Debounced effect: persist prompts whenever they change (after initial load)
  useEffect(() => {
    if (!isLoadedRef.current) return;
    debouncedSave(STORAGE_KEYS.PROMPTS, () => prompts);
  }, [prompts, debouncedSave]);

  // --- Migrate existing base64 images to file system ---
  const migrateBase64Images = useCallback(async (loadedPrompts: Prompt[]): Promise<Prompt[]> => {
    if (!window.electronAPI?.storeImageFile) return loadedPrompts;

    let changed = false;
    const migrated = await Promise.all(
      loadedPrompts.map(async (p) => {
        let updated = p;
        if (p.previewImage?.startsWith('data:')) {
          const ref = await window.electronAPI.storeImageFile(p.previewImage);
          if (ref) {
            updated = { ...updated, previewImage: ref };
            changed = true;
          }
        }
        if (p.referenceImage?.startsWith('data:')) {
          const ref = await window.electronAPI.storeImageFile(p.referenceImage);
          if (ref) {
            updated = { ...updated, referenceImage: ref };
            changed = true;
          }
        }
        return updated;
      })
    );
    if (changed) {
      console.log('[Migration] Converted base64 images to file references');
    }
    return migrated;
  }, []);

  // Load data from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.electronAPI) {
          const [
            storedPrompts,
            storedCategories,
            storedWordLibrary,
            storedWordCategories,
            storedTemplates,
          ] = await Promise.all([
            window.electronAPI.storeGet(STORAGE_KEYS.PROMPTS),
            window.electronAPI.storeGet(STORAGE_KEYS.CATEGORIES),
            window.electronAPI.storeGet(STORAGE_KEYS.WORD_LIBRARY),
            window.electronAPI.storeGet(STORAGE_KEYS.WORD_CATEGORIES),
            window.electronAPI.storeGet(STORAGE_KEYS.TEMPLATES),
          ]);

          if (storedPrompts) {
            // Migrate base64 images to file system (one-time)
            const hasBase64 = storedPrompts.some(
              (p: Prompt) => p.previewImage?.startsWith('data:') || p.referenceImage?.startsWith('data:')
            );
            if (hasBase64) {
              const migrated = await migrateBase64Images(storedPrompts);
              setPrompts(migrated);
              // Persist migrated data immediately (not debounced)
              await window.electronAPI.storeSet(STORAGE_KEYS.PROMPTS, migrated);
            } else {
              setPrompts(storedPrompts);
            }
          }
          if (storedCategories) setCategories(storedCategories);
          if (storedWordLibrary) setWordLibrary(storedWordLibrary);
          if (storedWordCategories) setWordCategories(storedWordCategories);
          if (storedTemplates) setTemplates(storedTemplates);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
        // Allow debounced saves only after initial load completes
        requestAnimationFrame(() => { isLoadedRef.current = true; });
      }
    };

    loadData();
  }, [migrateBase64Images]);

  // Save prompts - update UI immediately, persist via debounced effect
  const savePrompts = useCallback((newPrompts: Prompt[]) => {
    setPrompts(newPrompts);
  }, []);

  // Create prompt - uses functional update to avoid stale closure
  const createPrompt = useCallback(async (promptData: Partial<Prompt>): Promise<Prompt> => {
    const newPrompt: Prompt = {
      id: uuidv4(),
      title: promptData.title || '新提示词',
      content: promptData.content || '',
      contentTranslation: promptData.contentTranslation,
      description: promptData.description,
      category: promptData.category || 'general',
      tags: promptData.tags || [],
      format: promptData.format || 'text',
      previewImage: promptData.previewImage,
      referenceImage: promptData.referenceImage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
      isFavorite: false,
      order: 0,
    };

    let finalPrompt = newPrompt;
    setPrompts(prev => {
      finalPrompt = { ...newPrompt, order: prev.length };
      return [...prev, finalPrompt];
    });
    return finalPrompt;
  }, []);

  // Update prompt - uses functional update to avoid stale closure
  const updatePrompt = useCallback(async (id: string, updates: Partial<Prompt>) => {
    setPrompts(prev => {
      return prev.map((p) => {
        if (p.id === id) {
          // Save version if content changed
          const versions = [...p.versions];
          if (updates.content !== undefined && updates.content !== p.content && p.content.trim() !== '') {
            versions.push({
              id: uuidv4(),
              content: p.content,
              createdAt: new Date().toISOString(),
            });
            // Keep only the last 50 versions
            if (versions.length > 50) {
              versions.shift();
            }
          }
          return {
            ...p,
            ...updates,
            versions,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
    });
  }, []);

  // Delete prompt - optimized for instant UI response
  const deletePrompt = useCallback((id: string) => {
    setPrompts(prev => prev.filter((p) => p.id !== id));
  }, []);

  // Reorder prompts - optimized for instant UI response
  const reorderPrompts = useCallback((startIndex: number, endIndex: number) => {
    setPrompts(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((p, index) => ({ ...p, order: index }));
    });
  }, []);

  // Toggle favorite - optimized for instant UI response
  const toggleFavorite = useCallback((id: string) => {
    setPrompts(prev => prev.map((p) =>
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    ));
  }, []);

  // Restore version - uses functional update
  const restoreVersion = useCallback(async (promptId: string, versionId: string) => {
    setPrompts(prev => {
      const prompt = prev.find(p => p.id === promptId);
      if (!prompt) return prev;
      const version = prompt.versions.find(v => v.id === versionId);
      if (!version) return prev;
      return prev.map(p => {
        if (p.id === promptId) {
          const versions = [...p.versions, { id: uuidv4(), content: p.content, createdAt: new Date().toISOString() }];
          if (versions.length > 50) versions.shift();
          return { ...p, content: version.content, versions, updatedAt: new Date().toISOString() };
        }
        return p;
      });
    });
  }, []);

  // Filter prompts - memoized for performance
  const filteredPrompts = useMemo(() => {
    return prompts.filter((prompt) => {
      const { query, category, tags, format, favorites } = searchFilter;

      if (query) {
        const searchLower = query.toLowerCase();
        const matchesSearch =
          prompt.title.toLowerCase().includes(searchLower) ||
          prompt.content.toLowerCase().includes(searchLower) ||
          prompt.description?.toLowerCase().includes(searchLower) ||
          prompt.tags.some((tag) => tag.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      if (category && prompt.category !== category) return false;
      if (tags && tags.length > 0 && !tags.some((t) => prompt.tags.includes(t))) return false;
      if (format && prompt.format !== format) return false;
      if (favorites && !prompt.isFavorite) return false;

      return true;
    }).sort((a, b) => {
      switch (searchFilter.sortBy || 'timeDesc') {
        case 'timeAsc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'titleAsc':
          return a.title.localeCompare(b.title, 'zh-CN');
        case 'titleDesc':
          return b.title.localeCompare(a.title, 'zh-CN');
        case 'order':
          return a.order - b.order;
        case 'timeDesc':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [prompts, searchFilter]);

  // Category management
  const saveCategories = useCallback((newCategories: Category[]) => {
    setCategories(newCategories);
    // Categories change infrequently, save immediately
    window.electronAPI?.storeSet(STORAGE_KEYS.CATEGORIES, newCategories).catch(console.error);
  }, []);

  const addCategory = useCallback(async (category: Partial<Category>) => {
    const newCategory: Category = {
      id: uuidv4(),
      name: category.name || '新分类',
      color: category.color || '#3b82f6',
      order: 0,
    };
    setCategories(prev => {
      const updated = [...prev, { ...newCategory, order: prev.length }];
      window.electronAPI?.storeSet(STORAGE_KEYS.CATEGORIES, updated).catch(console.error);
      return updated;
    });
    return newCategory;
  }, []);

  // Reorder categories
  const reorderCategories = useCallback(async (startIndex: number, endIndex: number) => {
    setCategories(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      const reordered = result.map((c, index) => ({ ...c, order: index }));
      window.electronAPI?.storeSet(STORAGE_KEYS.CATEGORIES, reordered).catch(console.error);
      return reordered;
    });
  }, []);

  // Pin category to top
  const pinCategoryToTop = useCallback(async (categoryId: string) => {
    setCategories(prev => {
      const categoryIndex = prev.findIndex(c => c.id === categoryId);
      if (categoryIndex <= 0) return prev;
      const result = Array.from(prev);
      const [removed] = result.splice(categoryIndex, 1);
      result.splice(0, 0, removed);
      const reordered = result.map((c, index) => ({ ...c, order: index }));
      window.electronAPI?.storeSet(STORAGE_KEYS.CATEGORIES, reordered).catch(console.error);
      return reordered;
    });
  }, []);

  // Word categories management
  const saveWordCategories = useCallback(async (newWordCategories: WordCategory[]) => {
    setWordCategories(newWordCategories);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEYS.WORD_CATEGORIES, newWordCategories);
    }
  }, []);

  // Word library management
  const saveWordLibrary = useCallback((newWords: WordItem[]) => {
    setWordLibrary(newWords);
    debouncedSave(STORAGE_KEYS.WORD_LIBRARY, () => newWords);
  }, [debouncedSave]);

  const addWord = useCallback(async (word: Partial<WordItem>) => {
    const newWord: WordItem = {
      id: uuidv4(),
      word: word.word || '',
      translation: word.translation,
      category: word.category || 'general',
      tags: word.tags || [],
      usage: word.usage,
    };
    setWordLibrary(prev => {
      const updated = [...prev, newWord];
      debouncedSave(STORAGE_KEYS.WORD_LIBRARY, () => updated);
      return updated;
    });
    return newWord;
  }, [debouncedSave]);

  const deleteWord = useCallback(async (id: string) => {
    setWordLibrary(prev => {
      const updated = prev.filter(w => w.id !== id);
      debouncedSave(STORAGE_KEYS.WORD_LIBRARY, () => updated);
      return updated;
    });
  }, [debouncedSave]);

  const updateWord = useCallback(async (id: string, updates: Partial<WordItem>) => {
    setWordLibrary(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, ...updates } : w);
      debouncedSave(STORAGE_KEYS.WORD_LIBRARY, () => updated);
      return updated;
    });
  }, [debouncedSave]);

  // Template management
  const saveTemplates = useCallback((newTemplates: Template[]) => {
    setTemplates(newTemplates);
    debouncedSave(STORAGE_KEYS.TEMPLATES, () => newTemplates);
  }, [debouncedSave]);

  const addTemplate = useCallback(async (template: Partial<Template>) => {
    const newTemplate: Template = {
      id: uuidv4(),
      name: template.name || '新模板',
      content: template.content || '',
      description: template.description,
      category: template.category || 'general',
      variables: template.variables || [],
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => {
      const updated = [...prev, newTemplate];
      debouncedSave(STORAGE_KEYS.TEMPLATES, () => updated);
      return updated;
    });
    return newTemplate;
  }, [debouncedSave]);

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      debouncedSave(STORAGE_KEYS.TEMPLATES, () => updated);
      return updated;
    });
  }, [debouncedSave]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<Template>) => {
    setTemplates(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      debouncedSave(STORAGE_KEYS.TEMPLATES, () => updated);
      return updated;
    });
  }, [debouncedSave]);

  // Memoize sorted categories to keep stable reference
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );

  // Export/Import
  const exportData = useCallback(async () => {
    const data = JSON.stringify({
      prompts,
      categories,
      wordLibrary,
      wordCategories,
      templates,
    }, null, 2);
    
    if (window.electronAPI) {
      await window.electronAPI.exportPrompts(data);
    }
  }, [prompts, categories, wordLibrary, wordCategories, templates]);

  const importData = useCallback(async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.importPrompts();
      if (data) {
        if (data.prompts) await savePrompts(data.prompts);
        if (data.categories) await saveCategories(data.categories);
        if (data.wordLibrary) await saveWordLibrary(data.wordLibrary);
        if (data.wordCategories) await saveWordCategories(data.wordCategories);
        if (data.templates) await saveTemplates(data.templates);
      }
    }
  }, [savePrompts, saveCategories, saveWordLibrary, saveWordCategories, saveTemplates]);

  return {
    prompts: filteredPrompts,
    allPrompts: prompts,
    categories: sortedCategories,
    wordLibrary,
    wordCategories,
    templates,
    loading,
    searchFilter,
    setSearchFilter,
    createPrompt,
    updatePrompt,
    deletePrompt,
    reorderPrompts,
    toggleFavorite,
    restoreVersion,
    addCategory,
    reorderCategories,
    pinCategoryToTop,
    addWord,
    updateWord,
    deleteWord,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    exportData,
    importData,
  };
}

import { useState, useEffect, useCallback, useMemo } from 'react';
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

          if (storedPrompts) setPrompts(storedPrompts);
          if (storedCategories) setCategories(storedCategories);
          if (storedWordLibrary) setWordLibrary(storedWordLibrary);
          if (storedWordCategories) setWordCategories(storedWordCategories);
          if (storedTemplates) setTemplates(storedTemplates);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Save prompts - update UI immediately, persist asynchronously
  const savePrompts = useCallback((newPrompts: Prompt[]) => {
    setPrompts(newPrompts);
    // Persist to storage asynchronously without blocking UI
    if (window.electronAPI) {
      window.electronAPI.storeSet(STORAGE_KEYS.PROMPTS, newPrompts).catch(console.error);
    }
  }, []);

  // Create prompt
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
      order: prompts.length,
    };

    const newPrompts = [...prompts, newPrompt];
    await savePrompts(newPrompts);
    return newPrompt;
  }, [prompts, savePrompts]);

  // Update prompt
  const updatePrompt = useCallback(async (id: string, updates: Partial<Prompt>) => {
    const newPrompts = prompts.map((p) => {
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
    await savePrompts(newPrompts);
  }, [prompts, savePrompts]);

  // Delete prompt - optimized for instant UI response
  const deletePrompt = useCallback((id: string) => {
    setPrompts(prev => {
      const newPrompts = prev.filter((p) => p.id !== id);
      if (window.electronAPI) {
        window.electronAPI.storeSet(STORAGE_KEYS.PROMPTS, newPrompts).catch(console.error);
      }
      return newPrompts;
    });
  }, []);

  // Reorder prompts - optimized for instant UI response
  const reorderPrompts = useCallback((startIndex: number, endIndex: number) => {
    setPrompts(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      const reordered = result.map((p, index) => ({ ...p, order: index }));
      if (window.electronAPI) {
        window.electronAPI.storeSet(STORAGE_KEYS.PROMPTS, reordered).catch(console.error);
      }
      return reordered;
    });
  }, []);

  // Toggle favorite - optimized for instant UI response
  const toggleFavorite = useCallback((id: string) => {
    setPrompts(prev => {
      const newPrompts = prev.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      );
      // Persist asynchronously
      if (window.electronAPI) {
        window.electronAPI.storeSet(STORAGE_KEYS.PROMPTS, newPrompts).catch(console.error);
      }
      return newPrompts;
    });
  }, []);

  // Restore version
  const restoreVersion = useCallback(async (promptId: string, versionId: string) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    const version = prompt.versions.find((v) => v.id === versionId);
    if (!version) return;

    await updatePrompt(promptId, { content: version.content });
  }, [prompts, updatePrompt]);

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
    }).sort((a, b) => a.order - b.order);
  }, [prompts, searchFilter]);

  // Category management
  const saveCategories = useCallback(async (newCategories: Category[]) => {
    setCategories(newCategories);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEYS.CATEGORIES, newCategories);
    }
  }, []);

  const addCategory = useCallback(async (category: Partial<Category>) => {
    const newCategory: Category = {
      id: uuidv4(),
      name: category.name || '新分类',
      color: category.color || '#3b82f6',
      order: categories.length,
    };
    await saveCategories([...categories, newCategory]);
    return newCategory;
  }, [categories, saveCategories]);

  // Reorder categories
  const reorderCategories = useCallback(async (startIndex: number, endIndex: number) => {
    const result = Array.from(categories);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    const reordered = result.map((c, index) => ({ ...c, order: index }));
    await saveCategories(reordered);
  }, [categories, saveCategories]);

  // Pin category to top
  const pinCategoryToTop = useCallback(async (categoryId: string) => {
    const categoryIndex = categories.findIndex(c => c.id === categoryId);
    if (categoryIndex > 0) {
      await reorderCategories(categoryIndex, 0);
    }
  }, [categories, reorderCategories]);

  // Word library management
  const saveWordLibrary = useCallback(async (newWords: WordItem[]) => {
    setWordLibrary(newWords);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEYS.WORD_LIBRARY, newWords);
    }
  }, []);

  const addWord = useCallback(async (word: Partial<WordItem>) => {
    const newWord: WordItem = {
      id: uuidv4(),
      word: word.word || '',
      translation: word.translation,
      category: word.category || 'general',
      tags: word.tags || [],
      usage: word.usage,
    };
    await saveWordLibrary([...wordLibrary, newWord]);
    return newWord;
  }, [wordLibrary, saveWordLibrary]);

  const deleteWord = useCallback(async (id: string) => {
    await saveWordLibrary(wordLibrary.filter((w) => w.id !== id));
  }, [wordLibrary, saveWordLibrary]);

  const updateWord = useCallback(async (id: string, updates: Partial<WordItem>) => {
    const updatedWords = wordLibrary.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );
    await saveWordLibrary(updatedWords);
  }, [wordLibrary, saveWordLibrary]);

  // Template management
  const saveTemplates = useCallback(async (newTemplates: Template[]) => {
    setTemplates(newTemplates);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEYS.TEMPLATES, newTemplates);
    }
  }, []);

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
    await saveTemplates([...templates, newTemplate]);
    return newTemplate;
  }, [templates, saveTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await saveTemplates(templates.filter((t) => t.id !== id));
  }, [templates, saveTemplates]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<Template>) => {
    const updatedTemplates = templates.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    await saveTemplates(updatedTemplates);
  }, [templates, saveTemplates]);

  // Export/Import
  const exportData = useCallback(async () => {
    const data = JSON.stringify({
      prompts,
      categories,
      wordLibrary,
      templates,
    }, null, 2);
    
    if (window.electronAPI) {
      await window.electronAPI.exportPrompts(data);
    }
  }, [prompts, categories, wordLibrary, templates]);

  const importData = useCallback(async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.importPrompts();
      if (data) {
        if (data.prompts) await savePrompts(data.prompts);
        if (data.categories) await saveCategories(data.categories);
        if (data.wordLibrary) await saveWordLibrary(data.wordLibrary);
        if (data.templates) await saveTemplates(data.templates);
      }
    }
  }, [savePrompts, saveCategories, saveWordLibrary, saveTemplates]);

  return {
    prompts: filteredPrompts,
    allPrompts: prompts,
    categories: [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
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

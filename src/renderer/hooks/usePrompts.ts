import { useState, useEffect, useCallback } from 'react';
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

  // Save prompts
  const savePrompts = useCallback(async (newPrompts: Prompt[]) => {
    setPrompts(newPrompts);
    if (window.electronAPI) {
      await window.electronAPI.storeSet(STORAGE_KEYS.PROMPTS, newPrompts);
    }
  }, []);

  // Create prompt
  const createPrompt = useCallback(async (promptData: Partial<Prompt>): Promise<Prompt> => {
    const newPrompt: Prompt = {
      id: uuidv4(),
      title: promptData.title || '新提示词',
      content: promptData.content || '',
      description: promptData.description,
      category: promptData.category || 'general',
      tags: promptData.tags || [],
      format: promptData.format || 'text',
      previewImage: promptData.previewImage,
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
        if (updates.content && updates.content !== p.content) {
          versions.push({
            id: uuidv4(),
            content: p.content,
            createdAt: new Date().toISOString(),
          });
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

  // Delete prompt
  const deletePrompt = useCallback(async (id: string) => {
    const newPrompts = prompts.filter((p) => p.id !== id);
    await savePrompts(newPrompts);
  }, [prompts, savePrompts]);

  // Reorder prompts
  const reorderPrompts = useCallback(async (startIndex: number, endIndex: number) => {
    const result = Array.from(prompts);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    const reordered = result.map((p, index) => ({ ...p, order: index }));
    await savePrompts(reordered);
  }, [prompts, savePrompts]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (id: string) => {
    const newPrompts = prompts.map((p) =>
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    );
    await savePrompts(newPrompts);
  }, [prompts, savePrompts]);

  // Restore version
  const restoreVersion = useCallback(async (promptId: string, versionId: string) => {
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) return;

    const version = prompt.versions.find((v) => v.id === versionId);
    if (!version) return;

    await updatePrompt(promptId, { content: version.content });
  }, [prompts, updatePrompt]);

  // Filter prompts
  const filteredPrompts = prompts.filter((prompt) => {
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
    categories,
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
    addWord,
    deleteWord,
    addTemplate,
    deleteTemplate,
    exportData,
    importData,
  };
}

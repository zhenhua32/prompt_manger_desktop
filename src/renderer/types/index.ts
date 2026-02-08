// Prompt types
export interface Prompt {
  id: string;
  title: string;
  content: string;
  contentTranslation?: string;
  description?: string;
  category: string;
  tags: string[];
  format: PromptFormat;
  previewImage?: string;
  referenceImage?: string;
  createdAt: string;
  updatedAt: string;
  versions: PromptVersion[];
  isFavorite: boolean;
  order: number;
}

export interface PromptVersion {
  id: string;
  content: string;
  createdAt: string;
  note?: string;
}

export type PromptFormat = 'text' | 'code' | 'markdown' | 'json';

// Category types
export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
}

// Word library types
export interface WordItem {
  id: string;
  word: string;
  translation?: string;
  category: string;
  tags: string[];
  usage?: string;
}

export interface WordCategory {
  id: string;
  name: string;
  color: string;
}

// Template types
export interface Template {
  id: string;
  name: string;
  content: string;
  description?: string;
  category: string;
  variables: TemplateVariable[];
  createdAt: string;
}

export interface TemplateVariable {
  name: string;
  defaultValue?: string;
  description?: string;
}

// App state types
export interface AppState {
  prompts: Prompt[];
  categories: Category[];
  wordLibrary: WordItem[];
  wordCategories: WordCategory[];
  templates: Template[];
  settings: AppSettings;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  language: 'zh' | 'en';
  autoSave: boolean;
  fontSize: number;
}

// Filter and search types
export interface SearchFilter {
  query: string;
  category?: string;
  tags?: string[];
  format?: PromptFormat;
  favorites?: boolean;
}

// Image generation API types
export interface ImageGenApiConfig {
  apiUrl: string;
  apiKey: string;
  modelName: string;
  enabled: boolean;
  customHeaders?: Record<string, string>;
}

export type ImageGenTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImageGenTask {
  id: string;
  taskId: string;
  prompt: string;
  status: ImageGenTaskStatus;
  resultImageUrl?: string;
  resultImageBase64?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  modelName: string;
}

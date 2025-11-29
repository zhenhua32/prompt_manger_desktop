export {};

declare global {
  interface Window {
    electronAPI: {
      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, value: any) => Promise<boolean>;
      storeDelete: (key: string) => Promise<boolean>;
      selectImage: () => Promise<string | null>;
      exportPrompts: (data: string) => Promise<boolean>;
      importPrompts: () => Promise<any>;
    };
  }
}

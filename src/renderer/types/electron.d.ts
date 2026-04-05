export {};

declare global {
  interface Window {
    electronAPI: {
      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, value: any) => Promise<boolean>;
      storeDelete: (key: string) => Promise<boolean>;
      selectImage: () => Promise<string | null>;
      saveImage: (imageSource: string) => Promise<boolean>;
      exportPrompts: (data: string) => Promise<boolean>;
      importPrompts: () => Promise<any>;
      storeImageFile: (dataUrl: string) => Promise<string | null>;
      deleteImageFile: (imageRef: string) => Promise<boolean>;
      proxyFetch: (url: string, options?: any) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        data: any;
      }>;
    };
  }
}

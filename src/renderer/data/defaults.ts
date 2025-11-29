import { Category, WordItem, WordCategory } from '../types';

export const defaultCategories: Category[] = [
  { id: 'general', name: '通用', color: '#6366f1', order: 0 },
  { id: 'creative', name: '创意写作', color: '#ec4899', order: 1 },
  { id: 'coding', name: '编程开发', color: '#10b981', order: 2 },
  { id: 'business', name: '商业办公', color: '#f59e0b', order: 3 },
  { id: 'education', name: '教育学习', color: '#3b82f6', order: 4 },
  { id: 'image', name: '图像生成', color: '#8b5cf6', order: 5 },
];

export const defaultWordCategories: WordCategory[] = [
  { id: 'style', name: '风格', color: '#ec4899' },
  { id: 'quality', name: '质量', color: '#10b981' },
  { id: 'composition', name: '构图', color: '#f59e0b' },
  { id: 'lighting', name: '光照', color: '#3b82f6' },
  { id: 'subject', name: '主体', color: '#8b5cf6' },
  { id: 'mood', name: '氛围', color: '#6366f1' },
];

export const defaultWordLibrary: WordItem[] = [
  // 风格类
  { id: '1', word: 'photorealistic', translation: '照片级真实', category: 'style', tags: ['图像', '写实'], usage: '用于生成高度真实的图像' },
  { id: '2', word: 'anime style', translation: '动漫风格', category: 'style', tags: ['图像', '动漫'], usage: '生成日本动漫风格的图像' },
  { id: '3', word: 'oil painting', translation: '油画', category: 'style', tags: ['图像', '艺术'], usage: '模拟传统油画效果' },
  { id: '4', word: 'watercolor', translation: '水彩画', category: 'style', tags: ['图像', '艺术'], usage: '生成水彩画风格图像' },
  { id: '5', word: 'cyberpunk', translation: '赛博朋克', category: 'style', tags: ['图像', '科幻'], usage: '未来科技感的视觉风格' },
  { id: '6', word: 'minimalist', translation: '极简主义', category: 'style', tags: ['图像', '设计'], usage: '简洁清晰的设计风格' },
  
  // 质量类
  { id: '7', word: 'high quality', translation: '高质量', category: 'quality', tags: ['通用'], usage: '提升整体输出质量' },
  { id: '8', word: '4K resolution', translation: '4K分辨率', category: 'quality', tags: ['图像'], usage: '高分辨率输出' },
  { id: '9', word: '8K UHD', translation: '8K超高清', category: 'quality', tags: ['图像'], usage: '超高分辨率' },
  { id: '10', word: 'detailed', translation: '精细的', category: 'quality', tags: ['通用'], usage: '增加细节表现' },
  { id: '11', word: 'masterpiece', translation: '杰作', category: 'quality', tags: ['图像'], usage: '提示生成高质量作品' },
  { id: '12', word: 'best quality', translation: '最佳质量', category: 'quality', tags: ['图像'], usage: '强调最高质量输出' },
  
  // 构图类
  { id: '13', word: 'close-up shot', translation: '特写镜头', category: 'composition', tags: ['图像', '摄影'], usage: '近距离拍摄主体' },
  { id: '14', word: 'wide angle', translation: '广角', category: 'composition', tags: ['图像', '摄影'], usage: '展示更宽广的场景' },
  { id: '15', word: 'birds eye view', translation: '鸟瞰视角', category: 'composition', tags: ['图像', '摄影'], usage: '从上方俯视的视角' },
  { id: '16', word: 'portrait', translation: '肖像', category: 'composition', tags: ['图像', '摄影'], usage: '人物肖像构图' },
  { id: '17', word: 'full body', translation: '全身', category: 'composition', tags: ['图像'], usage: '展示完整身体' },
  { id: '18', word: 'centered composition', translation: '居中构图', category: 'composition', tags: ['图像'], usage: '主体居中的构图方式' },
  
  // 光照类
  { id: '19', word: 'soft lighting', translation: '柔和光线', category: 'lighting', tags: ['图像', '摄影'], usage: '温和不刺眼的照明' },
  { id: '20', word: 'dramatic lighting', translation: '戏剧性光线', category: 'lighting', tags: ['图像'], usage: '强烈对比的照明效果' },
  { id: '21', word: 'golden hour', translation: '黄金时刻', category: 'lighting', tags: ['图像', '摄影'], usage: '日出日落时的温暖光线' },
  { id: '22', word: 'studio lighting', translation: '工作室灯光', category: 'lighting', tags: ['图像', '摄影'], usage: '专业摄影棚照明' },
  { id: '23', word: 'natural light', translation: '自然光', category: 'lighting', tags: ['图像'], usage: '使用自然光源' },
  { id: '24', word: 'backlit', translation: '逆光', category: 'lighting', tags: ['图像', '摄影'], usage: '从后方照射的光线' },
  
  // 氛围类
  { id: '25', word: 'peaceful', translation: '宁静的', category: 'mood', tags: ['通用'], usage: '平和安详的氛围' },
  { id: '26', word: 'mysterious', translation: '神秘的', category: 'mood', tags: ['通用'], usage: '营造神秘感' },
  { id: '27', word: 'vibrant', translation: '充满活力的', category: 'mood', tags: ['通用'], usage: '活泼明亮的感觉' },
  { id: '28', word: 'melancholic', translation: '忧郁的', category: 'mood', tags: ['通用'], usage: '略带忧伤的氛围' },
  { id: '29', word: 'ethereal', translation: '空灵的', category: 'mood', tags: ['图像'], usage: '超凡脱俗的感觉' },
  { id: '30', word: 'cozy', translation: '温馨的', category: 'mood', tags: ['通用'], usage: '舒适温暖的感觉' },
];

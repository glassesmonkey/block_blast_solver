import content from '../../content.json';

export const useTranslation = () => {
  return {
    t: (key: string, options?: { [key: string]: any }) => {
      const keys = key.split('.');
      let value: any = content;
      
      for (const k of keys) {
        value = value?.[k];
      }

      if (typeof value === 'string' && options) {
        return value.replace(/\{\{(\w+)\}\}/g, (_, key) => options[key] || '');
      }

      return value || key;
    }
  };
}; 
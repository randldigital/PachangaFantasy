import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);
  };

  return (
    <Select value={i18n.language} onValueChange={changeLanguage}>
      <SelectTrigger className="w-20 bg-secondary border-gray-600">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">🇪🇸 ES</SelectItem>
        <SelectItem value="en">🇺🇸 EN</SelectItem>
      </SelectContent>
    </Select>
  );
}

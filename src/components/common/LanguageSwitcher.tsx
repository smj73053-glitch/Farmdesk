import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LANGUAGE_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Language } from '@/types/models';

export function LanguageSwitcher({ compact, className }: { compact?: boolean; className?: string }) {
  const { i18n } = useTranslation();
  const { user, profile, saveProfile } = useAuth();
  const value = (i18n.language?.split('-')[0] ?? 'en') as Language;

  const change = async (language: string) => {
    await i18n.changeLanguage(language);
    if (user && profile) {
      try {
        await saveProfile({ preferred_language: language as Language });
      } catch (error) {
        console.warn('Could not save language preference', error);
      }
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {!compact ? <Languages className="h-4 w-4 text-muted-foreground" /> : null}
      <Select value={value} onValueChange={(next) => void change(next)}>
        <SelectTrigger className={cn('h-8 w-[124px] border-transparent bg-transparent text-xs', !compact && 'border-input bg-background')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.native}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

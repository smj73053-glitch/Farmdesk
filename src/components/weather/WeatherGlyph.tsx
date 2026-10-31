import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Snowflake,
  Sun,
} from 'lucide-react';
import { weatherIconName } from '@/lib/weather';
import { cn } from '@/lib/utils';

const ICONS = {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  CloudHail,
  CloudSnow,
  Snowflake,
  CloudLightning,
} as const;

export function WeatherGlyph({ code, className }: { code: number; className?: string }) {
  const name = weatherIconName(code);
  const Icon = ICONS[name as keyof typeof ICONS] ?? CloudSun;
  return <Icon className={cn('h-6 w-6', className)} aria-hidden="true" />;
}

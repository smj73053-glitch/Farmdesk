import { useQuery } from '@tanstack/react-query';
import { notificationService, soilService, taskService, weatherAlertService } from '@/services/farmOpsService';
import { referenceService } from '@/services/referenceService';

export function useTasks(farmId: string | null) {
  return useQuery({
    queryKey: ['tasks', farmId],
    queryFn: () => taskService.list(farmId ?? undefined),
    enabled: Boolean(farmId),
    staleTime: 30 * 1000,
  });
}

export function useSoilRecords(farmId: string | null) {
  return useQuery({
    queryKey: ['soil', farmId],
    queryFn: () => soilService.list(farmId!),
    enabled: Boolean(farmId),
    staleTime: 60 * 1000,
  });
}

export function useWeatherAlerts(farmId: string | null) {
  return useQuery({
    queryKey: ['weather-alerts', farmId],
    queryFn: () => weatherAlertService.list(farmId!),
    enabled: Boolean(farmId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list(30),
    staleTime: 60 * 1000,
  });
}

export function useSchemes() {
  return useQuery({
    queryKey: ['schemes'],
    queryFn: () => referenceService.listSchemes(),
    staleTime: 6 * 60 * 60 * 1000,
  });
}

export function useKnowledgeArticles() {
  return useQuery({
    queryKey: ['knowledge'],
    queryFn: () => referenceService.listKnowledge(),
    staleTime: 6 * 60 * 60 * 1000,
  });
}

export function useKnowledgeArticle(slug: string | undefined) {
  return useQuery({
    queryKey: ['knowledge', slug],
    queryFn: () => referenceService.getKnowledge(slug!),
    enabled: Boolean(slug),
    staleTime: 6 * 60 * 60 * 1000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => referenceService.listSources(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

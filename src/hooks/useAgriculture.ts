import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { climateService, marketService, weatherService } from '@/services/agricultureDataService';
import { cropService } from '@/services/cropService';
import { buildRecommendations, defaultSeason } from '@/services/recommendationEngine';
import { supabase } from '@/lib/supabase';
import { AppError } from '@/lib/errors';
import type { Farm, MarketPrice, Season } from '@/types/models';

export function useWeather(farm: Farm | null) {
  return useQuery({
    queryKey: ['weather', farm?.latitude, farm?.longitude],
    queryFn: () => weatherService.getForecast(Number(farm!.latitude), Number(farm!.longitude)),
    enabled: Boolean(farm?.latitude != null && farm?.longitude != null),
    staleTime: 20 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useClimate(farm: Farm | null, years = 5) {
  return useQuery({
    queryKey: ['climate', farm?.latitude, farm?.longitude, years],
    queryFn: () => climateService.getHistory(Number(farm!.latitude), Number(farm!.longitude), years),
    enabled: Boolean(farm?.latitude != null && farm?.longitude != null),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useCropReference() {
  return useQuery({
    queryKey: ['crops'],
    queryFn: () => cropService.listCrops(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useFarmCrops(farmId: string | null) {
  return useQuery({
    queryKey: ['farm-crops', farmId],
    queryFn: () => cropService.listFarmCrops(farmId!),
    enabled: Boolean(farmId),
  });
}

export function useFarmCrop(cropId: string | undefined) {
  return useQuery({
    queryKey: ['farm-crop', cropId],
    queryFn: () => cropService.getFarmCrop(cropId!),
    enabled: Boolean(cropId),
  });
}

export function useCropActivities(farmCropId: string | undefined) {
  return useQuery({
    queryKey: ['activities', farmCropId],
    queryFn: () => cropService.listActivities(farmCropId!),
    enabled: Boolean(farmCropId),
  });
}

export function useFarmActivities(farmCropIds: string[]) {
  return useQuery({
    queryKey: ['farm-activities', farmCropIds.slice().sort().join(',')],
    queryFn: () => cropService.listActivitiesForFarm(farmCropIds),
    enabled: farmCropIds.length > 0,
  });
}

export function useCropVarieties(cropId: string | null) {
  return useQuery({
    queryKey: ['crop-varieties', cropId],
    queryFn: () => cropService.listVarieties(cropId ?? undefined),
    enabled: Boolean(cropId),
    staleTime: 60 * 60 * 1000,
  });
}

export function useMarketSnapshot(farm: Farm | null, limit = 500) {
  return useQuery({
    queryKey: ['market-snapshot', farm?.state, limit],
    queryFn: async (): Promise<MarketPrice[]> => {
      let query = supabase
        .from('market_prices')
        .select('*')
        .order('arrival_date', { ascending: false })
        .limit(limit);
      if (farm?.state) query = query.eq('state', farm.state);
      const { data, error } = await query;
      if (error) throw new AppError(`Could not load saved mandi prices: ${error.message}`);
      return (data ?? []) as MarketPrice[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface MarketSearchInput {
  commodity?: string;
  state?: string;
  district?: string;
  market?: string;
  limit?: number;
  offset?: number;
}

export function useMarketSearch(input: MarketSearchInput | null) {
  return useQuery({
    queryKey: ['market-search', input],
    queryFn: () => marketService.search(input ?? {}),
    enabled: Boolean(input),
    staleTime: 2 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}

export function useMarketHistory(commodity: string | null, marketName?: string) {
  return useQuery({
    queryKey: ['market-history', commodity, marketName],
    queryFn: () => marketService.history(commodity!, marketName, 180),
    enabled: Boolean(commodity),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecommendations(farm: Farm | null, seasonOverride?: Season) {
  const cropsQuery = useCropReference();
  const climateQuery = useClimate(farm);
  const weatherQuery = useWeather(farm);
  const marketQuery = useMarketSnapshot(farm);
  const queryClient = useQueryClient();

  const result = React.useMemo(() => {
    if (!farm || !cropsQuery.data?.length) return null;
    return buildRecommendations({
      crops: cropsQuery.data,
      farm,
      climate: climateQuery.data ?? null,
      marketRecords: marketQuery.data ?? [],
      weather: weatherQuery.data ?? null,
      season: seasonOverride ?? farm.farming_season ?? defaultSeason(),
    });
  }, [farm, cropsQuery.data, climateQuery.data, weatherQuery.data, marketQuery.data, seasonOverride]);

  return {
    result,
    crops: cropsQuery.data ?? [],
    climate: climateQuery.data ?? null,
    weather: weatherQuery.data ?? null,
    marketRecords: marketQuery.data ?? [],
    isLoading: cropsQuery.isLoading || climateQuery.isLoading || weatherQuery.isLoading || marketQuery.isLoading,
    error: cropsQuery.error ?? climateQuery.error ?? weatherQuery.error ?? marketQuery.error ?? null,
    refresh: async () => {
      await Promise.all([
        climateQuery.refetch(),
        weatherQuery.refetch(),
        marketQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['market-snapshot'] }),
      ]);
    },
  };
}

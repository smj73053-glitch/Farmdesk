import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { farmService } from '@/services/farmService';
import { useAuth } from '@/context/AuthContext';
import type { Farm, FarmField } from '@/types/models';

interface WorkspaceContextValue {
  farms: Farm[];
  farm: Farm | null;
  fields: FarmField[];
  isLoading: boolean;
  error: Error | null;
  farmId: string | null;
  selectFarm: (id: string) => void;
  refreshFarms: () => Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = 'farmdesk:current-farm';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, preferences, savePreferences } = useAuth();
  const [farmId, setFarmId] = React.useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const farmsQuery = useQuery({
    queryKey: ['farms', user?.id],
    queryFn: () => farmService.list(),
    enabled: Boolean(user?.id),
  });

  const farms = farmsQuery.data ?? [];

  React.useEffect(() => {
    if (!farms.length) return;
    const valid = farmId && farms.some((f) => f.id === farmId);
    if (valid) return;
    const preferred = preferences?.default_farm_id;
    const next = farms.find((f) => f.id === preferred) ?? farms.find((f) => f.is_primary) ?? farms[0];
    if (next) {
      setFarmId(next.id);
      localStorage.setItem(STORAGE_KEY, next.id);
    }
  }, [farms, farmId, preferences?.default_farm_id]);

  const farm = farms.find((f) => f.id === farmId) ?? farms[0] ?? null;

  const fieldsQuery = useQuery({
    queryKey: ['farm-fields', farm?.id],
    queryFn: () => farmService.listFields(farm!.id),
    enabled: Boolean(farm?.id),
  });

  const selectFarm = React.useCallback((id: string) => {
    setFarmId(id);
    localStorage.setItem(STORAGE_KEY, id);
    if (preferences) void savePreferences({ default_farm_id: id }).catch(() => undefined);
  }, [preferences, savePreferences]);

  const value: WorkspaceContextValue = {
    farms,
    farm,
    fields: fieldsQuery.data ?? [],
    isLoading: farmsQuery.isLoading,
    error: (farmsQuery.error as Error | null) ?? null,
    farmId: farm?.id ?? null,
    selectFarm,
    refreshFarms: async () => { await farmsQuery.refetch(); },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

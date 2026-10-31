import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/errors';
import type { Crop, CropActivity, CropStage, CropVariety, FarmCrop } from '@/types/models';

const CROP_SELECT = '*, crop:crops(*)';

export const cropService = {
  async listCrops(): Promise<Crop[]> {
    const { data, error } = await supabase
      .from('crops')
      .select('*')
      .eq('is_active', true)
      .order('name');
    throwIfError(error, 'Could not load crop reference data');
    return (data ?? []) as Crop[];
  },

  async listVarieties(cropId?: string): Promise<CropVariety[]> {
    let query = supabase.from('crop_varieties').select('*').order('name');
    if (cropId) query = query.eq('crop_id', cropId);
    const { data, error } = await query;
    throwIfError(error, 'Could not load varieties');
    return (data ?? []) as CropVariety[];
  },

  async listFarmCrops(farmId: string): Promise<FarmCrop[]> {
    const { data, error } = await supabase
      .from('farm_crops')
      .select(CROP_SELECT)
      .eq('farm_id', farmId)
      .order('sowing_date', { ascending: false });
    throwIfError(error, 'Could not load crops');
    return (data ?? []) as FarmCrop[];
  },

  async getFarmCrop(id: string): Promise<FarmCrop | null> {
    const { data, error } = await supabase.from('farm_crops').select(CROP_SELECT).eq('id', id).maybeSingle();
    throwIfError(error, 'Could not load crop');
    return (data as FarmCrop) ?? null;
  },

  async createFarmCrop(input: Partial<FarmCrop>): Promise<FarmCrop> {
    const payload = { ...input };
    delete (payload as Record<string, unknown>).crop;
    const { data, error } = await supabase.from('farm_crops').insert(payload).select(CROP_SELECT).single();
    throwIfError(error, 'Could not add crop');
    return data as FarmCrop;
  },

  async updateFarmCrop(id: string, input: Partial<FarmCrop>): Promise<FarmCrop> {
    const payload = { ...input };
    delete (payload as Record<string, unknown>).crop;
    const { data, error } = await supabase.from('farm_crops').update(payload).eq('id', id).select(CROP_SELECT).single();
    throwIfError(error, 'Could not update crop');
    return data as FarmCrop;
  },

  async removeFarmCrop(id: string): Promise<void> {
    const { error } = await supabase.from('farm_crops').delete().eq('id', id);
    throwIfError(error, 'Could not delete crop');
  },

  async listActivities(farmCropId: string): Promise<CropActivity[]> {
    const { data, error } = await supabase
      .from('crop_activities')
      .select('*')
      .eq('farm_crop_id', farmCropId)
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false });
    throwIfError(error, 'Could not load activities');
    return (data ?? []) as CropActivity[];
  },

  async listActivitiesForFarm(farmCropIds: string[]): Promise<CropActivity[]> {
    if (!farmCropIds.length) return [];
    const { data, error } = await supabase
      .from('crop_activities')
      .select('*')
      .in('farm_crop_id', farmCropIds)
      .order('activity_date', { ascending: false })
      .limit(500);
    throwIfError(error, 'Could not load activities');
    return (data ?? []) as CropActivity[];
  },

  async createActivity(input: Partial<CropActivity>): Promise<CropActivity> {
    const { data, error } = await supabase.from('crop_activities').insert(input).select('*').single();
    throwIfError(error, 'Could not save activity');
    return data as CropActivity;
  },

  async updateActivity(id: string, input: Partial<CropActivity>): Promise<CropActivity> {
    const { data, error } = await supabase.from('crop_activities').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update activity');
    return data as CropActivity;
  },

  async removeActivity(id: string): Promise<void> {
    const { error } = await supabase.from('crop_activities').delete().eq('id', id);
    throwIfError(error, 'Could not delete activity');
  },
};

export interface StageProgress {
  stage: CropStage;
  label: string;
  startDate: string | null;
  endDate: string | null;
  status: 'done' | 'current' | 'upcoming';
}

/** Compute stage dates from the crop's duration and generic reference stage durations. */
export function computeStages(
  sowingDate: string | null,
  durationDays: number | null,
  growthStages: { stage: string; days: number }[] | null,
  currentStage: CropStage
): StageProgress[] {
  const defaults = [
    { stage: 'land_preparation', days: 8 },
    { stage: 'sowing', days: 1 },
    { stage: 'germination', days: 7 },
    { stage: 'vegetative', days: 33 },
    { stage: 'flowering', days: 18 },
    { stage: 'fruiting', days: 22 },
    { stage: 'harvesting', days: 11 },
  ];
  const scaleTotal = (growthStages ?? defaults).reduce((s, x) => s + Number(x.days), 0) || 1;
  const target = durationDays ?? scaleTotal;
  const stages = (growthStages ?? defaults).map((s) => ({
    stage: s.stage,
    days: Math.max(1, Math.round((Number(s.days) / scaleTotal) * target)),
  }));

  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.stage === currentStage)
  );

  let cursor: Date | null = sowingDate ? new Date(`${sowingDate}T12:00:00`) : null;
  // land preparation happens before sowing; shift start back by its duration.
  const prep = stages.find((s) => s.stage === 'land_preparation');
  if (cursor && prep) {
    cursor = new Date(cursor.getTime() - prep.days * 86400000);
  }

  return stages.map((s, index) => {
    const start = cursor ? new Date(cursor) : null;
    const end = cursor ? new Date(cursor.getTime() + s.days * 86400000) : null;
    if (end) cursor = new Date(end.getTime() + 86400000);
    const status: StageProgress['status'] =
      currentStage === 'completed' ? 'done' : index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
    return {
      stage: s.stage as CropStage,
      label: s.stage,
      startDate: start?.toISOString().slice(0, 10) ?? null,
      endDate: end?.toISOString().slice(0, 10) ?? null,
      status,
    };
  });
}

export function stageFromSowingDate(
  sowingDate: string | null,
  durationDays: number | null,
  currentStage: CropStage
): CropStage {
  // Never override a stage the farmer explicitly set (harvest/completed).
  if (!sowingDate || currentStage === 'completed' || currentStage === 'harvesting') return currentStage;
  const days = Math.max(0, Math.floor((Date.now() - new Date(`${sowingDate}T12:00:00`).getTime()) / 86400000));
  const total = durationDays ?? 120;
  if (days < 0) return 'land_preparation';
  if (days < Math.round(total * 0.08)) return 'land_preparation';
  if (days < Math.round(total * 0.15)) return 'germination';
  if (days < Math.round(total * 0.55)) return 'vegetative';
  if (days < Math.round(total * 0.72)) return 'flowering';
  if (days < Math.round(total * 0.9)) return 'fruiting';
  return 'harvesting';
}

/** Suggest real, data-derived tasks for a crop. No fabricated reminders. */
export function suggestCropTasks(crop: FarmCrop): {
  title: string;
  description: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
}[] {
  if (!crop.sowing_date || !crop.crop) return [];
  const sowing = new Date(`${crop.sowing_date}T12:00:00`);
  const duration = crop.crop.growing_duration_days ?? 120;
  const suggestions = [
    {
      title: `Check germination – ${crop.crop.name}`,
      description: 'Inspect plant stand and gaps; record the observation in the crop timeline.',
      offset: Math.round(duration * 0.12),
      priority: 'medium' as const,
    },
    {
      title: `Top-dress fertiliser – ${crop.crop.name}`,
      description: 'Follow the soil test and crop package of practices; do not apply before heavy rain.',
      offset: Math.round(duration * 0.3),
      priority: 'medium' as const,
    },
    {
      title: `Pest scouting – ${crop.crop.name}`,
      description: `Look for ${crop.crop.major_pests?.slice(0, 2).join(' and ') || 'common pests'}. Record findings before spraying.`,
      offset: Math.round(duration * 0.45),
      priority: 'high' as const,
    },
    {
      title: `Pre-harvest check – ${crop.crop.name}`,
      description: 'Confirm expected harvest date, arrange labour/transport and check current mandi prices.',
      offset: Math.max(1, duration - 14),
      priority: 'high' as const,
    },
  ];
  return suggestions
    .filter((s) => s.offset > 0 && s.offset <= duration)
    .map((s) => ({
      title: s.title,
      description: s.description,
      dueDate: new Date(sowing.getTime() + s.offset * 86400000).toISOString().slice(0, 10),
      priority: s.priority,
    }));
}

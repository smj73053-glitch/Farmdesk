import { supabase } from '@/lib/supabase';
import { throwIfError } from '@/lib/errors';
import type { FarmTask, AppNotification, SoilRecord, FarmDocument, WeatherAlertRecord } from '@/types/models';

export const soilService = {
  async list(farmId: string): Promise<SoilRecord[]> {
    const { data, error } = await supabase
      .from('soil_records')
      .select('*')
      .eq('farm_id', farmId)
      .order('test_date', { ascending: false });
    throwIfError(error, 'Could not load soil records');
    return (data ?? []) as SoilRecord[];
  },

  async create(input: Partial<SoilRecord>): Promise<SoilRecord> {
    const { data, error } = await supabase.from('soil_records').insert(input).select('*').single();
    throwIfError(error, 'Could not save soil record');
    return data as SoilRecord;
  },

  async update(id: string, input: Partial<SoilRecord>): Promise<SoilRecord> {
    const { data, error } = await supabase.from('soil_records').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update soil record');
    return data as SoilRecord;
  },

  async remove(id: string): Promise<void> {
    const { data } = await supabase.from('soil_records').select('report_url').eq('id', id).maybeSingle();
    const { error } = await supabase.from('soil_records').delete().eq('id', id);
    throwIfError(error, 'Could not delete soil record');
    if (data?.report_url) {
      await supabase.storage.from('soil-reports').remove([data.report_url]);
    }
  },
};

export const taskService = {
  async list(farmId?: string): Promise<FarmTask[]> {
    let query = supabase.from('farm_tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
    if (farmId) query = query.eq('farm_id', farmId);
    const { data, error } = await query;
    throwIfError(error, 'Could not load tasks');
    return (data ?? []) as FarmTask[];
  },

  async create(input: Partial<FarmTask>): Promise<FarmTask> {
    const { data, error } = await supabase.from('farm_tasks').insert(input).select('*').single();
    throwIfError(error, 'Could not save task');
    return data as FarmTask;
  },

  async update(id: string, input: Partial<FarmTask>): Promise<FarmTask> {
    const { data, error } = await supabase.from('farm_tasks').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update task');
    return data as FarmTask;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('farm_tasks').delete().eq('id', id);
    throwIfError(error, 'Could not delete task');
  },
};

export const notificationService = {
  async list(limit = 30): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfError(error, 'Could not load notifications');
    return (data ?? []) as AppNotification[];
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    throwIfError(error, 'Could not update notification');
  },

  async markAllRead(): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    throwIfError(error, 'Could not update notifications');
  },
};

export const weatherAlertService = {
  async list(farmId: string): Promise<WeatherAlertRecord[]> {
    const { data, error } = await supabase
      .from('weather_alerts')
      .select('*')
      .eq('farm_id', farmId)
      .eq('is_dismissed', false)
      .order('alert_date', { ascending: true });
    throwIfError(error, 'Could not load weather alerts');
    return (data ?? []) as WeatherAlertRecord[];
  },

  async saveMany(
    userId: string,
    farmId: string,
    alerts: Omit<WeatherAlertRecord, 'id' | 'user_id' | 'farm_id' | 'is_dismissed'>[]
  ): Promise<void> {
    if (!alerts.length) return;
    const { error } = await supabase.from('weather_alerts').upsert(
      alerts.map((a) => ({ ...a, user_id: userId, farm_id: farmId })),
      { onConflict: 'user_id,farm_id,alert_type,alert_date,forecast_fetched_at', ignoreDuplicates: true }
    );
    // Alerts are a derived cache; failing to persist must not break the weather page.
    if (error) console.warn('Could not persist weather alerts', error.message);
  },

  async dismiss(id: string): Promise<void> {
    const { error } = await supabase.from('weather_alerts').update({ is_dismissed: true }).eq('id', id);
    throwIfError(error, 'Could not dismiss alert');
  },
};

export const documentService = {
  async list(farmId?: string): Promise<FarmDocument[]> {
    let query = supabase.from('farm_documents').select('*').order('created_at', { ascending: false });
    if (farmId) query = query.eq('farm_id', farmId);
    const { data, error } = await query;
    throwIfError(error, 'Could not load documents');
    return (data ?? []) as FarmDocument[];
  },

  async create(input: Partial<FarmDocument>): Promise<FarmDocument> {
    const { data, error } = await supabase.from('farm_documents').insert(input).select('*').single();
    throwIfError(error, 'Could not save document');
    return data as FarmDocument;
  },

  async remove(id: string): Promise<void> {
    const { data } = await supabase.from('farm_documents').select('file_path').eq('id', id).maybeSingle();
    const { error } = await supabase.from('farm_documents').delete().eq('id', id);
    throwIfError(error, 'Could not delete document');
    if (data?.file_path) {
      await supabase.storage.from('soil-reports').remove([data.file_path]);
    }
  },
};

import { supabase } from '@/lib/supabase';
import { throwIfError, currentUserId } from '@/lib/errors';
import type { Farm, FarmField, UserPreferences, Profile } from '@/types/models';

export const farmService = {
  async list(): Promise<Farm[]> {
    const { data, error } = await supabase
      .from('farms')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    throwIfError(error, 'Could not load farms');
    return (data ?? []) as Farm[];
  },

  async get(id: string): Promise<Farm | null> {
    const { data, error } = await supabase.from('farms').select('*').eq('id', id).maybeSingle();
    throwIfError(error, 'Could not load farm');
    return (data as Farm) ?? null;
  },

  async create(input: Partial<Farm>): Promise<Farm> {
    const userId = await currentUserId();
    const payload = {
      ...input,
      user_id: userId,
      name: input.name?.trim() || 'My farm',
      total_area: input.total_area ?? null,
      is_primary: input.is_primary ?? false,
    };
    const { data, error } = await supabase.from('farms').insert(payload).select('*').single();
    throwIfError(error, 'Could not create farm');
    return data as Farm;
  },

  async update(id: string, input: Partial<Farm>): Promise<Farm> {
    const { data, error } = await supabase.from('farms').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update farm');
    return data as Farm;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('farms').delete().eq('id', id);
    throwIfError(error, 'Could not delete farm');
  },

  async setPrimary(id: string, userId: string): Promise<void> {
    const { error: clearError } = await supabase
      .from('farms')
      .update({ is_primary: false })
      .eq('user_id', userId)
      .neq('id', id);
    throwIfError(clearError, 'Could not update primary farm');
    const { error } = await supabase.from('farms').update({ is_primary: true }).eq('id', id);
    throwIfError(error, 'Could not set primary farm');
    await supabase.from('user_preferences').update({ default_farm_id: id }).eq('user_id', userId);
  },

  async listFields(farmId: string): Promise<FarmField[]> {
    const { data, error } = await supabase
      .from('farm_fields')
      .select('*')
      .eq('farm_id', farmId)
      .order('created_at', { ascending: true });
    throwIfError(error, 'Could not load fields');
    return (data ?? []) as FarmField[];
  },

  async createField(input: Partial<FarmField>): Promise<FarmField> {
    const { data, error } = await supabase.from('farm_fields').insert(input).select('*').single();
    throwIfError(error, 'Could not add field');
    return data as FarmField;
  },

  async updateField(id: string, input: Partial<FarmField>): Promise<FarmField> {
    const { data, error } = await supabase.from('farm_fields').update(input).eq('id', id).select('*').single();
    throwIfError(error, 'Could not update field');
    return data as FarmField;
  },

  async removeField(id: string): Promise<void> {
    const { error } = await supabase.from('farm_fields').delete().eq('id', id);
    throwIfError(error, 'Could not delete field');
  },
};

export const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    throwIfError(error, 'Could not load profile');
    return (data as Profile) ?? null;
  },

  async updateProfile(userId: string, input: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').update(input).eq('id', userId).select('*').single();
    throwIfError(error, 'Could not update profile');
    return data as Profile;
  },

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    throwIfError(error, 'Could not load preferences');
    return (data as UserPreferences) ?? null;
  },

  async updatePreferences(userId: string, input: Partial<UserPreferences>): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, ...input }, { onConflict: 'user_id' })
      .select('*')
      .single();
    throwIfError(error, 'Could not save preferences');
    return data as UserPreferences;
  },
};

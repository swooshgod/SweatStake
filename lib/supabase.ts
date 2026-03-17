import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://fdrrpdqemiqclyuvqxgs.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcnJwZHFlbWlxY2x5dXZxeGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjQxOTUsImV4cCI6MjA4ODk0MDE5NX0.8JcpcLkD6TSwNbbf9Nu8jV3Nsr_z1fACjlUHqbp43Uo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

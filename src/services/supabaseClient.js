import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gbwoiynhjjpclgrzgvcm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdid29peW5oampwY2xncnpndmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzODg1MzksImV4cCI6MjA5ODk2NDUzOX0.tvNFGzjO-WN0FinbEJjfgvof0_w_RSvOa311jdxsct8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

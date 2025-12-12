import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wdbmjfjhzpldnxdxawle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkYm1qZmpoenBsZG54ZHhhd2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NzY1NjgsImV4cCI6MjA4MTA1MjU2OH0.OUauFNBK-0YUKNQCRer_b4iHEnhrmelQ3qB3AiD7HHw';

export const supabase = createClient(supabaseUrl, supabaseKey);
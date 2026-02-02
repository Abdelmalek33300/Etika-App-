import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://athflnejxabgvbqcycnx.supabase.co'
const supabaseAnonKey = 'sb_publishable_W53zEBNzPEQFt940FQKjNw_BUikW06e'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

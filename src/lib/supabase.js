import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uideozxlwfnuyjvnnsqi.supabase.co'
const supabaseAnonKey = 'sb_publishable_Iv6mHjWhfayfN0u0yESEkg_zwXUiucA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Store = {
  id: number;
  name: string;
  radius_m: number;
  address: string | null;
  prefecture: string | null;
  area: string | null;
  phone: string | null;
  responsible_person: string | null;
  store_type: string | null;
  latitude: number | null;
  longitude: number | null;
  memo: string | null;
};

export type StaffStore = {
  id: number;
  staff_id: number;
  store_id: number;
  stores?: Store;
};

export type Staff = {
  id: number;
  line_user_id: string;
  name: string;
  role: string;
  hired_at: string | null;
  memo: string | null;
  stores?: Store;
  staff_stores?: StaffStore[];
};

export type PendingStaff = {
  id: number;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export type AttendanceLog = {
  id: number;
  staff_id: number;
  store_id: number | null;
  type: string;
  lat: number;
  lng: number;
  punched_at: string;
  is_stamped: boolean;
  stamped_at: string | null;
  report_status: string | null;
  // Phase 9: 新日報形式
  report_type?: 'daily' | 'review' | 'goal' | null;
  // 毎日実績
  fact_new_course?: number | null;
  fact_sub_15?: number | null;
  fact_sub_13?: number | null;
  fact_sub_11?: number | null;
  fact_existing_customers?: number | null;
  fact_shop_sales?: number | null;
  fact_total_revenue?: number | null;
  // 振り返り
  review_good_1?: string | null;
  review_good_2?: string | null;
  review_good_3?: string | null;
  review_obstacle?: string | null;
  review_question?: string | null;
  review_action_plan?: string | null;
  // 月初目標
  monthly_goal?: string | null;
  staff?: Staff & { stores?: Store };
  store?: Store;
};

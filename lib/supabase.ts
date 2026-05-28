import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Store = {
  id: number;
  name: string;
  lat: number;
  lng: number;
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
  store_id: number;
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
  report_work: string | null;
  report_notice: string | null;
  report_improve: string | null;
  report_fact: string | null;
  report_think: string | null;
  report_action: string | null;
  report_request: string | null;
  is_stamped: boolean;
  stamped_at: string | null;
  is_adopted: boolean;
  adopted_at: string | null;
  report_status: string | null;
  staff?: Staff & { stores?: Store };
  store?: Store;
};

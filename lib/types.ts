export type Role = 'admin' | 'member' | 'viewer' | null;

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
};

export type Row = { id: string; [key: string]: any };

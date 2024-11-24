export interface User {
  id: string;
  username: string;
  token: string;
  token_expiry: Date;
  created_at: Date;
}

export interface Token {
  id: string;
  token: string;
  duration: '3month' | '6month' | '1year';
  created_at: Date;
  used_by?: string;
  is_used: boolean;
}

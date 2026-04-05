export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  is_test_user: boolean;
  created_at: string;
}

export interface AuthSuccessResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

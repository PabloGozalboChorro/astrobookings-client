import { http } from './http';
import { authResponseDtoSchema, type AuthResponseDto } from './schemas';

export type { AuthResponseDto };

export type LoginRequest = { email: string; password: string };

export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
  terms: true;
};

export function register(request: RegisterRequest): Promise<AuthResponseDto> {
  return http('/users', authResponseDtoSchema, { method: 'POST', body: request });
}

export function login(request: LoginRequest): Promise<AuthResponseDto> {
  return http('/login', authResponseDtoSchema, { method: 'POST', body: request });
}

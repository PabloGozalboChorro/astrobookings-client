import { http } from './http';
import { authResponseDtoSchema, type AuthResponseDto } from './schemas';

export type { AuthResponseDto };

export type LoginRequest = { email: string; password: string };

export function login(request: LoginRequest): Promise<AuthResponseDto> {
  return http('/login', authResponseDtoSchema, { method: 'POST', body: request });
}

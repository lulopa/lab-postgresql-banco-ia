import { request } from './apiClient';
import type { OtpSolicitudResponse, PropositoOtp, TokenExchangeRequest, TokenResponse } from '@/contracts';

// Endpoints /auth/* NO están en el documento §3.1: son SUPUESTOS del BFF a confirmar.
export const authService = {
  exchangeCode: (body: TokenExchangeRequest) =>
    request<TokenResponse>('/api/v1/auth/token', { method: 'POST', body, skipAuth: true, skipRefresh: true }),
  refresh: () =>
    request<TokenResponse>('/api/v1/auth/refresh', { method: 'POST', skipAuth: true, skipRefresh: true }),
  logout: () => request<void>('/api/v1/auth/logout', { method: 'POST', skipRefresh: true }),
  solicitarOtp: (proposito: PropositoOtp) =>
    request<OtpSolicitudResponse>('/api/v1/auth/otp/solicitar', { method: 'POST', body: { proposito } }),
};

/** COMPARTIDO. Roles del frontend; mapean a rol_consulta / rol_operativo / rol_auditor en la BD (G7). */
export type Rol = 'CLIENTE' | 'OPERATIVO' | 'AUDITOR';

export interface SesionUsuario {
  id_usuario: string;
  nombre: string;
  roles: Rol[];
}

/** SUPUESTO (no está en el documento): el intercambio del code PKCE lo hace el BFF para que
 *  el refresh token viaje solo como cookie HttpOnly y nunca toque JavaScript. */
export interface TokenExchangeRequest {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number; // segundos (900)
  usuario: SesionUsuario;
}

export type PropositoOtp = 'TRANSFERENCIA' | 'CAMBIO_SEGURIDAD';

export interface OtpSolicitudResponse {
  canal: 'SMS' | 'EMAIL';
  ttl_segundos: number;
}

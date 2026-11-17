import type { Rol } from '../src/contracts';

export interface Principal {
  sub: string;
  nombre: string;
  roles: Rol[];
  idCliente?: string; // bigint como texto
  idUsuario?: number; // banco_security.usuario_interno.id_usuario
}

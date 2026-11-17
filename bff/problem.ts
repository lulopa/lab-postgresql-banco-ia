import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from './config';

/** Error HTTP con formato RFC 7807. */
export class HttpProblem extends Error {
  constructor(
    public status: number,
    public codigo: string,
    public titulo: string,
    detalle: string,
    public errores?: Record<string, string[]>,
  ) {
    super(detalle);
  }
}
export const problem = (
  status: number,
  codigo: string,
  titulo: string,
  detalle: string,
  errores?: Record<string, string[]>,
) => new HttpProblem(status, codigo, titulo, detalle, errores);

/** Traduce errores de PostgreSQL a mensajes seguros: nunca se reenvía el texto crudo del motor al navegador. */
function mapBusiness(msg: string): HttpProblem {
  if (/Saldo insuficiente/i.test(msg))
    return problem(
      409,
      'SALDO_INSUFICIENTE',
      'Saldo insuficiente',
      'La cuenta de origen no tiene fondos suficientes para esta operación.',
    );
  if (/inmutabilidad/i.test(msg))
    return problem(
      409,
      'REGISTRO_INMUTABLE',
      'Registro inmutable',
      'Ese registro contable no puede modificarse.',
    );
  if (/no está activa|inactiva|Solo se pueden activar|Solo se pueden reactivar/i.test(msg))
    return problem(
      409,
      'CUENTA_NO_OPERABLE',
      'Cuenta no disponible',
      'La cuenta no está en un estado que permita esta operación.',
    );
  if (/no puede recibir|bloqueada o cerrada/i.test(msg))
    return problem(
      409,
      'CUENTA_DESTINO_NO_DISPONIBLE',
      'Cuenta de destino no disponible',
      'La cuenta de destino está bloqueada o cerrada.',
    );
  if (/no se encuentra en estado bloqueado/i.test(msg))
    return problem(
      409,
      'CUENTA_NO_BLOQUEADA',
      'La cuenta no está bloqueada',
      'Solo se pueden desbloquear cuentas bloqueadas.',
    );
  if (/No se puede cerrar/i.test(msg))
    return problem(
      409,
      'CUENTA_CON_SALDO',
      'No se puede cerrar la cuenta',
      'La cuenta debe tener saldo y canje en cero para cerrarse.',
    );
  if (/no pueden ser iguales/i.test(msg))
    return problem(
      422,
      'CUENTAS_IGUALES',
      'Cuentas iguales',
      'La cuenta de origen y la de destino deben ser distintas.',
    );
  return problem(
    422,
    'REGLA_DE_NEGOCIO',
    'Operación rechazada',
    'La operación no cumple una regla del banco.',
  );
}

export function toProblem(e: unknown): HttpProblem {
  if (e instanceof HttpProblem) return e;
  const err = e as { code?: string; message?: string; type?: string };
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')
    return problem(400, 'CUERPO_INVALIDO', 'Solicitud inválida', 'El cuerpo de la solicitud no es válido.');
  switch (err.code) {
    case 'P0001':
      return mapBusiness(err.message ?? '');
    case '23514':
      return problem(
        422,
        'RESTRICCION_VIOLADA',
        'Operación no permitida',
        'La operación viola una regla de integridad.',
      );
    case '23505':
      return problem(409, 'DUPLICADO', 'Registro duplicado', 'Ese registro ya existe.');
    case '57014':
      return problem(
        504,
        'CONSULTA_LENTA',
        'La consulta tardó demasiado',
        'Intenta con un filtro más específico.',
      );
    case '42501':
      return problem(
        403,
        'SIN_PERMISO_EN_BD',
        'Permiso insuficiente',
        'El rol de base de datos no permite esta operación.',
      );
    case '42P01':
    case '42883':
      return problem(
        501,
        'FUNCIONALIDAD_NO_INSTALADA',
        'Funcionalidad no instalada',
        'Falta aplicar sql/010_bff_soporte.sql en la base de datos.',
      );
    case 'ECONNREFUSED':
    case '57P01':
    case '08006':
    case '08001':
      return problem(
        503,
        'BASE_DE_DATOS_NO_DISPONIBLE',
        'Servicio no disponible',
        'No fue posible conectar con la base de datos.',
      );
  }
  return problem(
    500,
    'ERROR_INTERNO',
    'Error interno',
    'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
  );
}

export const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function errorHandler(e: unknown, req: Request, res: Response, _next: NextFunction): void {
  const p = toProblem(e);
  if (p.status >= 500) {
    const err = e as { code?: string; message?: string };
    console.error(
      '[bff]',
      req.method,
      req.path,
      err.code ?? '',
      config.production ? '' : (err.message ?? ''),
    );
  }
  res
    .status(p.status)
    .type('application/problem+json')
    .json({
      estado: p.status,
      titulo: p.titulo,
      detalle: p.message,
      codigo_error: p.codigo,
      instancia: req.path,
      ...(p.errores ? { errores: p.errores } : {}),
      type: 'about:blank',
      title: p.titulo,
      status: p.status,
      detail: p.message,
    });
}

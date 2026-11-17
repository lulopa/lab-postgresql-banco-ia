/** COMPARTIDO. Tipos base de la API. */
export type UUID = string;
export type IsoDateTime = string;
export type CodigoMoneda = string; // ISO 4217 ('COP', 'USD', ...)

/** RFC 7807 (Problem Details) con las claves en español del documento §5.4. */
export interface ProblemDetails {
  estado: number;
  titulo: string;
  detalle: string;
  codigo_error: string;
  tipo?: string;
  instancia?: string;
  errores?: Record<string, string[]>;
}

export interface Paginado<T> {
  items: T[];
  pagina: number;
  tamano: number;
  total: number;
  total_paginas: number;
}

export interface PaginacionParams {
  pagina?: number;
  tamano?: number;
}

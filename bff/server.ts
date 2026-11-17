import express from 'express';
import { authRouter, requireRole } from './auth';
import { config } from './config';
import { devIdpRouter } from './devIdp';
import { pool } from './db';
import { errorHandler, h, problem } from './problem';
import { auditoriaRouter } from './routes/auditoria';
import { clienteRouter, transaccionesRouter } from './routes/cliente';
import { mountStatic } from './static';
import { operativaRouter } from './routes/operativa';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // detrás de un túnel local: req.ip = IP real del cliente (límite de intentos)
app.use((_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Defensa CSRF adicional a SameSite=Strict: toda escritura debe llevar la cabecera que el frontend siempre envía.
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'XMLHttpRequest')
    return next(problem(403, 'CSRF', 'Solicitud rechazada', 'Falta la cabecera X-Requested-With.'));
  next();
});

app.get(
  '/api/v1/health',
  h(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  }),
);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/cliente', requireRole('CLIENTE'), clienteRouter);
app.use('/api/v1/transacciones', requireRole('CLIENTE'), transaccionesRouter);
app.use('/api/v1/auditoria', requireRole('AUDITOR'), auditoriaRouter);
app.use('/api/v1/operativa', requireRole('OPERATIVO'), operativaRouter);
if (config.devLogin) app.use('/dev-idp', devIdpRouter);

if (config.serveStatic) mountStatic(app);

app.use((_req, _res, next) =>
  next(problem(404, 'NO_ENCONTRADO', 'No encontrado', 'El recurso solicitado no existe.')),
);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`BFF Banco Andino escuchando en http://localhost:${config.port}`);
  if (config.devLogin && !config.devLoginKey)
    console.log('⚠  Sin DEV_LOGIN_KEY: NO expongas esta app por un túnel público.');
  if (config.devLogin)
    console.log(
      '⚠  DEV_LOGIN activo: acceso de desarrollo SIN contraseña en /dev-idp (no usar en producción).',
    );
  else console.log('DEV_LOGIN desactivado: configura el IdP real en VITE_OIDC_AUTHORIZE_URL.');
});

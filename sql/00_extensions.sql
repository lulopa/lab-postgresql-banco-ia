CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; 
 
COMMENT ON EXTENSION "uuid-ossp" IS 'Generación de UUIDs v4 para idempotency keys y referencias externas'; 
COMMENT ON EXTENSION "pgcrypto" IS 'Funciones criptográficas y hashing de seguridad';
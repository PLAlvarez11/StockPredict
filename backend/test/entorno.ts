export const URL_BASE_PRUEBAS =
  'postgresql://stockpredict:stockpredict@localhost:5432/stockpredict_test?schema=public';

export const ENTORNO_PRUEBAS = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'secreto-de-pruebas-con-mas-de-treinta-y-dos-caracteres',
  BCRYPT_COST: '4',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: URL_BASE_PRUEBAS,
};

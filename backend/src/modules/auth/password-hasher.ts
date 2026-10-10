import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';

export interface PasswordHasher {
  hash(contrasena: string): Promise<string>;
  verify(contrasena: string, hash: string): Promise<boolean>;
}

export const bcryptHasher: PasswordHasher = {
  hash: (contrasena) => bcrypt.hash(contrasena, env.BCRYPT_COST),
  verify: (contrasena, hash) => bcrypt.compare(contrasena, hash),
};

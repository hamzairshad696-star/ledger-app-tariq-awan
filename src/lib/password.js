import bcrypt from 'bcryptjs';
export const hashPassword = (pw) => bcrypt.hash(pw, 12);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

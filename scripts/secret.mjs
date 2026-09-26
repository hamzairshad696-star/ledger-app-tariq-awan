// Prints a random AUTH_SECRET value:  npm run secret
import { randomBytes } from 'node:crypto';
console.log(randomBytes(48).toString('base64url'));

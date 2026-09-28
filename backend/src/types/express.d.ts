import { TokenPayload } from '../utils/auth';

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

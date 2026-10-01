import type { AuthUser } from "../middleware/authMiddleware.ts";

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export { };

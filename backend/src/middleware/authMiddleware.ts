import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    phoneNumber?: string | null;
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
}

function getAuthCookie(cookieHeader: string | undefined): string | undefined {
    const authCookie = cookieHeader
        ?.split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("auth_token="));

    return authCookie?.slice("auth_token=".length);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authorization = req.headers.authorization;
    const bearerToken = authorization?.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length)
        : undefined;
    const token = bearerToken || getAuthCookie(req.headers.cookie);

    if (!token) {
        res.status(401).json({ error: "Authorization token is required" });
        return;
    }

    try {
        const payload = jwt.verify(token, getJwtSecret());
        if (!isAuthPayload(payload)) {
            res.status(401).json({ error: "Invalid token payload" });
            return;
        }

        req.user = {
            id: payload.id,
            username: payload.username,
            email: payload.email,
            phoneNumber: typeof payload.phoneNumber === "string" ? payload.phoneNumber : null
        };
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}

function isAuthPayload(payload: string | JwtPayload): payload is JwtPayload & AuthUser {
    return typeof payload !== "string"
        && typeof payload.id === "number"
        && typeof payload.username === "string"
        && typeof payload.email === "string";
}
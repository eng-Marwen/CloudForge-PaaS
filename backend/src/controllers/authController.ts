import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import prisma from "../db/database.js";

const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || "1h") as SignOptions["expiresIn"];

type PublicUser = { id: number; username: string; email: string; phoneNumber?: string | null };

function createToken(user: PublicUser): { token: string; expiresAt: string } {
    if (!jwtSecret) {
        throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign(user, jwtSecret, { expiresIn: jwtExpiresIn });
    const payload = jwt.decode(token) as jwt.JwtPayload;

    return {
        token,
        expiresAt: new Date((payload.exp ?? 0) * 1000).toISOString()
    };
}

function setAuthCookie(res: Response, token: string): void {
    res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });
}

export function logout(_req: Request, res: Response): void {
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });
    res.json({ message: "Logged out" });
}

export async function register(req: Request, res: Response): Promise<void> {
    const { username, email, password, confirmPassword, phoneNumber } = req.body as {
        username?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        phoneNumber?: string;
    };

    if (!username || !email || !password || password.length < 8 || !confirmPassword) {
        res.status(400).json({ error: "Username, email, password of at least 8 characters, and confirmPassword are required" });
        return;
    }

    if (password !== confirmPassword) {
        res.status(400).json({ error: "Passwords do not match" });
        return;
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { username: username.trim(), email: email.toLowerCase(), passwordHash, ...(phoneNumber?.trim() ? { phoneNumber: phoneNumber.trim() } : {}) },
            select: { id: true, username: true, email: true, phoneNumber: true }
        });

        const auth = createToken(user);
        setAuthCookie(res, auth.token);
        res.status(201).json({ user, expiresAt: auth.expiresAt });
    } catch (error: unknown) {
        if ((error as { code?: string }).code === "P2002") {
            res.status(409).json({ error: "Email is already registered" });
            return;
        }
        res.status(500).json({ error: "Unable to register user" });
    }
}

export async function login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

        if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        const publicUser = { id: user.id, username: user.username, email: user.email, phoneNumber: user.phoneNumber };
        const auth = createToken(publicUser);
        setAuthCookie(res, auth.token);
        res.json({ user: publicUser, expiresAt: auth.expiresAt });
    } catch {
        res.status(500).json({ error: "Unable to login user" });
    }
}

export function getCurrentUser(req: Request, res: Response): void {
    res.json({ user: req.user });
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
    await prisma.user.delete({ where: { id: req.user!.id } });
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });
    res.json({ message: "Account deleted" });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
    const { username, phoneNumber } = req.body as { username?: string; phoneNumber?: string | null };
    const data: { username?: string; phoneNumber?: string | null } = {};

    if (username !== undefined) {
        if (!username.trim()) {
            res.status(400).json({ error: "Username cannot be empty" });
            return;
        }
        data.username = username.trim();
    }
    if (phoneNumber !== undefined) {
        if (phoneNumber !== null && typeof phoneNumber !== "string") {
            res.status(400).json({ error: "Phone number must be a string" });
            return;
        }
        data.phoneNumber = phoneNumber?.trim() || null;
    }
    if (Object.keys(data).length === 0) {
        res.status(400).json({ error: "Username or phone number is required" });
        return;
    }

    const user = await prisma.user.update({
        where: { id: req.user!.id },
        data,
        select: { id: true, username: true, email: true, phoneNumber: true }
    });
    const auth = createToken(user);
    setAuthCookie(res, auth.token);
    res.json({ user, expiresAt: auth.expiresAt });
}
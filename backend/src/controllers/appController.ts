import type { Request, Response } from "express";
import prisma from "../db/database.js";

function getAppId(value: string | string[]): number | undefined {
	if (Array.isArray(value)) {
		return undefined;
	}

	const id = Number(value);
	return Number.isInteger(id) && id > 0 ? id : undefined;
}

function getUserId(req: Request): number {
	return req.user!.id;
}

// GET /api/apps                    # all apps
// GET /api/apps?isDeployed=true   # deployed apps
// GET /api/apps?isDeployed=false  # undeployed apps

export async function listApps(req: Request, res: Response): Promise<void> {
	const deployedQuery = req.query.isDeployed;
	let isDeployed: boolean | undefined;

	if (deployedQuery !== undefined) {
		if (typeof deployedQuery !== "string" || !["true", "false"].includes(deployedQuery)) {
			res.status(400).json({ error: "isDeployed must be true or false" });
			return;
		}
		isDeployed = deployedQuery === "true";
	}

	const apps = await prisma.application.findMany({
		where: {
			userId: getUserId(req),
			...(isDeployed === undefined ? {} : { isDeployed })
		},
		orderBy: { createdAt: "desc" }
	});

	res.json({ apps });
}

export async function createApp(req: Request, res: Response): Promise<void> {
	const { name, repository, branch, isDeployed } = req.body as {
		name?: string;
		repository?: string;
		branch?: string;
		isDeployed?: boolean;
	};

	if (!name?.trim() || !repository?.trim()) {
		res.status(400).json({ error: "Name and repository are required" });
		return;
	}
	if (isDeployed !== undefined && typeof isDeployed !== "boolean") {
		res.status(400).json({ error: "isDeployed must be a boolean" });
		return;
	}

	const app = await prisma.application.create({
		data: {
			userId: getUserId(req),
			name: name.trim(),
			repository: repository.trim(),
			...(branch?.trim() ? { branch: branch.trim() } : {}),
			...(isDeployed !== undefined ? { isDeployed } : {})
		}
	});

	res.status(201).json({ app });
}

export async function getApp(req: Request, res: Response): Promise<void> {
	const id = getAppId(req.params.id);
	if (!id) {
		res.status(400).json({ error: "Invalid application id" });
		return;
	}

	const app = await prisma.application.findFirst({
		where: { id, userId: getUserId(req) }
	});

	if (!app) {
		res.status(404).json({ error: "Application not found" });
		return;
	}

	res.json({ app });
}

export async function updateApp(req: Request, res: Response): Promise<void> {
	const id = getAppId(req.params.id);
	if (!id) {
		res.status(400).json({ error: "Invalid application id" });
		return;
	}

	const { name, repository, branch, isDeployed } = req.body as {
		name?: string;
		repository?: string;
		branch?: string;
		isDeployed?: boolean;
	};
	const data: { name?: string; repository?: string; branch?: string; isDeployed?: boolean } = {};

	if (name !== undefined) {
		if (!name.trim()) {
			res.status(400).json({ error: "Name cannot be empty" });
			return;
		}
		data.name = name.trim();
	}
	if (repository !== undefined) {
		if (!repository.trim()) {
			res.status(400).json({ error: "Repository cannot be empty" });
			return;
		}
		data.repository = repository.trim();
	}
	if (branch !== undefined) {
		if (!branch.trim()) {
			res.status(400).json({ error: "Branch cannot be empty" });
			return;
		}
		data.branch = branch.trim();
	}
	if (isDeployed !== undefined) {
		if (typeof isDeployed !== "boolean") {
			res.status(400).json({ error: "isDeployed must be a boolean" });
			return;
		}
		data.isDeployed = isDeployed;
	}

	if (Object.keys(data).length === 0) {
		res.status(400).json({ error: "At least one field is required" });
		return;
	}

	const result = await prisma.application.updateMany({
		where: { id, userId: getUserId(req) },
		data
	});

	if (result.count === 0) {
		res.status(404).json({ error: "Application not found" });
		return;
	}

	const app = await prisma.application.findUnique({ where: { id } });
	res.json({ app });
}

export async function deleteApp(req: Request, res: Response): Promise<void> {
	const id = getAppId(req.params.id);
	if (!id) {
		res.status(400).json({ error: "Invalid application id" });
		return;
	}

	const result = await prisma.application.deleteMany({
		where: { id, userId: getUserId(req) }
	});

	if (result.count === 0) {
		res.status(404).json({ error: "Application not found" });
		return;
	}

	res.status(204).send();
}

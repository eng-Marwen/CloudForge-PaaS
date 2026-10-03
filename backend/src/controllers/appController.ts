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

type EnvironmentVariableInput = { key?: string; value?: string };
const deploymentStatuses = ["deploying", "running", "failed"] as const;
type DeploymentStatus = typeof deploymentStatuses[number];

function parseEnvironmentVariables(value: unknown): { key: string; value: string }[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) return undefined;

	const variables = value.map((item) => item as EnvironmentVariableInput);
	if (variables.some(({ key, value: variableValue }) => !key?.trim() || typeof variableValue !== "string")) {
		return undefined;
	}

	const normalized = variables.map(({ key, value: variableValue }) => ({ key: key!.trim(), value: variableValue! }));
	return new Set(normalized.map(({ key }) => key)).size === normalized.length ? normalized : undefined;
}

const appInclude = { environmentVariables: true } as const;

// GET /api/apps                    # all apps
// GET /api/apps?isDeployed=true   # deployed apps
// GET /api/apps?isDeployed=false  # undeployed apps

export async function listApps(req: Request, res: Response): Promise<void> {
	const deployedQuery = req.query.isDeployed;
	const statusQuery = req.query.status;
	let isDeployed: boolean | undefined;
	let status: DeploymentStatus | undefined;

	if (deployedQuery !== undefined) {
		if (typeof deployedQuery !== "string" || !["true", "false"].includes(deployedQuery)) {
			res.status(400).json({ error: "isDeployed must be true or false" });
			return;
		}
		isDeployed = deployedQuery === "true";
	}
	if (statusQuery !== undefined) {
		if (typeof statusQuery !== "string" || !deploymentStatuses.includes(statusQuery as DeploymentStatus)) {
			res.status(400).json({ error: "status must be deploying, running, or failed" });
			return;
		}
		status = statusQuery as DeploymentStatus;
	}

	const apps = await prisma.application.findMany({
		where: {
			userId: getUserId(req),
			...(isDeployed === undefined ? {} : { isDeployed }),
			...(status === undefined ? {} : { status })
		},
		orderBy: { createdAt: "desc" },
		include: appInclude
	});

	res.json({ apps });
}

export async function createApp(req: Request, res: Response): Promise<void> {
	const { name, repository, branch, isDeployed, status } = req.body as {
		name?: string;
		repository?: string;
		branch?: string;
		isDeployed?: boolean;
		status?: string;
		environmentVariables?: unknown;
	};
	const environmentVariables = parseEnvironmentVariables((req.body as { environmentVariables?: unknown }).environmentVariables);

	if (!name?.trim() || !repository?.trim()) {
		res.status(400).json({ error: "Name and repository are required" });
		return;
	}
	if (name.trim().length > 20) {
		res.status(400).json({ error: "Application name cannot exceed 20 characters" });
		return;
	}
	if (isDeployed !== undefined && typeof isDeployed !== "boolean") {
		res.status(400).json({ error: "isDeployed must be a boolean" });
		return;
	}
	if (status !== undefined && !deploymentStatuses.includes(status as DeploymentStatus)) {
		res.status(400).json({ error: "status must be deploying, running, or failed" });
		return;
	}
	if ((req.body as { environmentVariables?: unknown }).environmentVariables !== undefined && environmentVariables === undefined) {
		res.status(400).json({ error: "Environment variables must have unique non-empty keys and string values" });
		return;
	}

	const app = await prisma.application.create({
		data: {
			userId: getUserId(req),
			name: name.trim(),
			repository: repository.trim(),
			...(branch?.trim() ? { branch: branch.trim() } : {}),
			...(isDeployed !== undefined ? { isDeployed } : {}),
			...(status !== undefined ? { status } : {}),
			environmentVariables: environmentVariables ? { create: environmentVariables } : undefined
		},
		include: appInclude
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
		where: { id, userId: getUserId(req) },
		include: appInclude
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

	const { name, repository, branch, isDeployed, status, environmentVariables: rawEnvironmentVariables } = req.body as {
		name?: string;
		repository?: string;
		branch?: string;
		isDeployed?: boolean;
		status?: string;
		environmentVariables?: unknown;
	};
	const environmentVariables = parseEnvironmentVariables(rawEnvironmentVariables);
	const data: { name?: string; repository?: string; branch?: string; isDeployed?: boolean; status?: string } = {};

	if (name !== undefined) {
		if (!name.trim()) {
			res.status(400).json({ error: "Name cannot be empty" });
			return;
		}
		if (name.trim().length > 20) {
			res.status(400).json({ error: "Application name cannot exceed 20 characters" });
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
		if (status === undefined) data.status = isDeployed ? "running" : "failed";
	}
	if (status !== undefined) {
		if (!deploymentStatuses.includes(status as DeploymentStatus)) {
			res.status(400).json({ error: "status must be deploying, running, or failed" });
			return;
		}
		data.status = status;
	}
	if (rawEnvironmentVariables !== undefined && environmentVariables === undefined) {
		res.status(400).json({ error: "Environment variables must have unique non-empty keys and string values" });
		return;
	}

	if (Object.keys(data).length === 0) {
		res.status(400).json({ error: "At least one field is required" });
		return;
	}

	const existing = await prisma.application.findFirst({ where: { id, userId: getUserId(req) } });
	if (!existing) {
		res.status(404).json({ error: "Application not found" });
		return;
	}

	const app = await prisma.$transaction(async (transaction) => {
		if (environmentVariables !== undefined) {
			await transaction.applicationEnvironmentVariable.deleteMany({ where: { applicationId: id } });
		}
		return transaction.application.update({
			where: { id },
			data: {
				...data,
				environmentVariables: environmentVariables !== undefined ? { create: environmentVariables } : undefined
			},
			include: appInclude
		});
	});
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

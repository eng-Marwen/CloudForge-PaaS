import type { Request, Response } from "express";
import prisma from "../db/database.js";
import { publishDeleteEvent, publishDeployEvent } from "../queue/producer.js"
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { subscribeToDeployment } from "../events/deploymentEvents.js";

const execFileAsync = promisify(execFile);

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
			status: status ?? "deploying",
			environmentVariables: environmentVariables ? { create: environmentVariables } : undefined
		},
		include: appInclude
	});
	console.log("app createddddd")
	await publishDeployEvent(app);
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

export async function getAppLogs(req: Request, res: Response): Promise<void> {
	res.setHeader("Cache-Control", "no-store");
	const id = getAppId(req.params.id);
	if (!id) {
		res.status(400).json({ error: "Invalid application id" });
		return;
	}

	const app = await prisma.application.findFirst({
		where: { id, userId: getUserId(req) },
		select: { id: true, isDeployed: true }
	});
	if (!app) {
		res.status(404).json({ error: "Application not found" });
		return;
	}
	if (!app.isDeployed) {
		res.status(409).json({ error: "Logs are available after the application is deployed" });
		return;
	}

	const namespace = process.env.K8S_NAMESPACE || "cloudforge";
	const context = process.env.K8S_CONTEXT;
	const args = [
		...(context ? ["--context", context] : []),
		"logs",
		"deployment/app-" + app.id,
		"--namespace",
		namespace,
		"--all-containers",
		"--tail=200",
		"--prefix",
	];

	try {
		const { stdout, stderr } = await execFileAsync("kubectl", args, {
			timeout: 15_000,
			maxBuffer: 512 * 1024,
		});
		res.json({ logs: [stdout, stderr].filter(Boolean).join("\n") });
	} catch (error: unknown) {
		const details = error as { stdout?: string; stderr?: string; message?: string };
		console.error("[Kubernetes] Failed to read application logs:", error);
		res.status(502).json({
			error: details.stderr?.trim() || details.stdout?.trim() || details.message || "Unable to read application logs",
		});
	}
}

export async function streamAppEvents(req: Request, res: Response): Promise<void> {
	const id = getAppId(req.params.id);
	if (!id) {
		res.status(400).json({ error: "Invalid application id" });
		return;
	}

	const app = await prisma.application.findFirst({
		where: { id, userId: getUserId(req) },
		select: { id: true },
	});
	if (!app) {
		res.status(404).json({ error: "Application not found" });
		return;
	}

	res.status(200);
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.flushHeaders();
	res.write(": connected\n\n");

	const unsubscribe = subscribeToDeployment(id, res);
	const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
	req.on("close", () => {
		clearInterval(heartbeat);
		unsubscribe();
	});
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
		if (status === "deploying") data.isDeployed = false;
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
				...(data.status === "deploying"
					? {
						deploymentStage: null,
						deploymentMessage: null,
						deploymentImage: null,
						deploymentError: null,
						deploymentUrl: null
					}
					: {}),
				environmentVariables: environmentVariables !== undefined ? { create: environmentVariables } : undefined
			},
			include: appInclude
		});
	});

	if (data.status === "deploying") {
		await publishDeployEvent(app);
	} else if (data.status === "failed" && data.isDeployed === false) {
		await publishDeleteEvent(id);
	}
	res.json({ app });
}

export async function deleteApp(req: Request, res: Response): Promise<void> {
	const id = getAppId(req.params.id);
	if (!id) {
		res.status(400).json({ error: "Invalid application id" });
		return;
	}

	const existing = await prisma.application.findFirst({
		where: { id, userId: getUserId(req) },
		select: { id: true },
	});

	if (!existing) {
		res.status(404).json({ error: "Application not found" });
		return;
	}

	await publishDeleteEvent(id);
	await prisma.application.delete({ where: { id } });
	res.status(204).send();
}

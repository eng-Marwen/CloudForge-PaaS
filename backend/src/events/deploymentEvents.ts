import type { Response } from "express";

const subscribers = new Map<number, Set<Response>>();

export function subscribeToDeployment(applicationId: number, response: Response): () => void {
    const listeners = subscribers.get(applicationId) ?? new Set<Response>();
    listeners.add(response);
    subscribers.set(applicationId, listeners);

    return () => {
        listeners.delete(response);
        if (listeners.size === 0) subscribers.delete(applicationId);
    };
}

export function publishDeploymentUpdate(applicationId: number, app: unknown): void {
    const listeners = subscribers.get(applicationId);
    if (!listeners) return;

    const payload = `event: deployment\ndata: ${JSON.stringify(app)}\n\n`;
    for (const response of listeners) {
        response.write(payload);
    }
}

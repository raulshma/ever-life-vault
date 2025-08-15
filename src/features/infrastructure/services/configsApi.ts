import type { DockerComposeConfig } from "../types";
import { fetchWithAuth } from "@/lib/aggregatorClient";
import { generateDockerComposeYaml } from "../utils/dockerUtils";

const API_BASE = "/api/infrastructure";

export interface CreateConfigPayload {
	name: string;
	description?: string;
	compose_content: string;
	metadata: DockerComposeConfig["metadata"];
}

export interface UpdateConfigPayload {
	name?: string;
	description?: string;
	compose_content?: string;
	metadata?: DockerComposeConfig["metadata"];
}

export class ConfigsApiService {
	async list(): Promise<DockerComposeConfig[]> {
		const res = await fetchWithAuth(`${API_BASE}/configs`);
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "Failed to fetch configurations" }));
			throw new Error(err.error || "Failed to fetch configurations");
		}
		const data = await res.json();
		return (data?.configurations ?? []) as DockerComposeConfig[];
	}

	async create(payload: CreateConfigPayload): Promise<DockerComposeConfig> {
		const res = await fetchWithAuth(`${API_BASE}/configs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "Failed to create configuration" }));
			throw new Error(err.error || "Failed to create configuration");
		}
		const data = await res.json();
		return data?.configuration as DockerComposeConfig;
	}

	async update(id: string, payload: UpdateConfigPayload): Promise<DockerComposeConfig> {
		const res = await fetchWithAuth(`${API_BASE}/configs/${encodeURIComponent(id)}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "Failed to update configuration" }));
			throw new Error(err.error || "Failed to update configuration");
		}
		const data = await res.json();
		return data?.configuration as DockerComposeConfig;
	}

	async remove(id: string): Promise<void> {
		const res = await fetchWithAuth(`${API_BASE}/configs/${encodeURIComponent(id)}`, {
			method: "DELETE",
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "Failed to delete configuration" }));
			throw new Error(err.error || "Failed to delete configuration");
		}
	}

	// Helper to build payload from editor config
	buildCreatePayload(config: Partial<DockerComposeConfig>): CreateConfigPayload {
		const compose_content = generateDockerComposeYaml(config);
		if (!compose_content) {
			throw new Error("Compose content is empty or invalid");
		}
		if (!config.name || !config.metadata) {
			throw new Error("Missing required fields: name/metadata");
		}
		return {
			name: config.name,
			description: config.description,
			compose_content,
			metadata: config.metadata,
		};
	}
}

export const configsApi = new ConfigsApiService();



export type AppRecord = {
  id: number;
  name: string;
  repository: string;
  branch: string;
  isDeployed: boolean;
  status: DeploymentStatus;
  createdAt: string;
  updatedAt?: string;
  environmentVariables: EnvironmentVariable[];
};

export type DeploymentStatus = "deploying" | "running" | "failed";

export type EnvironmentVariable = {
  id?: number;
  key: string;
  value: string;
};

export type User = {
  id: number;
  username: string;
  email: string;
  phoneNumber?: string | null;
};

export type ApplicationForm = {
  name: string;
  repository: string;
  branch: string;
  environmentVariables: EnvironmentVariable[];
};

export type ApplicationUpdate = Partial<ApplicationForm> & {
  isDeployed?: boolean;
  status?: DeploymentStatus;
};

export type Page =
  "dashboard" | "applications" | "new" | "settings" | "details";

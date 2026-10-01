export type AppRecord = {
  id: number;
  name: string;
  repository: string;
  branch: string;
  isDeployed: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type ApplicationForm = {
  name: string;
  repository: string;
  branch: string;
};

export type Page =
  "dashboard" | "applications" | "new" | "settings" | "details";

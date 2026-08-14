import { request } from './client';

export type Project = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  allowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
};

export function list(): Promise<Project[]> {
  return request<Project[]>('/tenant/projects');
}

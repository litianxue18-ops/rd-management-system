import type { WorkflowDefinition } from './types';
import { BusinessError } from '@/shared/errors';

const REGISTRY = new Map<string, WorkflowDefinition<any>>();

export function registerWorkflow<E>(def: WorkflowDefinition<E>) {
  if (REGISTRY.has(def.code)) throw new Error(`workflow already registered: ${def.code}`);
  REGISTRY.set(def.code, def);
}

export function getWorkflow(code: string): WorkflowDefinition<any> {
  const def = REGISTRY.get(code);
  if (!def) throw new BusinessError(`未知 workflow: ${code}`, 'WORKFLOW_NOT_FOUND');
  return def;
}

/** 仅测试用: 清空注册表. */
export function _resetRegistry() { REGISTRY.clear(); }

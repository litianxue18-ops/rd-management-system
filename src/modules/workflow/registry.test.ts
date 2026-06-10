import { describe, it, expect, beforeEach } from 'vitest';
import { registerWorkflow, getWorkflow, _resetRegistry } from './registry';

beforeEach(() => _resetRegistry());

describe('workflow registry', () => {
  it('register + get', () => {
    registerWorkflow({
      code: 'test_v1',
      entityType: 'test',
      steps: [{ name: 'step1', role: 'rd_director' }],
      loadEntity: async () => ({}),
    });
    const def = getWorkflow('test_v1');
    expect(def.entityType).toBe('test');
    expect(def.steps).toHaveLength(1);
  });

  it('重复注册抛错', () => {
    registerWorkflow({ code: 't', entityType: 'x', steps: [], loadEntity: async () => null });
    expect(() => registerWorkflow({ code: 't', entityType: 'y', steps: [], loadEntity: async () => null }))
      .toThrow(/already registered/);
  });

  it('未注册 get 抛 BusinessError', () => {
    expect(() => getWorkflow('nope')).toThrow(/未知 workflow/);
  });
});

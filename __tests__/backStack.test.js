import { backStack } from '../src/utils/backStack';

// Drain any residue so tests are order-independent.
afterEach(() => { while (backStack.pop()) { /* clear */ } });

describe('backStack', () => {
  it('pop() returns false when empty', () => {
    expect(backStack.pop()).toBe(false);
  });

  it('push() registers a closer; pop() runs it and returns true', () => {
    const close = jest.fn();
    backStack.push(close);
    expect(backStack.size).toBe(1);
    expect(backStack.pop()).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(backStack.size).toBe(0);
  });

  it('closes the most-recently pushed layer first (LIFO)', () => {
    const order = [];
    backStack.push(() => order.push('A'));
    backStack.push(() => order.push('B'));
    backStack.pop();
    backStack.pop();
    expect(order).toEqual(['B', 'A']);
  });

  it('the returned unregister removes the entry without closing it', () => {
    const close = jest.fn();
    const off = backStack.push(close);
    off();
    expect(backStack.size).toBe(0);
    expect(backStack.pop()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it('a throwing closer does not wedge the stack', () => {
    backStack.push(() => { throw new Error('boom'); });
    expect(() => backStack.pop()).not.toThrow();
    expect(backStack.size).toBe(0);
  });
});
/**
 * The generated test client had two divergent copies: a maintained one behind
 * the individual download, and an older, truncated one behind the ZIP download
 * — which is the path most users take. The ZIP copy spawned `python`, never
 * called a tool, and reported nothing.
 *
 * These assertions describe the contract both call sites now share.
 */

import { describe, it, expect } from 'vitest';
import { generateTestClient } from '../testClientGenerator';

describe('generateTestClient', () => {
  const client = generateTestClient('petstore_v2');

  it('interpolates the server name', () => {
    expect(client).toContain('petstore_v2');
    // A missing `$` left `{serverName}` as a live f-string reference to an
    // undefined Python name, so the script died on its first line.
    expect(client).not.toContain('{serverName}');
  });

  it('spawns the interpreter running the client, not bare "python"', () => {
    // Debian and Ubuntu ship only `python3`; `python` is not on PATH. Using
    // sys.executable also keeps the server in the client's virtualenv.
    expect(client).toContain('command=sys.executable');
    expect(client).not.toContain('command="python"');
    expect(client).toMatch(/^import sys$/m);
  });

  it('actually calls the tools it discovers', () => {
    // The ZIP copy only listed tools, so it could never surface a failure.
    expect(client).toContain('session.call_tool(');
    expect(client).toContain('session.list_tools()');
  });

  it('reports a tool that returned an error as a failure', () => {
    // call_tool completes normally when a tool errors, so catching exceptions
    // is not enough - isError has to be checked or every run looks green.
    expect(client).toContain('isError');
    expect(client).toMatch(/tool returned an error/i);
  });

  it('is valid Python as far as indentation and structure go', () => {
    const lines = client.split('\n');

    // No line may be indented more than one level deeper than the line it
    // follows unless that line opens a block.
    const offenders = lines.filter((line, i) => {
      const next = lines[i + 1];
      if (!next || !line.trim() || !next.trim()) return false;
      const cur = line.length - line.trimStart().length;
      const nxt = next.length - next.trimStart().length;
      return !line.trimEnd().endsWith(':') && nxt > cur + 4;
    });

    expect(offenders).toEqual([]);
    expect(client.startsWith('#!/usr/bin/env python3')).toBe(true);
    expect(client).toContain('if __name__ == "__main__":');
  });

  describe('failure diagnostics', () => {
    // Reported from a real run: the only output was
    // "💥 Error running tests: unhandled errors in a TaskGroup (1 sub-exception)".
    // anyio wraps the true failure - usually the server subprocess dying on an
    // import - in an ExceptionGroup, so printing the exception alone tells the
    // user nothing they can act on.
    it('unwraps the ExceptionGroup instead of printing only its summary', () => {
      expect(client).toContain('getattr(e, "exceptions", None)');
      expect(client).toMatch(/Underlying cause/i);
    });

    it('prints a full traceback', () => {
      expect(client).toMatch(/^import traceback$/m);
      expect(client).toContain('traceback.print_exc()');
    });

    it('reports which interpreter will run the server', () => {
      // Running the client from a different virtualenv than the server's
      // dependencies is the most common cause, and is invisible otherwise.
      expect(client).toContain('sys.executable');
      expect(client).toMatch(/Interpreter/);
    });

    it('says the server must not be started separately', () => {
      // An stdio server is launched by its client; users kept running
      // server.py in another terminal and assuming the client attaches to it.
      expect(client).toMatch(/do not run it separately/i);
    });

    it('fails clearly when server.py is absent', () => {
      expect(client).toContain("os.path.exists(\"server.py\")");
      expect(client).toMatch(/^import os$/m);
    });
  });

  it('varies only by server name', () => {
    const a = generateTestClient('alpha');
    const b = generateTestClient('beta');

    expect(a).not.toBe(b);
    expect(a.replace(/alpha/g, 'X')).toBe(b.replace(/beta/g, 'X'));
  });
});

/**
 * The export must be a real ZIP archive.
 *
 * Reported from a local run: "the download zip didn't work, it returned a text
 * file." Nothing asserted that the exported bytes were an archive at all - the
 * suite only ever checked that a Blob came back, which a plain text file
 * satisfies just as well. A ZIP starts with the local file header magic
 * `PK\x03\x04`; that is the cheapest possible proof it is not text.
 */

import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { ExportService } from '../exportService';
import type { GeneratedProject } from '../mcpCodeGenerator';

const project: GeneratedProject = {
  files: [
    { path: 'server.py', content: 'print("hello")\n', description: 'server' },
    { path: 'requirements.txt', content: 'mcp>=1.0.0\n', description: 'deps' },
    { path: 'scripts/run-stdio.py', content: '# run\n', description: 'script' },
  ],
  structure: ['server.py', 'requirements.txt', 'scripts/run-stdio.py'],
  dependencies: ['mcp>=1.0.0'],
  envVars: [],
  instructions: '',
} as unknown as GeneratedProject;

/** jsdom's Blob has no arrayBuffer(), so read it the long way. */
const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe('ExportService.exportProject', () => {
  it('returns bytes that start with the ZIP magic number', async () => {
    const result = await ExportService.exportProject(project, 'test-server');
    const head = (await blobBytes(result.blob)).subarray(0, 4);

    expect(Array.from(head)).toEqual([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04
  });

  it('declares a zip content type and a .zip filename', async () => {
    const result = await ExportService.exportProject(project, 'test-server');

    expect(result.blob.type).toBe('application/zip');
    expect(result.filename).toMatch(/\.zip$/);
  });

  it('honours a caller-supplied filename and packages extra files', async () => {
    // Both are what the results screen depends on: the documented
    // `<serverName>_mcp_server.zip` name, and test_client.py, which is
    // generated outside GeneratedProject.
    const result = await ExportService.exportProject(project, 'test-server', {
      filename: 'test-server_mcp_server.zip',
      extraFiles: [
        { path: 'test_client.py', content: '# client\n', description: 'client' },
      ],
    });

    expect(result.filename).toBe('test-server_mcp_server.zip');
    expect(result.fileCount).toBe(4); // 3 project files + the client

    const archive = await JSZip.loadAsync(await blobBytes(result.blob));
    expect(Object.keys(archive.files)).toContain('test_client.py');
  });

  it('writes no metadata.json into the archive', async () => {
    // It was never in the project tree FEATURES.md documents, and the dialog
    // that consumed it is gone.
    const result = await ExportService.exportProject(project, 'test-server');
    const archive = await JSZip.loadAsync(await blobBytes(result.blob));

    expect(Object.keys(archive.files)).not.toContain('metadata.json');
    expect(result.fileCount).toBe(3);
  });

  it('round-trips: the archive re-reads with the paths intact', async () => {
    const result = await ExportService.exportProject(project, 'test-server');
    const reread = await JSZip.loadAsync(await blobBytes(result.blob));

    expect(Object.keys(reread.files)).toEqual(
      expect.arrayContaining(['server.py', 'requirements.txt', 'scripts/run-stdio.py'])
    );
    expect(await reread.file('server.py')!.async('string')).toBe('print("hello")\n');
  });
});

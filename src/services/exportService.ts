import JSZip from 'jszip';
import type { GeneratedProject, GeneratedFile } from './mcpCodeGenerator';

export interface ExportOptions {
  /**
   * Overrides the default date-stamped name. The results screen passes
   * `<serverName>_mcp_server.zip`, which is the name FEATURES.md documents.
   */
  filename: string;
  /**
   * Packaged alongside the generated project. `test_client.py` is not part of
   * `GeneratedProject` - it comes from `testClientGenerator` - but it ships in
   * the archive, so it has to enter here rather than by a second zip pass.
   */
  extraFiles: GeneratedFile[];
  includeDocumentation: boolean;
  compressionLevel: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  size: number;
  fileCount: number;
}

export class ExportService {
  /**
   * Export generated project as downloadable archive
   */
  static async exportProject(
    project: GeneratedProject,
    serverName: string,
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const opts: Omit<ExportOptions, 'filename' | 'extraFiles'> &
      Partial<Pick<ExportOptions, 'filename' | 'extraFiles'>> = {
      includeDocumentation: true,
      compressionLevel: 6,
      ...options,
    };

    const zip = new JSZip();
    const timestamp = new Date();
    const sanitizedName = serverName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const filename =
      opts.filename ??
      `${sanitizedName}-mcp-server-${timestamp.toISOString().split('T')[0]}.zip`;

    // Add all generated files
    let fileCount = 0;
    project.files.forEach(file => {
      // Skip files based on options
      if (!opts.includeDocumentation && (file.path.endsWith('.md') || file.path.includes('README'))) {
        return;
      }

      zip.file(file.path, file.content);
      fileCount += 1;
    });

    // Anything shipped alongside the project itself - the test client.
    (opts.extraFiles ?? []).forEach(file => {
      zip.file(file.path, file.content);
      fileCount += 1;
    });

    // No metadata.json. It used to be written here for the export dialog,
    // which no longer exists; it was never part of the project tree that
    // FEATURES.md documents, and an unexplained file in a generated Python
    // project is worse than no file.

    // Generate archive
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: opts.compressionLevel,
      },
    });

    const result: ExportResult = {
      blob,
      filename,
      size: blob.size,
      fileCount,
    };

    return result;
  }

  /**
   * Download the exported project
   */
  static downloadProject(result: ExportResult): void {
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Validate export before processing
   */
  static validateExport(project: GeneratedProject): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!project.files || project.files.length === 0) {
      errors.push('No files to export');
    }

    const serverFile = project.files.find(f => f.path === 'server.py');
    if (!serverFile) {
      errors.push('Missing server.py file');
    }

    const requirementsFile = project.files.find(f => f.path === 'requirements.txt');
    if (!requirementsFile) {
      errors.push('Missing requirements.txt file');
    }

    // Check for empty files
    const emptyFiles = project.files.filter(f => !f.content || f.content.trim().length === 0);
    if (emptyFiles.length > 0) {
      errors.push(`Empty files detected: ${emptyFiles.map(f => f.path).join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
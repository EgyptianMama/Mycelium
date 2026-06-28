export class GithubFetcher {
  private IGNORED_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot',
    '.mp4', '.mp3', '.webm',
    '.zip', '.tar', '.gz', '.pdf'
  ]);
  
  private IGNORED_DIRECTORIES = new Set([
    'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.vscode'
  ]);

  /**
   * Parses a github URL into owner and repo name.
   */
  parseUrl(url: string) {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (urlObj.hostname !== 'github.com' || parts.length < 2) {
        throw new Error('Invalid GitHub URL');
      }
      return { owner: parts[0], repo: parts[1] };
    } catch {
      throw new Error('Could not parse GitHub URL. Ensure it looks like https://github.com/owner/repo');
    }
  }

  /**
   * Fetches the default branch of a repository.
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        throw new Error('GitHub API rate limit exceeded. You may need to provide a Personal Access Token.');
      }
      throw new Error(`Failed to fetch repo info: ${res.statusText}`);
    }
    const data = await res.json();
    return data.default_branch || 'main';
  }

  /**
   * Fetches the entire file tree for a branch, returning only the relevant code files.
   */
  async fetchTree(owner: string, repo: string, branch: string) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    if (!res.ok) throw new Error('Failed to fetch repository tree');
    
    const data = await res.json();
    
    // Filter out directories and ignored files
    return data.tree.filter((item: any) => {
      if (item.type !== 'blob') return false;
      
      const pathParts = item.path.split('/');
      const filename = pathParts[pathParts.length - 1];
      
      // Check for ignored directories
      if (pathParts.some(part => this.IGNORED_DIRECTORIES.has(part))) return false;
      
      // Check for ignored extensions
      const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
      if (this.IGNORED_EXTENSIONS.has(ext)) return false;
      
      return true;
    });
  }

  /**
   * Fetches the raw content of a specific file from githubusercontent.
   */
  async fetchFileContent(owner: string, repo: string, branch: string, path: string): Promise<string> {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Failed to fetch file: ${path}`);
    return await res.text();
  }

  /**
   * Fetches all files concurrently or sequentially.
   */
  async fetchFiles(owner: string, repo: string, filesToFetch: any[], branch: string) {
    const files = [];
    for (const file of filesToFetch) {
       try {
         const content = await this.fetchFileContent(owner, repo, branch, file.path);
         files.push({ path: file.path, content });
       } catch (err) {
         console.warn(`Failed to fetch ${file.path}`, err);
       }
    }
    return files;
  }
}

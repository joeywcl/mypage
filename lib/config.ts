// Base path for GitHub Pages deployment
export const basePath = ''; // Deploying at root

// Helper function to get the correct asset path
export function getAssetPath(path: string): string {
  return `${basePath}${path}`;
}


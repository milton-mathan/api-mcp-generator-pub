import React, { useState } from 'react';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  CodeBracketIcon,
  InformationCircleIcon,
  FolderIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import type { GeneratedProject } from '../services/mcpCodeGenerator';
import { generateTestClient } from '../services/testClientGenerator';

interface MCPResultsProps {
  project: GeneratedProject;
  serverName: string;
  onDownloadAll: () => void;
}

export const MCPResults: React.FC<MCPResultsProps> = ({
  project,
  serverName,
  onDownloadAll,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'instructions' | 'client'>('instructions');

  const downloadFile = (file: { path: string; content: string }) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const generateClientCode = () => generateTestClient(serverName);

  const generateDetailedInstructions = () => {
    const isWindows = navigator.platform.toLowerCase().includes('win');
    const pythonCmd = isWindows ? 'python' : 'python3';
    const pipCmd = isWindows ? 'pip' : 'pip3';
    
    return `# 🚀 ${serverName} - Complete Setup Guide

## 📋 What You Have Generated

Your MCP server package includes:
${project.files.map(f => `- **${f.path}**: ${f.description}`).join('\n')}

## 🛠️ Step-by-Step Setup Instructions

### 1️⃣ Download and Extract Files

1. Click "Download ZIP Package" button above
2. Extract the downloaded ZIP file to a folder on your computer
3. Open a terminal/command prompt in that folder

### 2️⃣ Set Up a Python Environment

Check your Python version — you need ${project.dependencies.includes('python>=3.11') ? '3.11+' : '3.8+'}:

\`\`\`bash
${pythonCmd} --version
\`\`\`

Create and activate a virtual environment. Do not skip this: many current Linux
distributions reject a global \`${pipCmd} install\` with
\`error: externally-managed-environment\`, and an isolated environment keeps this
server's packages separate from the rest of your system.

\`\`\`bash
# Create it
${pythonCmd} -m venv .venv

# Activate it
${isWindows ? '.venv\\\\Scripts\\\\Activate.ps1   # PowerShell\n.venv\\\\Scripts\\\\activate.bat   # cmd' : 'source .venv/bin/activate'}
\`\`\`

Your prompt should now show \`(.venv)\`. Every command below assumes it is
active — re-activate it in each new shell, and run \`deactivate\` when done.

Now install the dependencies:

\`\`\`bash
${pipCmd} install -r requirements.txt
\`\`\`

Make a note of this environment's interpreter — MCP clients need its absolute
path, because they launch the server with their own environment, not your shell's:

\`\`\`bash
${pythonCmd} -c "import sys; print(sys.executable)"
\`\`\`

### 3️⃣ Configure Environment

1. Copy the example environment file:
   \`\`\`bash
   ${isWindows ? 'copy .env.example .env' : 'cp .env.example .env'}
   \`\`\`

2. Edit the .env file with your API credentials:
   \`\`\`
${project.envVars.map(env => `   ${env}=your_actual_value_here`).join('\n')}
   \`\`\`

### 4️⃣ Test Your MCP Server

#### Option A: Basic Test (Stdio Mode)
\`\`\`bash
${pythonCmd} server.py
\`\`\`

#### Option B: HTTP Mode
**Note**: HTTP mode is currently not implemented in the generated MCP servers. 
MCP servers are designed to work via stdio (standard input/output) with MCP clients like Claude Desktop.

For HTTP API access, you would need to implement additional HTTP endpoints using a web framework like FastAPI or Flask.

#### Option C: Use the Test Client
1. Download the test client from the "Test Client" tab
2. Save it as \`test_client.py\` in the same folder
3. Run: \`${pythonCmd} test_client.py\`

### 5️⃣ Use with an MCP Client (optional)

The server speaks standard MCP over stdio, so it works with any MCP client —
Claude Desktop, Cline, or your own. Claude Desktop is shown here as an example.

1. Open the config file:
   - **macOS**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
   - **Windows**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`

   (Claude Desktop can open it for you: Settings → Developer → Edit Config.)

2. Add your server:
   \`\`\`json
   {
     "mcpServers": {
       "${serverName}": {
         "command": "${isWindows ? 'C:\\\\path\\\\to\\\\your\\\\server\\\\.venv\\\\Scripts\\\\python.exe' : '/absolute/path/to/your/server/.venv/bin/python'}",
         "args": ["${isWindows ? 'C:\\\\path\\\\to\\\\your\\\\server\\\\server.py' : '/absolute/path/to/your/server/server.py'}"],
         "env": {
${project.envVars.map(env => `           "${env.split('=')[0]}": "your_value"`).join(',\n')}
         }
       }
     }
   }
   \`\`\`

   **Use absolute paths for both.** The client starts the server with its own
   environment, not your shell's — a bare \`${pythonCmd}\` resolves to the system
   interpreter, which will not have the dependencies you installed in a virtual
   environment. Point \`command\` at that environment's interpreter.

3. Restart the client
4. Your server's tools will be available in conversations

### 6️⃣ Docker Deployment (Optional)

If you want to run in Docker:

\`\`\`bash
# Build the image
docker build -t ${serverName} .

# Run the container
docker run -p 8000:8000 --env-file .env ${serverName}
\`\`\`

${project.dockerCompose ? `Or use Docker Compose:
\`\`\`bash
docker-compose up
\`\`\`` : ''}

## 🔍 Troubleshooting

### Common Issues:

1. **"Module not found" error**
   - Run: \`${pipCmd} install -r requirements.txt\`

2. **Authentication errors**
   - Check your .env file has correct API keys
   - Verify API endpoints are accessible

3. **Permission errors**
   - Make sure Python files are executable
   - On Unix: \`chmod +x server.py\`

4. **Port already in use**
   - Change the port in server.py or kill existing processes

### Getting Help:

1. Check the server logs for detailed error messages
2. Test individual API endpoints manually
3. Verify your API credentials are correct
4. Ensure all dependencies are installed

## 📚 Next Steps

1. **Customize**: Edit server.py to add custom logic
2. **Test**: Use the provided test client to verify functionality  
3. **Deploy**: Consider hosting on cloud platforms
4. **Monitor**: Add logging and monitoring as needed

## 🎉 Congratulations!

Your MCP server is ready to use! You can now:
- Access your API through Claude Desktop
- Integrate with other MCP-compatible tools
- Customize and extend the functionality

Need help? Check the MCP documentation at: https://modelcontextprotocol.io
`;
  };

  const tabs = [
    { id: 'instructions', name: 'Setup Instructions', icon: InformationCircleIcon },
    { id: 'files', name: 'Generated Files', icon: FolderIcon },
    { id: 'client', name: 'Test Client', icon: PlayIcon },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <DocumentTextIcon className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-medium text-gray-900">MCP Server Generated Successfully!</h3>
        </div>
        <button
          onClick={onDownloadAll}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Download ZIP Package
        </button>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{project.files.length}</div>
            <div className="text-sm text-gray-500">Files Generated</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{project.dependencies.length}</div>
            <div className="text-sm text-gray-500">Dependencies</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{project.envVars.length}</div>
            <div className="text-sm text-gray-500">Environment Variables</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'instructions' && (
          <div className="prose max-w-none">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Quick Start</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Follow these step-by-step instructions to get your MCP server up and running.
                    Everything is included - just download, configure, and run!
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-6 text-gray-100 text-sm overflow-auto">
              <pre className="whitespace-pre-wrap font-mono">
                {generateDetailedInstructions()}
              </pre>
            </div>
            
            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => copyToClipboard(generateDetailedInstructions())}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <CodeBracketIcon className="h-4 w-4 mr-1" />
                Copy Instructions
              </button>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Project Structure</h4>
                <div className="space-y-1 text-sm font-mono">
                  {project.structure.map((item, index) => (
                    <div key={index} className="text-gray-700">{item}</div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Dependencies</h4>
                <div className="space-y-1 text-sm">
                  {project.dependencies.map((dep, index) => (
                    <div key={index} className="text-gray-700 font-mono">{dep}</div>
                  ))}
                </div>
              </div>
            </div>

            {project.files.map((file, index) => (
              <div key={index} className="border border-gray-200 rounded-lg">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FolderIcon className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{file.path}</span>
                    <span className="text-sm text-gray-500">({file.description})</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(file.content)}
                      className="px-2 py-1 text-xs bg-white text-gray-600 rounded border hover:bg-gray-50"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => downloadFile(file)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Download
                    </button>
                  </div>
                </div>
                <div className="bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                  <pre className="text-sm font-mono">
                    <code>{file.content}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'client' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <PlayIcon className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">MCP Test Client</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Use this test client to verify your MCP server is working correctly. 
                    It will connect to your server and test all available tools.
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CommandLineIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">test_client.py</span>
                  <span className="text-sm text-gray-500">(MCP Test Client)</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyToClipboard(generateClientCode())}
                    className="px-2 py-1 text-xs bg-white text-gray-600 rounded border hover:bg-gray-50"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => downloadFile({ path: 'test_client.py', content: generateClientCode() })}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Download
                  </button>
                </div>
              </div>
              <div className="bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                <pre className="text-sm font-mono">
                  <code>{generateClientCode()}</code>
                </pre>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">How to Use the Test Client</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Download the test client file above</li>
                <li>Save it as <code className="bg-blue-100 px-1 rounded">test_client.py</code> in your server directory</li>
                <li>Install the MCP client: <code className="bg-blue-100 px-1 rounded">pip install mcp</code></li>
                <li>Run the test: <code className="bg-blue-100 px-1 rounded">python test_client.py</code></li>
                <li>Check the output for tool availability and test results</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
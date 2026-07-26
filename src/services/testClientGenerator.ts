/**
 * Generates the `test_client.py` script offered alongside a generated MCP
 * server.
 *
 * Single source of truth. Two divergent copies of this template previously
 * existed - one in MCPResults (individual download) and an older, truncated one
 * in MCPGenerator (ZIP download). The ZIP copy shipped `command="python"`,
 * which fails on distributions that provide only `python3`, reported success
 * for tools that had returned errors, and never actually called any tool.
 */

export function generateTestClient(serverName: string): string {
  return `#!/usr/bin/env python3
"""
MCP Client Test Script for ${serverName}
This script demonstrates how to test your generated MCP server.
"""

import asyncio
import json
import os
import sys
import traceback
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def test_mcp_server():
    """Test the MCP server by calling its tools."""

    # NOTE: this script starts its own copy of server.py as a subprocess and
    # talks to it over stdin/stdout. You do NOT need to run server.py yourself
    # in another terminal - an stdio MCP server is not a service you connect
    # to, it is launched by its client.
    server_params = StdioServerParameters(
        # sys.executable, not "python": many Linux distributions ship only
        # "python3", and this also keeps the server in the same virtualenv
        # as this client.
        command=sys.executable,
        args=["server.py"],
        env=None
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the client
            await session.initialize()
            
            # List available tools
            print("\\n🔧 Available Tools:")
            print("=" * 50)
            tools = await session.list_tools()
            for tool in tools.tools:
                print(f"📋 {tool.name}")
                print(f"   Description: {tool.description}")
                if tool.inputSchema:
                    print(f"   Parameters: {list(tool.inputSchema.get('properties', {}).keys())}")
                print()
            
            # Test each tool (you can modify this section)
            print("\\n🧪 Testing Tools:")
            print("=" * 50)
            
            for tool in tools.tools:
                try:
                    print(f"Testing {tool.name}...")
                    
                    # Create sample arguments based on the tool schema
                    args = {}
                    if tool.inputSchema and 'properties' in tool.inputSchema:
                        for param_name, param_info in tool.inputSchema['properties'].items():
                            if param_info.get('type') == 'string':
                                args[param_name] = "sample_value"
                            elif param_info.get('type') == 'integer':
                                args[param_name] = 123
                            elif param_info.get('type') == 'boolean':
                                args[param_name] = True
                    
                    # Call the tool
                    result = await session.call_tool(tool.name, args)

                    # A tool that returns an error still completes the call, so
                    # isError must be checked - an exception alone is not enough.
                    body = result.content[0].text if result.content else 'No content'
                    if getattr(result, 'isError', False):
                        print(f"⚠️  {tool.name}: tool returned an error")
                        print(f"   {body}")
                    else:
                        print(f"✅ {tool.name}: Success")
                        print(f"   Result: {body}")

                except Exception as e:
                    print(f"❌ {tool.name}: Error - {str(e)}")
                
                print()

if __name__ == "__main__":
    print(f"🚀 Testing MCP Server: ${serverName}")
    print("=" * 60)
    # Printed up front because the single most common failure is running this
    # script from a different virtualenv than the one server.py's dependencies
    # were installed into. server.py is launched with THIS interpreter.
    print(f"Interpreter: {sys.executable}")
    print(f"Directory:   {os.getcwd()}")
    print("This script launches server.py itself - do not run it separately.")
    print()

    if not os.path.exists("server.py"):
        print("❌ server.py not found in this directory.")
        print("   Run this script from the folder containing server.py.")
        sys.exit(1)

    try:
        asyncio.run(test_mcp_server())
    except KeyboardInterrupt:
        print("\\n⏹️ Test stopped by user")
    except Exception as e:
        print(f"\\n💥 Error running tests: {e}")

        # anyio wraps the real failure in an ExceptionGroup, so the line above
        # is only ever "unhandled errors in a TaskGroup (N sub-exceptions)".
        # Without unwrapping it the actual cause - almost always the server
        # subprocess dying on an import error - is invisible.
        causes = getattr(e, "exceptions", None)
        if causes:
            print("\\nUnderlying cause(s):")
            for cause in causes:
                print(f"  - {type(cause).__name__}: {cause}")

        print("\\nFull traceback:")
        traceback.print_exc()

        print("\\nTroubleshooting tips:")
        print(f"1. Install dependencies into THIS interpreter ({sys.executable}):")
        print("   pip install -r requirements.txt")
        print("   Verify with: python -c \\"import mcp, httpx; print('ok')\\"")
        print("2. Check that server.py starts on its own: python server.py")
        print("   It should print a startup line to stderr and then wait.")
        print("3. Check that your .env file has the correct API credentials")
        print("4. Make sure the API endpoint is accessible")
`;
}

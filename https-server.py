#!/usr/bin/env python3
"""
Simple HTTPS server for local development.
Generates a self-signed certificate for localhost.
"""
import http.server
import ssl
import os
import sys
import subprocess

PORT = 8443
CERT_FILE = "cert.pem"
KEY_FILE = "key.pem"

print("🔐 Setting up HTTPS server for local development...")
print()

# Check if certificate exists, create if not
if not os.path.exists(CERT_FILE) or not os.path.exists(KEY_FILE):
    print("📜 Generating self-signed certificate...")
    try:
        # Use openssl to generate self-signed certificate
        result = subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:4096",
            "-keyout", KEY_FILE, "-out", CERT_FILE,
            "-days", "365", "-nodes",
            "-subj", "/CN=localhost"
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Certificate created: {CERT_FILE}")
            print(f"✅ Key created: {KEY_FILE}")
        else:
            raise Exception(result.stderr)
    except FileNotFoundError:
        print("❌ OpenSSL not found. Installing via chocolatey or downloading...")
        print()
        print("Please install OpenSSL:")
        print("  Option 1: choco install openssl")
        print("  Option 2: Download from https://slproweb.com/products/Win32OpenSSL.html")
        print()
        print("Or use Chrome with these settings:")
        print("  1. Go to: chrome://flags/#unsafely-treat-insecure-origin-as-secure")
        print("  2. Add: http://localhost:8000")
        print("  3. Relaunch Chrome")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error creating certificate: {e}")
        sys.exit(1)

print()
print(f"🚀 Starting HTTPS server on https://localhost:{PORT}/")
print(f"📹 Camera access enabled at: https://localhost:{PORT}/")
print()
print("⚠️  Your browser will show a security warning - this is normal!")
print("   Click 'Advanced' → 'Proceed to localhost (unsafe)' to continue")
print()
print("Press Ctrl+C to stop the server")
print()

# Create HTTPS server
handler = http.server.SimpleHTTPRequestHandler

try:
    httpd = http.server.HTTPServer(('', PORT), handler)
    
    # Wrap with SSL
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.check_hostname = False
    context.load_cert_chain(CERT_FILE, KEY_FILE)
    
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    
    print(f"✅ Server is ready!\n")
    httpd.serve_forever()
    
except Exception as e:
    print(f"❌ Error starting server: {e}")
    sys.exit(1)
except KeyboardInterrupt:
    print("\n\n👋 Server stopped")
    sys.exit(0)

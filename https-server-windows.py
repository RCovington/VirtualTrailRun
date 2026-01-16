#!/usr/bin/env python3
"""
HTTPS server using PowerShell-generated certificate for Windows
"""
import http.server
import ssl
import os
import sys
import subprocess
import tempfile

PORT = 8443
CERT_FILE = "cert.pem"
KEY_FILE = "key.pem"

print("🔐 Setting up HTTPS server for local development...")
print()

# Check if certificate exists
if not os.path.exists(CERT_FILE):
    print("📜 Generating self-signed certificate using PowerShell...")
    try:
        # PowerShell script to create and export certificate
        ps_script = """
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\\CurrentUser\\My" -NotAfter (Get-Date).AddYears(1) -KeyExportPolicy Exportable
$thumbprint = $cert.Thumbprint
$pwd = ConvertTo-SecureString -String "temp123" -Force -AsPlainText
$pfxPath = "temp_cert.pfx"
Export-PfxCertificate -Cert "Cert:\\CurrentUser\\My\\$thumbprint" -FilePath $pfxPath -Password $pwd | Out-Null
Write-Output $thumbprint
"""
        
        result = subprocess.run(
            ["powershell", "-Command", ps_script],
            capture_output=True,
            text=True,
            check=True
        )
        
        thumbprint = result.stdout.strip()
        print(f"✅ Certificate created with thumbprint: {thumbprint}")
        print(f"📁 Certificate stored in Windows Certificate Store")
        print()
        
        # For Python's SSL to work, we need PEM format
        # Let's export the certificate to a format Python can use
        export_script = f"""
$cert = Get-ChildItem -Path "Cert:\\CurrentUser\\My\\{thumbprint}"
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[System.IO.File]::WriteAllBytes("{CERT_FILE}", $certBytes)
"""
        subprocess.run(["powershell", "-Command", export_script], check=True)
        
        # Create a combined PEM file that Python can use
        # We'll need to work around the private key export limitation
        print("⚠️  Note: For full HTTPS functionality, certificate is in Windows store")
        print("   Browser will need to be configured to accept it")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
        print("Alternative: Use Chrome with HTTP camera access")
        print("  1. Go to: chrome://flags/#unsafely-treat-insecure-origin-as-secure")
        print("  2. Enable the flag")
        print("  3. Add: http://localhost:8000")
        print("  4. Relaunch Chrome")
        print()
        print("Starting HTTP server on port 8000 instead...")
        os.system("python -m http.server 8000")
        sys.exit(0)

print("⚠️  Due to Windows certificate export limitations, using Chrome flag method is recommended:")
print()
print("  📋 Steps to enable camera on HTTP:")
print("  1. Open Chrome and go to: chrome://flags/#unsafely-treat-insecure-origin-as-secure")
print("  2. Enable the flag")  
print("  3. Add to the list: http://localhost:8000")
print("  4. Click 'Relaunch' button")
print()
print("Starting HTTP server on port 8000...")
print()

subprocess.run(["python", "-m", "http.server", "8000"])

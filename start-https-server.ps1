# Generate self-signed certificate and start HTTPS server for local development

$certName = "localhost"
$certPath = ".\cert.pem"
$keyPath = ".\key.pem"
$port = 8443

Write-Host "🔐 Setting up HTTPS server for local development..." -ForegroundColor Cyan

# Check if certificate already exists
if (Test-Path $certPath) {
    Write-Host "✅ Certificate already exists" -ForegroundColor Green
} else {
    Write-Host "📜 Generating self-signed certificate..." -ForegroundColor Yellow
    
    # Try using OpenSSL if available
    try {
        $opensslExists = Get-Command openssl -ErrorAction Stop
        
        # Generate certificate and key
        openssl req -x509 -newkey rsa:4096 -keyout $keyPath -out $certPath -days 365 -nodes -subj "/CN=$certName"
        
        Write-Host "✅ Certificate created successfully with OpenSSL" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  OpenSSL not found, using PowerShell method..." -ForegroundColor Yellow
        
        # Create certificate using PowerShell
        $cert = New-SelfSignedCertificate -DnsName $certName -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1) -KeyExportPolicy Exportable
        
        # Export certificate
        $pwd = ConvertTo-SecureString -String "temppassword" -Force -AsPlainText
        $pfxPath = ".\cert.pfx"
        Export-PfxCertificate -Cert "Cert:\CurrentUser\My\$($cert.Thumbprint)" -FilePath $pfxPath -Password $pwd | Out-Null
        
        # Convert to PEM format using certutil or manual export
        Write-Host "📋 Certificate created. Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan
        Write-Host "⚠️  You may need to manually trust this certificate in your browser" -ForegroundColor Yellow
        Write-Host "   Certificate is in Windows Certificate Store: CurrentUser\My" -ForegroundColor Gray
        
        # Try to export to PEM if openssl becomes available
        if (Test-Path $pfxPath) {
            Write-Host "   PFX exported to: $pfxPath (password: temppassword)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "🚀 Starting HTTPS server on https://localhost:$port" -ForegroundColor Green
Write-Host "📹 You can now access the camera at https://localhost:$port" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Browser will show a security warning - this is normal for self-signed certificates" -ForegroundColor Yellow
Write-Host "   Click 'Advanced' and 'Proceed to localhost' to continue" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

# Check if we have the certificate files
if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
    # Start Python HTTPS server with certificate
    python -c @"
import http.server, ssl

server_address = ('', $port)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('$certPath', '$keyPath')

httpd.socket = ssl.wrap_socket(httpd.socket, server_side=True, certfile='$certPath', keyfile='$keyPath', ssl_version=ssl.PROTOCOL_TLS)

print('Server running on https://localhost:$port')
httpd.serve_forever()
"@
} else {
    Write-Host "❌ Certificate files not found. Starting HTTP server instead on port 8000..." -ForegroundColor Red
    Write-Host "   Note: Camera may not work without HTTPS" -ForegroundColor Yellow
    python -m http.server 8000
}

# WSL2 Localhost Forwarding Failure — Reference

## Complete Diagnostic Procedure

Run these checks rapidly when a user reports localhost connectivity issues between WSL and Windows.

### Step 1: Identify the Windows Host

```bash
WINDOWS_IP=$(ip route show default | awk '{print $3}')
WSL_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
echo "Windows host IP: $WINDOWS_IP"
echo "WSL VM IP:      $WSL_IP"
```

### Step 2: Test Each Direction

```bash
echo "=== Direction 1: Windows -> WSL via localhost ==="
# From Windows PowerShell:
#   curl http://127.0.0.1:8899/ --timeout 3

echo "=== Direction 2: WSL -> Windows via localhost ==="
# Test with a known-running Windows service (e.g. MariaDB on :3306)
timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/3306' 2>/dev/null && \
  echo "OK" || echo "BROKEN"

echo "=== Direction 3: WSL -> Windows via host IP ==="
timeout 3 bash -c "echo > /dev/tcp/$WINDOWS_IP/3306" 2>/dev/null && \
  echo "OK" || echo "BROKEN (service might be down)"
```

### Result Interpretation

| Pattern | Diagnosis |
|---------|-----------|
| Dir2 BROKEN, Dir3 OK | Localhost forwarding from WSL to Windows is broken |
| Dir2 OK | No localhost forwarding issue |
| Dir3 BROKEN | Windows service itself is down (different problem) |

## Immediate Workaround (No Restart)

When localhost forwarding from WSL to Windows is broken but a restart is not possible (services running), update each service's config to use the Windows host IP directly.

### Morgana Backend DB

Two equivalent approaches:

**A) Update default.json:**

```bash
WINDOWS_IP=$(ip route show default | awk '{print $3}')
python3 << 'EOF'
import json, subprocess, os
# Get the Windows host IP
ip = subprocess.run(['ip','route','show','default'], capture_output=True, text=True).stdout.split()[2]
path = '<PROJECT_ROOT>/backend/config/default.json'
# Read, modify, write via /tmp/ (WSL write cache trap)
cfg = json.load(open(path))
cfg['db']['host'] = ip
with open('/tmp/default.json', 'w') as f:
    json.dump(cfg, f, indent=2)
# cp + sync for reliable write
subprocess.run(['cp', '/tmp/default.json', path])
subprocess.run(['sync'])
# Verify
with open(path) as f:
    content = f.read()
if ip in content:
    print(f'Verified: db.host -> {ip}')
else:
    print('ERROR: write did not persist')
EOF
```

**B) Update env.conf (higher priority):**

```bash
WINDOWS_IP=$(ip route show default | awk '{print $3}')
python3 << 'EOF'
import subprocess, os
ip = subprocess.run(['ip','route','show','default'], capture_output=True, text=True).stdout.split()[2]
path = '<PROJECT_ROOT>/startup/env.conf'
# Create or update DB_HOST line
if os.path.exists(path):
    with open(path) as f:
        lines = f.readlines()
    lines = [l for l in lines if not l.startswith('DB_HOST=')]
    lines.append(f'DB_HOST={ip}\n')
    with open('/tmp/env.conf', 'w') as f:
        f.writelines(lines)
    subprocess.run(['cp', '/tmp/env.conf', path])
    subprocess.run(['sync'])
    print(f'Updated env.conf: DB_HOST={ip}')
else:
    with open('/tmp/env.conf', 'w') as f:
        f.write(f'DB_HOST={ip}\n')
    subprocess.run(['cp', '/tmp/env.conf', path])
    subprocess.run(['sync'])
    print(f'Created env.conf: DB_HOST={ip}')
EOF
```

### Python Port Forwarder (Generic Workaround)

When you need multiple ports forwarded or cannot modify service configs, run a Python TCP proxy:

```python
#!/usr/bin/env python3
"""
WSL-to-Windows localhost forwarder.
Usage: python3 wsl_forward.py [--ports 3306,3000,5432]
"""
import socket, threading, sys, os, signal, subprocess

# Discover Windows host IP
WINDOWS_IP = subprocess.run(
    ['ip','route','show','default'], capture_output=True, text=True
).stdout.split()[2]

# Default ports: MariaDB(3306), MySQL(3306)
DEFAULT_PORTS = [3306]

def forward(src, dst):
    while True:
        try:
            data = src.recv(4096)
            if not data:
                break
            dst.sendall(data)
        except:
            break
    src.close()
    dst.close()

def handle_client(client_sock, target_port):
    try:
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.connect((WINDOWS_IP, target_port))
        threading.Thread(target=forward, args=(client_sock, server_sock), daemon=True).start()
        threading.Thread(target=forward, args=(server_sock, client_sock), daemon=True).start()
    except Exception as e:
        print(f"  [port {target_port}] Connection failed: {e}")

def start_proxy(local_port, target_port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', local_port))
    server.listen(5)
    print(f"  Forwarding 127.0.0.1:{local_port} -> {WINDOWS_IP}:{target_port}")
    while True:
        client, addr = server.accept()
        threading.Thread(target=handle_client, args=(client, target_port), daemon=True).start()

if __name__ == '__main__':
    ports = DEFAULT_PORTS
    if '--ports' in sys.argv:
        idx = sys.argv.index('--ports')
        ports = [int(p) for p in sys.argv[idx+1].split(',')]

    print(f"Starting WSL localhost forwarder (Windows IP: {WINDOWS_IP})")
    threads = []
    for port in ports:
        t = threading.Thread(target=start_proxy, args=(port, port), daemon=True)
        t.start()
        threads.append(t)

    print("Press Ctrl+C to stop")
    signal.pause()
```

Save it as `~/.hermes/scripts/wsl_forward.py` and run:
```bash
python3 ~/.hermes/scripts/wsl_forward.py --ports 3306
```

## Permanent Fix (.wslconfig)

### Standard Configuration

```ini
; C:\Users\<username>\.wslconfig
[wsl2]
localhostForwarding=true

[experimental]
autoMemoryReclaim=gradual
networkingMode=mirrored
```

### Creating from WSL

```bash
cat > /tmp/.wslconfig << 'EOF'
[wsl2]
localhostForwarding=true
[experimental]
autoMemoryReclaim=gradual
networkingMode=mirrored
EOF

# Detect Windows username (may differ from WSL username)
WIN_USER=$(ls /mnt/c/Users/ | grep -vE 'All Users|Default|Public|desktop.ini' | head -1)
cp /tmp/.wslconfig "/mnt/c/Users/$WIN_USER/.wslconfig"
sync

# Verify
cat "/mnt/c/Users/$WIN_USER/.wslconfig"
```

### Activating

```powershell
# From Windows PowerShell (Admin):
wsl.exe --shutdown
# Then restart WSL by launching wsl.exe or any WSL terminal
```

This kills ALL WSL processes (Gateway, Morgana, etc.) — schedule downtime accordingly.

## Restore Script Integration

Add this to `~/restore-hermes.sh` to detect and report localhost forwarding status on startup:

```bash
echo "[Check] WSL localhost forwarding..."
WINDOWS_IP=$(ip route show default | awk '{print $3}')
timeout 2 bash -c "echo > /dev/tcp/$WINDOWS_IP/3306" 2>/dev/null
WINDOWS_DB_REACHABLE=$?
timeout 2 bash -c 'echo > /dev/tcp/127.0.0.1/3306' 2>/dev/null
LOCALHOST_REACHABLE=$?
if [ $LOCALHOST_REACHABLE -eq 0 ] && [ $WINDOWS_DB_REACHABLE -eq 0 ]; then
    echo "  ✓ localhost forwarding OK"
elif [ $LOCALHOST_REACHABLE -ne 0 ] && [ $WINDOWS_DB_REACHABLE -eq 0 ]; then
    echo "  ⚠ WSL→Windows localhost forwarding BROKEN (host IP works)"
    echo "    → Fix: update .wslconfig with networkingMode=mirrored"
else
    echo "  ✗ Cannot reach MariaDB (service may not be running)"
fi
```

## Testing After Fix

```bash
# WSL to Windows via localhost
timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/3306' 2>/dev/null && \
  echo "localhost:3306 OK" || echo "localhost:3306 FAILED"

# WSL to Windows via host IP
WINDOWS_IP=$(ip route show default | awk '{print $3}')
timeout 3 bash -c "echo > /dev/tcp/$WINDOWS_IP/3306" 2>/dev/null && \
  echo "host IP:3306 OK" || echo "host IP:3306 FAILED"

# Windows to WSL (from Windows PowerShell)
# curl http://127.0.0.1:8899/
# Should return Gateway response (404 is OK — means it reached the server)
```

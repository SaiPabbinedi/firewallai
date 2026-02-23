✅ Full deployment automation is ready! Here's what was created:

Scripts Created
File	Purpose
scripts/Deploy-All.ps1	Master PowerShell script — SCPs all files to Ubuntu + Kali
scripts/Deploy-Menu.bat	Double-click menu for easy deployment
scripts/ubuntu/start_all.sh	Starts all 7 services in dependency order on Ubuntu
scripts/ubuntu/stop_all.sh	Stops all services in reverse order on Ubuntu
Before First Use — One-time Kali SSH setup:
powershell
# Copy your SSH key to Kali (type 'kali' when prompted)
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh kali@192.168.1.103 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
Daily Usage — 3 options:
powershell
# Option 1: Double-click menu
.\scripts\Deploy-Menu.bat
# Option 2: Deploy everything + start services
.\scripts\Deploy-All.ps1 -StartServices
# Option 3: Deploy + start + launch Kali attacks (full demo)
.\scripts\Deploy-All.ps1 -StartServices -LaunchAttack
Then on Windows:
powershell
npm run dev   # Starts React frontend at http://localhost:5173
⚠️ Important: Before first deploy, make sure to edit ~/cyber-defense/backend/.env on Ubuntu with your actual GROQ_API_KEY and set KAFKA_ENABLED=true and ELASTICSEARCH_ENABLED=true. The deploy script creates it from the template automatically.

---
# 🚀 The Ultimate Step-by-Step Guide for Beginners (From a Fresh Windows 11 Install)

Welcome! This guide assumes you are starting with a brand-new Windows 11 machine and have absolutely zero prior knowledge. Follow these instructions exactly, step-by-step, to get the entire FirewallAI project running perfectly.

## PHASE 1: Prepare Your Windows 11 Machine

### Step 1: Install Required Software
You need three essential tools installed on your Windows machine:
1. **Node.js:** This runs our frontend code. Download the "LTS" (Long Term Support) version from [nodejs.org](https://nodejs.org/) and run the installer. Just click "Next" on everything.
2. **Git:** This manages our code. Download from [git-scm.com](https://git-scm.com/download/win) and click "Next" on everything during installation.
3. **Visual Studio Code (VS Code):** This is where we write and view code. Download from [code.visualstudio.com](https://code.visualstudio.com/) and install it.

### Step 2: Open PowerShell as Administrator
1. Click the Windows Start Button, type `PowerShell`.
2. Right-click on "Windows PowerShell" and select **"Run as Administrator"**.
3. We need to allow scripts to run. Type the following command and press Enter:
   ```powershell
   Set-ExecutionPolicy RemoteSigned
   ```
4. When prompted, type `Y` and press Enter.

## PHASE 2: Set Up Your Virtual Machines (VMs)

You need two virtual machines running on your network (using VMware Workstation Player, VirtualBox, or Hyper-V):
1. **Ubuntu Server:** (IP: `192.168.1.101`) - This will run our backend services and AI engine.
2. **Kali Linux:** (IP: `192.168.1.103`) - This will simulate the "bad guy" running network attacks.

*(Note: Install the server OS on your VMs and make sure their network adapters are set to "Bridged" so they get an IP address on your local network. Set them to the static IPs mentioned above).*

### Step 3: Set up Passwordless SSH (So Windows can talk to the VMs securely)
In your Windows PowerShell window, type the following to generate a secure "key":
```powershell
ssh-keygen -t ed25519 -C "windows-host"
```
*(Press Enter three times to accept the defaults and skip the password).*

Now, copy this key to your Ubuntu VM (it will ask for your Ubuntu password one last time):
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@192.168.1.101 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Copy the key to your Kali VM (it will ask for your Kali password):
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh kali@192.168.1.103 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

## PHASE 3: Set Up the Project on Windows

### Step 4: Open the Code
1. Open Visual Studio Code.
2. Go to the top menu: `File` -> `Open Folder...`
3. Select your FirewallAI project folder (e.g., `C:\Users\saiku\Desktop\FirewallAI\firewallai`).
4. Go to the top menu: `Terminal` -> `New Terminal`.

### Step 5: Install Windows Dependencies
In that fresh VS Code terminal, type:
```powershell
npm install
```
*(This will download all the necessary frontend packages. It might take a minute or two).*

## PHASE 4: Deploy and Configure the Backend (Ubuntu)

### Step 6: Deploy Code Automatically
We have automated scripts that do the heavy lifting. In your VS Code terminal, run:
```powershell
.\scripts\Deploy-All.ps1
```
*(This secure script copies all the backend code to your Ubuntu server and the attack scripts to Kali).*

### Step 7: Configure Secrets (Crucial Step!)
1. SSH into your Ubuntu server right from your VS Code terminal by typing:
   ```powershell
   ssh ubuntu@192.168.1.101
   ```
2. Open the configuration file we just deployed using the nano text editor:
   ```bash
   nano ~/cyber-defense/backend/.env
   ```
3. Use your arrow keys to scroll down. Find `GROQ_API_KEY=""` and paste your actual Groq API key inside the quotes. 
   *(If you don't have one, get a free one at [console.groq.com](https://console.groq.com)).*
4. Find `KAFKA_ENABLED=false` and `ELASTICSEARCH_ENABLED=false`. Leave them as `false` for now if you want to use the lightweight "Zero-RAM" mock data feature (recommended for beginners).
5. Save the file: Press `Ctrl+O`, then `Enter`. Exit the file: Press `Ctrl+X`.
6. Log out of the Ubuntu server to get back to your Windows PC:
   ```bash
   exit
   ```

## PHASE 5: Start Everything Up!

### Step 8: Start Backend Services
Use the automated menu to start the backend securely:
1. In your VS Code terminal (still in the firewallai folder), type:
   ```powershell
   .\scripts\Deploy-Menu.bat
   ```
2. An elegant green menu will appear! Press `2` to "Deploy & Start Backend Services" and hit Enter.
*(This logs into Ubuntu, installs its backend dependencies, and starts the Node.js server and AI defense engine scripts).*

### Step 9: Start the Windows Dashboard
1. Back in your normal VS Code terminal, type:
   ```powershell
   npm run dev
   ```
2. Open your web browser (Chrome, Edge, etc.) and go to:
   `http://localhost:5173`

### 🎉 YOU ARE DONE! 🎉
Log into the dashboard using:
- **Username:** `admin`
- **Password:** `firewall123`

You can now click on **Threat Map** to see live global attacks, or **Topology** to see your entire network infrastructure dynamically rendered!

---

## FAQ: API Keys & Live Data vs. Simulated Data

As a beginner, you might wonder what is actually "real" versus what is a simulation in this project. Here is the breakdown.

### What API Keys or Configurations do I *actually* need?
The project is designed to be very forgiving. You *can* run it without any keys, but to get real functionality, you should configure:

1. **Groq API Key (Highly Recommended):** 
   - **Why?** It powers the AI analysis and rule generation instantly without melting your computer. 
   - **Cost?** 100% Free. Get it at [console.groq.com](https://console.groq.com).
   - **Where to put it?** In `~/cyber-defense/backend/.env` under `GROQ_API_KEY=your_key_here`.

2. **pfSense Credentials (Required for blocking):**
   - **Why?** For the AI to *actually block a hacker*, it uses SSH to log into your pfSense VM and apply the rule.
   - **Where to put it?** In the `.env` file (`PFSENSE_HOST`, `PFSENSE_USER`, `PFSENSE_PASSWORD`).

3. **AlienVault OTX (Threat Intelligence):**
   - **Cost?** Free, and **No API Key is required!** The code currently calls their public endpoints to check if an IP address is malicious.

4. **MaxMind GeoLite2 Database (Required for Threat Map):**
   - **Why?** To place an attacker on the world map, we need to know where their IP address is located.
   - **How to get it:** Create a free account at [MaxMind](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data), download the `GeoLite2-City.mmdb` file, and put it in `/opt/firewallai/` on your Ubuntu server.

### What is LIVE (Actually working)?
- **AI Rule Generation:** The AI actively analyzes threat data you feed it and writes perfect firewall syntax.
- **Firewall Actions:** Clicking "Apply Rule" literally logs into pfSense instantly and blocks the IP.
- **Threat Intel Lookups:** The system pings external cybersecurity databases to check IP reputations in real-time.
- **Geo-Mapping:** Real IPs get matched to real-world coordinates instantly.

### What is HARDCODED or SIMULATED?
Because running enterprise-grade data pipelines (like Elasticsearch and Kafka) requires massive amounts of RAM (16GB+), we built a **"Zero-RAM Simulation Mode."** 

When `KAFKA_ENABLED=false` and `ELASTICSEARCH_ENABLED=false` in your `.env` file:
- **The Threat Map Page:** Displays a hardcoded, highly realistic dataset of global attacks (e.g., showing DDoS attacks from Russia and China) instead of querying a massive database.
- **The Network Topology Page:** Draws the network layout using simulated, hardcoded nodes to represent attackers.
- **Dashboard Charts:** The "Network Traffic" line charts use a script to generate random spikes and dips visually, simulating heavy network traffic.

**How to make it 100% Live?**
If you have a powerful server (16GB+ RAM), you can install Elasticsearch and Kafka on Ubuntu, change the `.env` flags to `true`, and feed your real pfSense logs into it. The system will automatically stop simulating and start rendering your exact, live data!

---

## 🖥️ Optimized VM Specifications

Your lab has **4 Virtual Machines**. Below are the exact, optimized specs for two scenarios:
- **Tier 1 — Demo / Presentation Mode:** Everything runs, pages show simulated data, AI rule generation works via Groq Cloud. Good for showcasing the project.
- **Tier 2 — Full Live Mode:** Real-time log pipeline with Elasticsearch, Kafka, and Spark processing actual pfSense logs. Every chart shows real data.

---

### VM 1: pfSense Firewall
> **Role:** The actual firewall appliance. Routes all traffic, generates logs, receives block rules via SSH.
> **IP:** `192.168.1.1`

| Resource | Tier 1 (Demo) | Tier 2 (Full Live) |
|---|---|---|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 512 MB | 1 GB |
| **Disk** | 8 GB (SSD) | 16 GB (SSD) |
| **NICs** | 2 (WAN + LAN) | 2 (WAN + LAN) |
| **OS** | pfSense CE 2.7+ | pfSense CE 2.7+ |

**Why so small?** pfSense is extremely lightweight. It's a FreeBSD appliance that just routes packets. Even with Suricata IDS enabled it rarely uses more than 512MB.

---

### VM 2: Ubuntu Server (Backend Brain)
> **Role:** The core backend. Runs Node.js API server, AI defense engine (Python/Spark), and optionally Kafka + Elasticsearch + Grafana.
> **IP:** `192.168.1.101`

| Resource | Tier 1 (Demo) | Tier 2 (Full Live) |
|---|---|---|
| **CPU** | 2 vCPU | 4-6 vCPU |
| **RAM** | 4 GB | 16 GB |
| **Disk** | 30 GB (SSD) | 80-120 GB (SSD) |
| **OS** | Ubuntu 22.04 Server | Ubuntu 22.04 Server |

**What eats the RAM in Tier 2:**

| Service | RAM Usage | Notes |
|---|---|---|
| Node.js Backend (server_v2.js) | ~150 MB | Very lightweight |
| Python Defense Engine (Spark) | ~1.5 GB | Spark driver + ML models |
| Elasticsearch | ~2-4 GB | The biggest consumer. Set `-Xms2g -Xmx4g` |
| Kafka + Zookeeper | ~1-1.5 GB | Message broker for log streaming |
| Grafana | ~200 MB | Dashboard visualization |
| GeoIP Database (MaxMind) | ~60 MB on disk | Loaded on-demand, not resident |
| OS + buffers | ~500 MB | Linux kernel, systemd |
| **Total** | **~6-8 GB active** | 16 GB gives headroom for spikes |

**Why 4 GB works for Tier 1:** In demo mode, Kafka and Elasticsearch are disabled (`KAFKA_ENABLED=false`, `ELASTICSEARCH_ENABLED=false`). You only run Node.js (~150MB) and Python (~200MB without Spark). The AI calls go to Groq Cloud (zero local RAM). Total usage: **~1 GB**.

---

### VM 3: Windows 11 (Dashboard Host)
> **Role:** Runs the React frontend in the browser. Also where you code, deploy, and monitor.
> **IP:** `192.168.1.100`

| Resource | Tier 1 (Demo) | Tier 2 (Full Live) |
|---|---|---|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 60 GB (SSD) | 80 GB (SSD) |
| **OS** | Windows 11 Pro | Windows 11 Pro |

**What eats the RAM:**

| Process | RAM Usage |
|---|---|
| Windows 11 OS | ~2.5 GB |
| VS Code + Extensions | ~500 MB |
| Chrome/Edge (Dashboard) | ~300-500 MB |
| Node.js dev server (`npm run dev`) | ~150 MB |
| **Total** | **~3.5-4 GB** |

**Tip:** If this is a bare-metal PC (not a VM), 8 GB is plenty. If it IS a VM, 4 GB is tight but workable — close unnecessary apps.

---

### VM 4: Kali Linux (Attack Simulator)
> **Role:** The "red team" machine. Runs Nmap scans, Hydra brute-force, hping3 DDoS, and other attack scripts to test the firewall.
> **IP:** `192.168.1.103`

| Resource | Tier 1 (Demo) | Tier 2 (Full Live) |
|---|---|---|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 2 GB | 4 GB |
| **Disk** | 25 GB (SSD) | 40 GB (SSD) |
| **OS** | Kali Linux 2024+ | Kali Linux 2024+ |

**Why so small?** Attack tools like Nmap and Hydra are CPU-bound, not memory-bound. 2 GB is plenty for running scans. 4 GB only if you plan to run multiple parallel attacks or Metasploit Framework simultaneously.

---

### 🏠 Host Machine Requirements (The physical PC running all VMs)

| Scenario | Total vCPU | Total RAM | Total Disk | Hypervisor |
|---|---|---|---|---|
| **Tier 1 (Demo)** | 6 cores | 10.5 GB → **12 GB minimum** | 123 GB → **256 GB SSD** | VMware/VirtualBox/Hyper-V |
| **Tier 2 (Full Live)** | 14 cores | 29 GB → **32 GB minimum** | 256 GB → **512 GB SSD** | VMware Workstation Pro / Hyper-V |

**Recommended Host PC:**
- **CPU:** Intel Core i7-12700 or AMD Ryzen 7 5800X (8+ cores, 16 threads)
- **RAM:** 32 GB DDR4/DDR5
- **Storage:** 512 GB NVMe SSD (VMs on SSD is critical for Elasticsearch performance)
- **Network:** Gigabit Ethernet (for bridged VM networking)

---

### 🌐 Network Layout

```
Internet
    │
    ▼
┌──────────────┐
│  pfSense     │ 192.168.1.1 (WAN + LAN)
│  Firewall    │ Generates logs → Kafka
└──────┬───────┘
       │ LAN (Bridged)
       ├────────────────────┬────────────────────┐
       ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Ubuntu      │   │  Windows 11  │   │  Kali Linux  │
│  Backend     │   │  Dashboard   │   │  Attacker    │
│  .101        │   │  .100        │   │  .103        │
│              │   │              │   │              │
│ Node.js API  │   │ React UI     │   │ Nmap, Hydra  │
│ Spark/Python │   │ VS Code      │   │ hping3       │
│ Kafka (opt)  │   │ Browser      │   │ Metasploit   │
│ ES (opt)     │   │              │   │              │
│ Grafana      │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

All VMs should use **Bridged Networking** in your hypervisor so they get real IPs on the same subnet and can communicate with each other.
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
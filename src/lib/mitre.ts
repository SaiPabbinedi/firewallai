/**
 * MITRE ATT&CK Framework Mapping
 * ============================================================
 * Maps threat classifications from the defense engine to
 * official MITRE ATT&CK technique IDs, tactics, and metadata.
 * Reference: https://attack.mitre.org/
 */

export interface MitreTechnique {
    id: string;
    name: string;
    tactic: string;
    tacticId: string;
    description: string;
    url: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Core MITRE ATT&CK technique mapping
 * Keys match the classification output from defense_engine_v2.py
 */
export const MITRE_TECHNIQUES: Record<string, MitreTechnique> = {
    port_scan: {
        id: 'T1046',
        name: 'Network Service Discovery',
        tactic: 'Discovery',
        tacticId: 'TA0007',
        description: 'Adversary attempts to get a listing of services running on remote hosts and identify open ports.',
        url: 'https://attack.mitre.org/techniques/T1046/',
        severity: 'medium',
    },
    brute_force: {
        id: 'T1110',
        name: 'Brute Force',
        tactic: 'Credential Access',
        tacticId: 'TA0006',
        description: 'Adversary uses brute force techniques to attempt access to accounts when passwords are unknown.',
        url: 'https://attack.mitre.org/techniques/T1110/',
        severity: 'high',
    },
    ddos: {
        id: 'T1498',
        name: 'Network Denial of Service',
        tactic: 'Impact',
        tacticId: 'TA0040',
        description: 'Adversary performs Network Denial of Service to degrade or block resource availability.',
        url: 'https://attack.mitre.org/techniques/T1498/',
        severity: 'critical',
    },
    web_attack: {
        id: 'T1190',
        name: 'Exploit Public-Facing Application',
        tactic: 'Initial Access',
        tacticId: 'TA0001',
        description: 'Adversary exploits a weakness in an Internet-facing application to gain initial access.',
        url: 'https://attack.mitre.org/techniques/T1190/',
        severity: 'critical',
    },
    ssh_anomaly: {
        id: 'T1021.004',
        name: 'Remote Services: SSH',
        tactic: 'Lateral Movement',
        tacticId: 'TA0008',
        description: 'Adversary may use SSH to move laterally within a network environment.',
        url: 'https://attack.mitre.org/techniques/T1021/004/',
        severity: 'high',
    },
    dns_tunneling: {
        id: 'T1071.004',
        name: 'Application Layer Protocol: DNS',
        tactic: 'Command and Control',
        tacticId: 'TA0011',
        description: 'Adversary may use DNS to communicate with systems under their control within a victim network.',
        url: 'https://attack.mitre.org/techniques/T1071/004/',
        severity: 'high',
    },
    data_exfiltration: {
        id: 'T1041',
        name: 'Exfiltration Over C2 Channel',
        tactic: 'Exfiltration',
        tacticId: 'TA0010',
        description: 'Adversary may steal data by exfiltrating it over an existing command and control channel.',
        url: 'https://attack.mitre.org/techniques/T1041/',
        severity: 'critical',
    },
    credential_access: {
        id: 'T1003',
        name: 'OS Credential Dumping',
        tactic: 'Credential Access',
        tacticId: 'TA0006',
        description: 'Adversary attempts to dump credentials from the operating system and software.',
        url: 'https://attack.mitre.org/techniques/T1003/',
        severity: 'critical',
    },
    reconnaissance: {
        id: 'T1595',
        name: 'Active Scanning',
        tactic: 'Reconnaissance',
        tacticId: 'TA0043',
        description: 'Adversary actively scans to gather information that can be used for targeting.',
        url: 'https://attack.mitre.org/techniques/T1595/',
        severity: 'medium',
    },
    malware: {
        id: 'T1204',
        name: 'User Execution: Malicious File',
        tactic: 'Execution',
        tacticId: 'TA0002',
        description: 'Adversary relies upon a user executing a malicious file for code execution.',
        url: 'https://attack.mitre.org/techniques/T1204/',
        severity: 'critical',
    },
    normal: {
        id: 'N/A',
        name: 'Normal Traffic',
        tactic: 'None',
        tacticId: 'N/A',
        description: 'Traffic classified as normal behavior — no threat detected.',
        url: '',
        severity: 'low',
    },
};

/**
 * Resolve a classification string to its MITRE ATT&CK technique.
 * Supports fuzzy matching for variations like "Port Scan", "port-scan", "PORT_SCAN".
 */
export function getMitreTechnique(classification: string): MitreTechnique | null {
    if (!classification) return null;

    const normalized = classification.toLowerCase().replace(/[\s\-]+/g, '_');

    // Direct match
    if (MITRE_TECHNIQUES[normalized]) {
        return MITRE_TECHNIQUES[normalized];
    }

    // Fuzzy match
    for (const [key, technique] of Object.entries(MITRE_TECHNIQUES)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return technique;
        }
    }

    // Keyword match
    if (normalized.includes('scan') || normalized.includes('probe')) return MITRE_TECHNIQUES.port_scan ?? null;
    if (normalized.includes('brute') || normalized.includes('login')) return MITRE_TECHNIQUES.brute_force ?? null;
    if (normalized.includes('dos') || normalized.includes('flood')) return MITRE_TECHNIQUES.ddos ?? null;
    if (normalized.includes('web') || normalized.includes('http') || normalized.includes('sql')) return MITRE_TECHNIQUES.web_attack ?? null;
    if (normalized.includes('ssh')) return MITRE_TECHNIQUES.ssh_anomaly ?? null;
    if (normalized.includes('dns') || normalized.includes('tunnel')) return MITRE_TECHNIQUES.dns_tunneling ?? null;
    if (normalized.includes('exfil')) return MITRE_TECHNIQUES.data_exfiltration ?? null;

    return null;
}

/**
 * Get Tailwind CSS classes for MITRE severity level
 */
export function getMitreSeverityColor(severity: string): string {
    switch (severity) {
        case 'critical': return 'text-red-400 bg-red-500/10 border border-red-500/30';
        case 'high': return 'text-orange-400 bg-orange-500/10 border border-orange-500/30';
        case 'medium': return 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30';
        case 'low': return 'text-green-400 bg-green-500/10 border border-green-500/30';
        default: return 'text-gray-400 bg-gray-500/10 border border-gray-500/30';
    }
}

/**
 * MITRE ATT&CK Kill Chain (in execution order)
 */
export const MITRE_KILL_CHAIN = [
    { id: 'TA0043', name: 'Reconnaissance', color: '#6366f1' },
    { id: 'TA0042', name: 'Resource Development', color: '#8b5cf6' },
    { id: 'TA0001', name: 'Initial Access', color: '#a855f7' },
    { id: 'TA0002', name: 'Execution', color: '#d946ef' },
    { id: 'TA0003', name: 'Persistence', color: '#ec4899' },
    { id: 'TA0004', name: 'Privilege Escalation', color: '#f43f5e' },
    { id: 'TA0005', name: 'Defense Evasion', color: '#ef4444' },
    { id: 'TA0006', name: 'Credential Access', color: '#f97316' },
    { id: 'TA0007', name: 'Discovery', color: '#f59e0b' },
    { id: 'TA0008', name: 'Lateral Movement', color: '#eab308' },
    { id: 'TA0009', name: 'Collection', color: '#84cc16' },
    { id: 'TA0011', name: 'Command and Control', color: '#22c55e' },
    { id: 'TA0010', name: 'Exfiltration', color: '#14b8a6' },
    { id: 'TA0040', name: 'Impact', color: '#06b6d4' },
];

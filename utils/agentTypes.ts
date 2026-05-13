/**
 * Agent Types — shared type definitions for the autonomous agent system.
 * Extracted from autonomousAgent.ts to break the circular dependency
 * between autonomousAgent.ts and agentBackendClient.ts.
 */

export interface AgentConfig {
    enabled: boolean;
    minIntervalMin: number;
    maxIntervalMin: number;
    cooldownHours: number;
    maxDailyActions: number;
    maxConsecutiveIgnored: number;
    baseProb: number;
    notificationsEnabled: boolean;
    debugMode: boolean;
    debugIntervalSec: number;
}

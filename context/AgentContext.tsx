import React,{ createContext,useContext,useEffect,useRef,useState } from 'react';
import {
    BackendAgentManager,
    getAgentConfig,
    type SecondaryApiConfig,
} from '../utils/autonomousAgent';
import { didCharacterContextRelevantFieldsChange } from '../utils/agentContextSnapshot';
import { disablePushSubscription,initPushSubscription } from '../utils/pushSubscription';
import { getSecondaryApiConfig as getRuntimeSecondaryApiConfig } from '../utils/runtimeConfig';
import { consumeCharacterUpdateOptions,useCharacter } from './CharacterContext';
import { useConfig } from './ConfigContext';

export interface AgentContextType {}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const toAgentApiConfig = (
    config?: { apiKey?: string; baseUrl?: string; model?: string } | null,
): SecondaryApiConfig | undefined => {
    const apiKey = config?.apiKey?.trim();
    const baseUrl = config?.baseUrl?.trim();
    const model = config?.model?.trim();
    if (!apiKey || !baseUrl || !model) {
        return undefined;
    }

    return {
        apiKey,
        baseUrl,
        model,
    };
};

const getAgentStartApiConfig = (): SecondaryApiConfig | undefined => {
    return toAgentApiConfig(getRuntimeSecondaryApiConfig());
};

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { characters, activeCharacterId, isCharacterDataLoaded } = useCharacter();
    const { isConfigLoaded } = useConfig();
    const [agentReloadCounter, setAgentReloadCounter] = useState(0);
    const [agentEnabled, setAgentEnabled] = useState(
        () => getAgentConfig().enabled,
    );
    const [notificationsEnabled, setNotificationsEnabled] = useState(
        () => getAgentConfig().notificationsEnabled,
    );
    const isAgentReady = isCharacterDataLoaded && isConfigLoaded;
    const managerRef = useRef<BackendAgentManager | null>(null);
    const activeCharacter = characters.find(character => character.id === activeCharacterId) || null;
    const activeCharacterRef = useRef(activeCharacter);
    const previousActiveCharacterRef = useRef(activeCharacter);

    activeCharacterRef.current = activeCharacter;

    useEffect(() => {
        const handler = () => {
            const nextConfig = getAgentConfig();
            setAgentReloadCounter(count => count + 1);
            setAgentEnabled(nextConfig.enabled);
            setNotificationsEnabled(nextConfig.notificationsEnabled);
        };
        window.addEventListener('agent-config-changed', handler);
        return () => window.removeEventListener('agent-config-changed', handler);
    }, []);

    useEffect(() => {
        if (!isAgentReady || !agentEnabled || !activeCharacterId) return;

        const char = activeCharacterRef.current;
        if (!char) return;

        const apiConfig = getAgentStartApiConfig();
        if (!apiConfig) return;

        const manager = new BackendAgentManager();
        managerRef.current = manager;
        manager.start(activeCharacterId, char, apiConfig);

        let keepBackendAlive = false;
        const markPageExit = () => {
            keepBackendAlive = true;
        };

        window.addEventListener('pagehide', markPageExit);
        window.addEventListener('beforeunload', markPageExit);

        return () => {
            window.removeEventListener('pagehide', markPageExit);
            window.removeEventListener('beforeunload', markPageExit);
            if (managerRef.current === manager) {
                managerRef.current = null;
            }

            if (keepBackendAlive) {
                try {
                    manager.disconnectFrontend();
                } catch (error) {
                    console.warn('[Agent] Failed to disconnect frontend runtime safely:', error);
                }
                return;
            }

            try {
                manager.stop();
            } catch (error) {
                console.warn('[Agent] Failed to stop backend agent safely during cleanup:', error);
            }
        };
    }, [isAgentReady, agentEnabled, activeCharacterId, agentReloadCounter]);

    useEffect(() => {
        const previousCharacter = previousActiveCharacterRef.current;
        previousActiveCharacterRef.current = activeCharacter;

        if (!isAgentReady || !agentEnabled || !activeCharacter) return;
        if (!previousCharacter || previousCharacter.id !== activeCharacter.id) return;
        if (previousCharacter === activeCharacter) return;

        const didContextRelevantFieldsChange = didCharacterContextRelevantFieldsChange(
            previousCharacter,
            activeCharacter,
        );
        const updateOptions = consumeCharacterUpdateOptions(activeCharacter.id);
        if (!didContextRelevantFieldsChange) {
            return;
        }
        if (updateOptions?.skipImmediateAgentContextPush) {
            return;
        }

        managerRef.current?.pushContext(activeCharacter).catch((error) => {
            console.warn('[Agent] Failed to push refreshed character context:', error);
        });
    }, [activeCharacter, agentEnabled, isAgentReady]);

    useEffect(() => {
        if (!isAgentReady) return;
        if (!agentEnabled || !notificationsEnabled) {
            disablePushSubscription().catch(err => {
                console.warn('[Push] Disable failed:', err.message || err);
            });
            return;
        }

        const timer = setTimeout(() => {
            initPushSubscription().catch(err => {
                console.warn('[Push] Init failed:', err.message || err);
            });
        }, 3000);

        return () => clearTimeout(timer);
    }, [isAgentReady, agentEnabled, notificationsEnabled]);

    useEffect(() => {
        if (!isAgentReady || !agentEnabled || !notificationsEnabled) return;

        const refreshPushSubscription = () => {
            if (document.visibilityState !== 'visible') return;

            initPushSubscription().catch(err => {
                console.warn('[Push] Resume sync failed:', err.message || err);
            });
        };

        document.addEventListener('visibilitychange', refreshPushSubscription);
        window.addEventListener('pageshow', refreshPushSubscription);

        return () => {
            document.removeEventListener('visibilitychange', refreshPushSubscription);
            window.removeEventListener('pageshow', refreshPushSubscription);
        };
    }, [isAgentReady, agentEnabled, notificationsEnabled]);

    return (
        <AgentContext.Provider value={{}}>
            {children}
        </AgentContext.Provider>
    );
};

export const useAgent = () => {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
};

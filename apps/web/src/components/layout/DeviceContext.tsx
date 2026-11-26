'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DeviceEntity } from '@updatepilot/shared';
import { useAuth } from './AuthContext';

interface LocalAgentIdentity {
  computerName?: string;
  deviceId?: string;
  server?: string;
  agentVersion?: string;
}

interface DeviceContextType {
  devices: DeviceEntity[];
  selectedDeviceId: string; // 'ALL' or specific device ID
  setSelectedDeviceId: (id: string) => void;
  activeDevice: DeviceEntity | null;
  thisComputerDeviceId: string | null;
  bindThisComputer: (deviceId: string) => void;
  enableRemoteFleetView: (deviceId?: string) => void;
  supportsLocalWinGet: boolean;
  isCloudHosted: boolean;
  storageMode: string;
  hasExplicitSelection: boolean;
  needsThisComputerPairing: boolean;
  refreshDevices: () => Promise<void>;
  isLoading: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

async function probeLocalAgentIdentity(): Promise<LocalAgentIdentity | null> {
  if (typeof window === 'undefined') return null;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 500);
    const res = await fetch('http://127.0.0.1:47832/identity', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as LocalAgentIdentity;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [devices, setDevices] = useState<DeviceEntity[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>('ALL');
  const [thisComputerDeviceId, setThisComputerDeviceId] = useState<string | null>(null);
  const [hasExplicitSelection, setHasExplicitSelection] = useState<boolean>(false);
  const [supportsLocalWinGet, setSupportsLocalWinGet] = useState<boolean>(true);
  const [isCloudHosted, setIsCloudHosted] = useState<boolean>(false);
  const [storageMode, setStorageMode] = useState<string>('disk');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const boundStorageKey = useMemo(
    () => (user?.id ? `updatepilot_this_device_${user.id}` : 'updatepilot_this_device'),
    [user?.id]
  );

  const sessionStorageKey = useMemo(
    () => (user?.id ? `updatepilot_selected_device_${user.id}` : 'updatepilot_selected_device'),
    [user?.id]
  );

  const setSelectedDeviceId = useCallback(
    (id: string) => {
      setSelectedDeviceIdState(id);
      setHasExplicitSelection(true);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(sessionStorageKey, id);
        } catch {
          // ignore storage quota errors
        }
      }
    },
    [sessionStorageKey]
  );

  const bindThisComputer = useCallback(
    (deviceId: string) => {
      setThisComputerDeviceId(deviceId);
      setSelectedDeviceIdState(deviceId);
      setHasExplicitSelection(true);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(boundStorageKey, deviceId);
          window.sessionStorage.setItem(sessionStorageKey, deviceId);
        } catch {
          // ignore storage quota errors
        }
      }
    },
    [boundStorageKey, sessionStorageKey]
  );

  const enableRemoteFleetView = useCallback(
    (deviceId = 'ALL') => {
      setSelectedDeviceId(deviceId);
    },
    [setSelectedDeviceId]
  );

  const refreshDevices = useCallback(async () => {
    try {
      const [devRes, healthRes, localIdentity] = await Promise.all([
        fetch('/api/v1/devices', { cache: 'no-store' }),
        fetch('/api/v1/health', { cache: 'no-store' }).catch(() => null),
        probeLocalAgentIdentity(),
      ]);

      let localWinGet = true;
      if (healthRes && healthRes.ok) {
        const healthData = await healthRes.json();
        if (healthData.success && healthData.data) {
          localWinGet = Boolean(healthData.data.supportsLocalWinGet);
          setSupportsLocalWinGet(localWinGet);
          setIsCloudHosted(Boolean(healthData.data.isCloudHosted));
          if (healthData.data.storageMode) {
            setStorageMode(healthData.data.storageMode);
          }
        }
      }

      const data = await devRes.json();
      if (data.success) {
        const rawDevices = (data.data.devices || []) as DeviceEntity[];
        const cleanDevices = rawDevices.filter((d) => d.deviceName !== 'Pending Pairing...');
        setDevices(cleanDevices);

        let resolvedBoundId: string | null = null;

        // 1. Auto-detect matching host via local loopback agent identity if running on this PC
        if (typeof window !== 'undefined' && localIdentity) {
          const originNormalized = window.location.origin.replace(/\/$/, '').toLowerCase();
          const agentServer = (localIdentity.server || '').replace(/\/$/, '').toLowerCase();
          const sameOrigin = !agentServer || agentServer === originNormalized;

          if (sameOrigin && localIdentity.deviceId) {
            const byId = cleanDevices.find((d) => d.id === localIdentity.deviceId);
            if (byId) {
              resolvedBoundId = byId.id;
            }
          }
          if (!resolvedBoundId && sameOrigin && localIdentity.computerName) {
            const targetName = localIdentity.computerName.toLowerCase();
            const byName =
              cleanDevices.find((d) => d.deviceName.toLowerCase() === targetName && d.status === 'ONLINE') ||
              cleanDevices.find((d) => d.deviceName.toLowerCase() === targetName);
            if (byName) {
              resolvedBoundId = byName.id;
            }
          }
        }

        // 2. Fall back to browser-persisted bound device ID for this user
        if (!resolvedBoundId && typeof window !== 'undefined') {
          try {
            const savedBound = window.localStorage.getItem(boundStorageKey);
            if (savedBound && cleanDevices.some((d) => d.id === savedBound)) {
              resolvedBoundId = savedBound;
            } else if (savedBound) {
              window.localStorage.removeItem(boundStorageKey);
            }
          } catch {
            // ignore
          }
        } else if (resolvedBoundId && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(boundStorageKey, resolvedBoundId);
          } catch {
            // ignore
          }
        }

        // 3. On local Windows server, prefer the embedded local engine device if no bound agent ID exists
        if (!resolvedBoundId && localWinGet) {
          const localEngineDev = cleanDevices.find(
            (d) => d.agentVersion?.includes('Local Engine') || d.id.startsWith('dev_local_')
          );
          if (localEngineDev) {
            resolvedBoundId = localEngineDev.id;
          }
        }

        setThisComputerDeviceId(resolvedBoundId);

        // 4. Determine selectedDeviceId cleanly: preserve explicit in-tab selection, otherwise lock onto this PC
        let sessionPick: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            sessionPick = window.sessionStorage.getItem(sessionStorageKey);
          } catch {
            sessionPick = null;
          }
        }

        if (sessionPick && (sessionPick === 'ALL' || cleanDevices.some((d) => d.id === sessionPick))) {
          setSelectedDeviceIdState(sessionPick);
          setHasExplicitSelection(true);
        } else if (resolvedBoundId) {
          setSelectedDeviceIdState(resolvedBoundId);
          setHasExplicitSelection(true);
        } else {
          setSelectedDeviceIdState('ALL');
          setHasExplicitSelection(false);
        }
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [boundStorageKey, sessionStorageKey]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const activeDevice =
    selectedDeviceId === 'ALL' ? null : devices.find((d) => d.id === selectedDeviceId) || null;

  const needsThisComputerPairing =
    !isLoading && !supportsLocalWinGet && !thisComputerDeviceId && !hasExplicitSelection;

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDeviceId,
        setSelectedDeviceId,
        activeDevice,
        thisComputerDeviceId,
        bindThisComputer,
        enableRemoteFleetView,
        supportsLocalWinGet,
        isCloudHosted,
        storageMode,
        hasExplicitSelection,
        needsThisComputerPairing,
        refreshDevices,
        isLoading,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDeviceContext must be used within a DeviceProvider');
  }
  return context;
}

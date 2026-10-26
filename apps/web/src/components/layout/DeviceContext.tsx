'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DeviceEntity } from '@updatepilot/shared';

interface DeviceContextType {
  devices: DeviceEntity[];
  selectedDeviceId: string; // 'ALL' or specific device ID
  setSelectedDeviceId: (id: string) => void;
  activeDevice: DeviceEntity | null;
  refreshDevices: () => Promise<void>;
  isLoading: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<DeviceEntity[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/devices');
      const data = await res.json();
      if (data.success) {
        setDevices(data.data.devices);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const activeDevice = selectedDeviceId === 'ALL'
    ? null
    : devices.find((d) => d.id === selectedDeviceId) || null;

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDeviceId,
        setSelectedDeviceId,
        activeDevice,
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

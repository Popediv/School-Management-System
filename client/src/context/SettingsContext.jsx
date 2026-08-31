import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { CURRENT_SESSION, CURRENT_TERM } from '../utils/constants';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
    const { data: settings, isLoading, refetch } = useQuery({
        queryKey: ['school-settings'],
        queryFn: () => api.get('/settings').then(r => r.data),
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const currentSession = settings?.currentSession || CURRENT_SESSION;
    const currentTerm = settings?.currentTerm || CURRENT_TERM;
    const schoolName = settings?.schoolName || 'Patimo College';
    const logoUrl = settings?.logoUrl || null;

    React.useEffect(() => {
        if (schoolName) {
            document.title = `${schoolName} — School Management System`;
        }
    }, [schoolName]);

    const value = {
        settings: settings || {},
        currentSession,
        currentTerm,
        schoolName,
        logoUrl,
        loading: isLoading,
        refetchSettings: refetch,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) {
        // Return safe fallback if used outside provider
        return {
            settings: {},
            currentSession: CURRENT_SESSION,
            currentTerm: CURRENT_TERM,
            schoolName: 'Patimo College',
            logoUrl: null,
            loading: false,
            refetchSettings: () => { },
        };
    }
    return ctx;
}

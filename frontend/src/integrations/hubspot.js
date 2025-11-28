// hubspot.js

import { useState, useEffect } from 'react';
import {
    Box,
    Button,
    CircularProgress
} from '@mui/material';
import axios from 'axios';

export const HubspotIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [authUrl, setAuthUrl] = useState(null);

    useEffect(() => {
        setIsConnected(Boolean(integrationParams?.credentials));
    }, [integrationParams?.credentials]);

    // Function to open OAuth in a new window
    const handleConnectClick = async () => {
        try {
            setIsConnecting(true);
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            const response = await axios.post(`http://localhost:8000/integrations/hubspot/authorize`, formData);
            // backend may return a string url or an object {url: '...'}
            const authURL = response?.data?.url || response?.data || response;
            // save and expose the URL for debugging; also log it
            console.log('HubSpot auth URL:', authURL);
            setAuthUrl(authURL);

            // Open auth URL in a new tab instead of popup to avoid extension interference
            const newTab = window.open(authURL, '_blank');
            if (newTab) {
                newTab.focus();
                // Poll to check if window is closed
                const checkWindowClosed = setInterval(() => {
                    if (newTab.closed) {
                        clearInterval(checkWindowClosed);
                        handleWindowClosed(); // Fetch credentials when auth window closes
                    }
                }, 500);
            } else {
                // If popup blocked, user can click debug link shown in UI
                console.warn('Unable to open new tab; please use the debug link shown in the UI.');
            }
        } catch (e) {
            setIsConnecting(false);
            // Show detailed backend/HubSpot error when available
            const detail = e?.response?.data?.detail || e?.response?.data || e.message;
            alert(detail);
            console.error('Authorize error:', e);
        }
    }

    // Function to handle logic when the OAuth window closes
    const handleWindowClosed = async () => {
        try {
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);
            const response = await axios.post(`http://localhost:8000/integrations/hubspot/credentials`, formData);
            const credentials = response.data; 
            if (credentials) {
                setIsConnecting(false);
                setIsConnected(true);
                setIntegrationParams(prev => ({ ...prev, credentials: credentials, type: 'HubSpot' }));
            }
            setIsConnecting(false);
        } catch (e) {
            setIsConnecting(false);
            alert(e?.response?.data?.detail || e.message);
        }
    }

    return (
        <>
        <Box sx={{mt: 2}}>
            Parameters
            <Box display='flex' alignItems='center' justifyContent='center' sx={{mt: 2}}>
                <Button 
                    variant='contained' 
                    onClick={isConnected ? () => {} :handleConnectClick}
                    color={isConnected ? 'success' : 'primary'}
                    disabled={isConnecting}
                    style={{
                        pointerEvents: isConnected ? 'none' : 'auto',
                        cursor: isConnected ? 'default' : 'pointer',
                        opacity: isConnected ? 1 : undefined
                    }}
                >
                    {isConnected ? 'HubSpot Connected' : isConnecting ? <CircularProgress size={20} /> : 'Connect to HubSpot'}
                </Button>
            </Box>
            {authUrl && (
                <Box sx={{mt: 2}}>
                    <div>Auth URL returned by backend (for debugging):</div>
                    <a href={authUrl} target="_blank" rel="noreferrer">Open Auth URL in new tab</a>
                </Box>
            )}
        </Box>
      </>
    );
}

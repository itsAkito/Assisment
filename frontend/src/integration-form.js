// import { useState } from 'react';
// import {
//     Box,
//     Autocomplete,
//     TextField,
// } from '@mui/material';
// import { AirtableIntegration } from './integrations/airtable';
// import { NotionIntegration } from './integrations/notion';
// import { HubspotIntegration } from './integrations/hubspot';
// import { DataForm } from './data-form';

// const integrationMapping = {
//     'Notion': NotionIntegration,
//     'Airtable': AirtableIntegration,
//     'HubSpot': HubspotIntegration,
// };

// export const IntegrationForm = () => {
//     const [integrationParams, setIntegrationParams] = useState({});
//     const [user, setUser] = useState('TestUser');
//     const [org, setOrg] = useState('TestOrg');
//     const [currType, setCurrType] = useState(null);
//     const CurrIntegration = integrationMapping[currType];

//   return (
//     <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' sx={{ width: '100%' }}>
//         <Box display='flex' flexDirection='column'>
//         <TextField
//             label="User"
//             value={user}
//             onChange={(e) => setUser(e.target.value)}
//             sx={{mt: 2}}
//         />
//         <TextField
//             label="Organization"
//             value={org}
//             onChange={(e) => setOrg(e.target.value)}
//             sx={{mt: 2}}
//         />
//         <Autocomplete
//             id="integration-type"
//             options={Object.keys(integrationMapping)}
//             sx={{ width: 300, mt: 2 }}
//             renderInput={(params) => <TextField {...params} label="Integration Type" />}
//             onChange={(e, value) => setCurrType(value)}
//         />
//         </Box>
//         {currType && 
//         <Box>
//             <CurrIntegration user={user} org={org} integrationParams={integrationParams} setIntegrationParams={setIntegrationParams} />
//         </Box>
//         }
//         {integrationParams?.credentials && 
//         <Box sx={{mt: 2}}>
//             <DataForm integrationType={integrationParams?.type} credentials={integrationParams?.credentials} />
//         </Box>
//         }
//     </Box>
//   );
// }


// export const AirtableIntegration = ({ user, org, setIntegrationParams }) => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const handleAuthorize = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const token = localStorage.getItem("jwt"); // ✅ get token here

//       const formData = new FormData();
//       formData.append("user_id", user);
//       formData.append("org_id", org);

//       const res = await fetch("http://127.0.0.1:8000/integrations/airtable/authorize", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`, // ✅ send token in header
//         },
//         body: formData,
//       });

//       if (!res.ok) throw new Error("Authorization failed");
//       const data = await res.json();

//       // Save credentials in parent state
//       setIntegrationParams({ type: "Airtable", credentials: data.credentials });
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div>
//       <button onClick={handleAuthorize} disabled={loading}>
//         {loading ? "Authorizing..." : "Authorize Airtable"}
//       </button>
//       {error && <p style={{ color: "red" }}>{error}</p>}
//     </div>
//   );
// };

// export const NotionIntegration = ({ user, org, setIntegrationParams }) => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const handleAuthorize = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const token = localStorage.getItem("jwt"); // ✅ get token here

//       const formData = new FormData();
//       formData.append("user_id", user);
//       formData.append("org_id", org);

//       const res = await fetch("http://127.0.0.1:8000/integrations/notion/authorize", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`, // ✅ send token in header
//         },
//         body: formData,
//       });

//       if (!res.ok) throw new Error("Authorization failed");
//       const data = await res.json();

//       setIntegrationParams({ type: "Notion", credentials: data.credentials });
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div>
//       <button onClick={handleAuthorize} disabled={loading}>
//         {loading ? "Authorizing..." : "Authorize Notion"}
//       </button>
//       {error && <p style={{ color: "red" }}>{error}</p>}
//     </div>
//   );
// };


// export const HubspotIntegration = ({ user, org, setIntegrationParams }) => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);

//   const handleAuthorize = async () => {
//     setLoading(true);
//     setError(null);

//     try {
//       const token = localStorage.getItem("jwt"); // ✅ get token here

//       const formData = new FormData();
//       formData.append("user_id", user);
//       formData.append("org_id", org);

//       const res = await fetch("http://127.0.0.1:8000/integrations/hubspot/authorize", {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`, // ✅ send token in header
//         },
//         body: formData,
//       });

//       if (!res.ok) throw new Error("Authorization failed");
//       const data = await res.json();

//       setIntegrationParams({ type: "HubSpot", credentials: data.credentials });
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div>
//       <button onClick={handleAuthorize} disabled={loading}>
//         {loading ? "Authorizing..." : "Authorize HubSpot"}
//       </button>
//       {error && <p style={{ color: "red" }}>{error}</p>}
//     </div>
//   );
// };

// ✅ All imports at the very top
import { useState } from 'react';
import { DataForm } from './data-form';
import { AirtableIntegration } from './integrations/airtable';
import { NotionIntegration } from './integrations/notion';
import { HubspotIntegration } from './integrations/hubspot';
import {
  Box,
  Autocomplete,
  TextField,
} from '@mui/material';

// --- IntegrationForm ---
export const IntegrationForm = () => {
  const [integrationParams, setIntegrationParams] = useState({});
  const [user, setUser] = useState('TestUser');
  const [org, setOrg] = useState('TestOrg');
  const [currType, setCurrType] = useState(null);

  const integrationMapping = {
    'Notion': NotionIntegration,
    'Airtable': AirtableIntegration,
    'HubSpot': HubspotIntegration,
  };

  const CurrIntegration = integrationMapping[currType];

  return (
    <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' sx={{ width: '100%' }}>
      <Box display='flex' flexDirection='column'>
        <TextField
          label="User"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          sx={{mt: 2}}
        />
        <TextField
          label="Organization"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          sx={{mt: 2}}
        />
        <Autocomplete
          id="integration-type"
          options={Object.keys(integrationMapping)}
          sx={{ width: 300, mt: 2 }}
          renderInput={(params) => <TextField {...params} label="Integration Type" />}
          onChange={(e, value) => setCurrType(value)}
        />
      </Box>

      {currType && (
        <Box>
          <CurrIntegration
            user={user}
            org={org}
            integrationParams={integrationParams}
            setIntegrationParams={setIntegrationParams}
          />
        </Box>
      )}

      {integrationParams?.credentials && (
        <Box sx={{mt: 2}}>
          <DataForm
            integrationType={integrationParams?.type}
            credentials={integrationParams?.credentials}
          />
        </Box>
      )}
    </Box>
  );
};
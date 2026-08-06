import { useEffect, useState } from 'react';
import { db, getSetting, setSetting } from '@/db';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getStoredUser, isDriveConnected, connectDrive, disconnectDrive, getLastBackupTime, uploadToDrive, GOOGLE_CLIENT_ID, listBackupFiles } from '@/utils/googleDrive';
import { exportExcel, exportCSV, exportJSON, restoreFromBackup, generateJSONBlob, generateCSVBlob, generateExcelBlob } from '@/utils/export';

export default function Settings(){
  const [user, setUser] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [browserNotif, setBrowserNotif] = useState(false);
  const [reminderDays, setReminderDays] = useState<number[]>([3,1]);
  const [clientId, setClientId] = useState(GOOGLE_CLIENT_ID);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [showDanger, setShowDanger] = useState(0);
  const [importing, setImporting] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [connectError, setConnectError] = useState('');
  const [backupProgress, setBackupProgress] = useState('');

  useEffect(()=>{
    setConnected(isDriveConnected());
    setUser(getStoredUser());
    setLastBackup(getLastBackupTime());
    getSetting('browserNotifications', false).then(setBrowserNotif);
    getSetting('defaultReminderDays', [3,1]).then(setReminderDays);
    getSetting('googleClientId', GOOGLE_CLIENT_ID).then((saved)=>{
      const effective = localStorage.getItem('gdrive_client_id') || saved || GOOGLE_CLIENT_ID;
      setClientId(effective);
    });
    if (isDriveConnected()) {
      listBackupFiles().then(setDriveFiles).catch(()=>{});
    }
  },[]);

  async function handleConnect(){
    setConnectError('');
    try {
      if (clientId.includes('YOUR_GOOGLE')) {
        throw new Error('Please configure a valid Google OAuth Client ID first.');
      }
      const u = await connectDrive();
      setUser(u);
      setConnected(true);
      setDriveFiles(await listBackupFiles().catch(()=>[]));
    } catch (e:any) {
      setConnectError(e?.message || 'Connection failed. Verify Client ID and authorized origins.');
    }
  }

  function handleDisconnect(){
    disconnectDrive();
    setConnected(false);
    setUser(null);
    setLastBackup(null);
    setDriveFiles([]);
  }

  async function handleManualBackup(){
    setLoadingBackup(true);
    setBackupProgress('Generating files...');
    try{
      const jsonBlob = await generateJSONBlob();
      setBackupProgress('Generating Excel file...');
      const excelBlob = await generateExcelBlob();
      setBackupProgress('Generating CSV file...');
      const csvBlob = await generateCSVBlob();
      setBackupProgress('Uploading to Google Drive...');
      const result = await uploadToDrive([
        { name:'EMI_Tracker_Latest.json', blob: jsonBlob },
        { name:'EMI_Tracker_Latest.xlsx', blob: excelBlob },
        { name:'EMI_Tracker_Latest.csv', blob: csvBlob }
      ]);
      if(result.success){
        setLastBackup(new Date().toISOString());
        setDriveFiles(await listBackupFiles().catch(()=>[]));
        alert(`Backup completed: ${result.message}`);
      } else {
        alert(`Backup failed: ${result.message}`);
      }
    }catch(e:any){
      alert('Backup failed: '+(e?.message || e));
    }finally{
      setLoadingBackup(false);
      setBackupProgress('');
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0];
    if(!file) return;
    setImporting(true);
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!data.loans) throw new Error('Invalid backup file');
      if(confirm(`Restore ${data.loans.length} loans? Current data will be replaced.`)){
        await restoreFromBackup(data);
        alert('Restore completed');
        location.reload();
      }
    }catch(err:any){
      alert('Restore failed: '+(err?.message || err));
    }finally{
      setImporting(false);
    }
  }

  async function clearAllData(){
    if(showDanger < 2){ setShowDanger(showDanger+1); return; }
    if(confirm('Delete all data? This action cannot be undone.')){
      const confirmText = prompt('Type DELETE to confirm');
      if(confirmText==='DELETE'){
        await db.loans.clear();
        await db.emiEntries.clear();
        await db.reminders.clear();
        await db.settings.clear();
        localStorage.clear();
        alert('All data cleared');
        location.reload();
      }
    }
    setShowDanger(0);
  }

  async function toggleBrowserNotif(){
    if(!('Notification' in window)){ alert('Browser notifications not supported'); return; }
    if(!browserNotif){
      const perm = await Notification.requestPermission();
      if(perm!=='granted'){ alert('Permission denied'); return; }
    }
    const newVal = !browserNotif;
    setBrowserNotif(newVal);
    await setSetting('browserNotifications', newVal);
  }

  async function saveReminderSettings(){
    await setSetting('defaultReminderDays', reminderDays);
    alert('Reminder settings saved');
  }

  async function saveClientId(){
    const trimmed = clientId.trim();
    if (!trimmed) { alert('Client ID is required'); return; }
    await setSetting('googleClientId', trimmed);
    localStorage.setItem('gdrive_client_id', trimmed);
    const meta = document.querySelector('meta[name="google-client-id"]');
    if (meta) meta.setAttribute('content', trimmed);
    alert('Client ID saved. Ensure this origin is whitelisted in Google Cloud Console: '+window.location.origin);
  }

  return (
    <div className="max-w-[720px] mx-auto space-y-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Settings</h1>
        <p className="text-[13px] text-slate-400">Manage backup, notifications and data</p>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-[15px] flex items-center gap-2"><span>☁️</span> Google Drive Backup</h3>
        
        <div className="bg-[#0f172a] rounded-xl p-4 border border-[#334155]/50 space-y-2">
          <p className="text-[12px] font-medium text-slate-300">Setup Instructions</p>
          <ol className="text-[11px] text-slate-500 space-y-1 list-decimal list-inside">
            <li>Create project at console.cloud.google.com</li>
            <li>Enable Google Drive API</li>
            <li>Configure OAuth consent screen and add test user</li>
            <li>Create OAuth Client ID - Web Application</li>
            <li>Add authorized origin: <span className="font-mono text-slate-400">{window.location.origin}</span></li>
            <li>Paste Client ID below and connect</li>
          </ol>
        </div>

        <div>
          <label className="text-[13px] font-medium">Google OAuth Client ID</label>
          <div className="flex gap-2 mt-1.5">
            <Input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="1234567890-xxx.apps.googleusercontent.com" className="flex-1 font-mono text-[12px]" />
            <Button variant="secondary" onClick={saveClientId}>Save</Button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Origin: <span className="font-mono">{window.location.origin}</span> must be whitelisted</p>
        </div>

        {connected && user ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl p-3">
              <div className="flex items-center gap-3">
                {user.picture ? <img src={user.picture} alt="user" className="w-9 h-9 rounded-full" /> : <div className="w-9 h-9 rounded-full bg-[#22c55e] flex items-center justify-center text-white font-bold">{user.name[0]}</div>}
                <div>
                  <p className="text-[13px] font-medium">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.email} • Connected</p>
                  {lastBackup && <p className="text-[10px] text-[#22c55e]">Last backup: {new Date(lastBackup).toLocaleString()}</p>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-[#ef4444]">Disconnect</Button>
            </div>
            {driveFiles.length>0 && (
              <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
                <p className="text-[11px] font-medium text-slate-300">Files in Drive/EMI_Tracker_Backup</p>
                <div className="mt-2 space-y-1">
                  {driveFiles.map((f:any)=>(
                    <div key={f.id} className="flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>{f.name}</span><span>{f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#0f172a] rounded-xl p-4 border border-[#334155] space-y-3">
            <p className="text-[13px] text-slate-400">Not connected to Google Drive</p>
            <Button className="w-full" onClick={handleConnect}>Connect Google Drive</Button>
            {connectError && <p className="text-[11px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-2">{connectError}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
            <p className="text-[12px] font-medium">Drive Folder Structure</p>
            <pre className="text-[11px] text-slate-500 mt-2 font-mono whitespace-pre">EMI_Tracker_Backup/
├── EMI_Tracker_Latest.xlsx
├── EMI_Tracker_Latest.json
└── EMI_Tracker_Latest.csv</pre>
          </div>
          <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]/30">
            <p className="text-[12px] font-medium">Auto Backup</p>
            <p className="text-[11px] text-slate-500 mt-1">Daily at 02:00 AM if 23 hours passed since last backup</p>
            {backupProgress && <p className="text-[11px] text-[#3b82f6] mt-1">{backupProgress}</p>}
            <Button size="sm" className="mt-2 w-full" loading={loadingBackup} onClick={handleManualBackup} disabled={!connected}>
              {connected ? 'Backup Now' : 'Connect Drive First'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-[15px] flex items-center gap-2"><span>🔔</span> Reminder Settings</h3>
        <div className="space-y-3">
          <label className="text-[13px] font-medium">Default Reminder Days</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {[1,2,3,5,7,15,30].map(d=>(
              <button key={d} onClick={()=> setReminderDays(prev=> prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d].sort((a,b)=>a-b))} className={`px-3 py-1.5 rounded-full text-[12px] border ${reminderDays.includes(d) ? 'bg-[#22c55e] text-white border-[#22c55e]' : 'bg-[#0f172a] text-slate-400 border-[#334155]'}`}>{d} days</button>
            ))}
            <button onClick={()=>{
              const c = prompt('Custom days comma separated');
              if(c){
                const nums = c.split(',').map(n=>parseInt(n.trim())).filter(n=>!isNaN(n)&&n>=0&&n<=365);
                if(nums.length) setReminderDays(prev=>[...new Set([...prev,...nums])].sort((a,b)=>a-b));
              }
            }} className="px-3 py-1.5 rounded-full text-[12px] border border-dashed border-[#475569] bg-[#0f172a] text-slate-400">+ Custom</button>
          </div>
          <Button size="sm" variant="secondary" onClick={saveReminderSettings}>Save</Button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a] border border-[#334155]/30">
          <div>
            <p className="text-[13px] font-medium">Browser Notifications</p>
            <p className="text-[11px] text-slate-500">Receive system notifications for due reminders</p>
          </div>
          <button onClick={toggleBrowserNotif} className={`w-11 h-6 rounded-full p-1 transition-colors ${browserNotif ? 'bg-[#22c55e]' : 'bg-[#334155]'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${browserNotif ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-[15px]">Backup & Restore</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button variant="secondary" size="sm" onClick={()=>exportExcel()}>Export Excel</Button>
          <Button variant="secondary" size="sm" onClick={()=>exportCSV()}>Export CSV</Button>
          <Button variant="secondary" size="sm" onClick={()=>exportJSON()}>Export JSON</Button>
        </div>
        <div className="pt-3 border-t border-[#334155]/30">
          <label className="text-[13px] font-medium">Restore from Backup</label>
          <input type="file" accept=".json" onChange={handleRestore} className="mt-2 block w-full text-[12px] text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-[#1e293b] file:text-slate-200 file:text-[12px] hover:file:bg-[#334155]" />
          <p className="text-[11px] text-slate-500 mt-1">{importing ? 'Importing...' : 'Select JSON backup file'}</p>
        </div>
      </Card>

      <Card className="p-5 border-[#ef4444]/20">
        <h3 className="font-semibold text-[15px] text-[#ef4444] flex items-center gap-2">⚠️ Danger Zone</h3>
        <p className="text-[12px] text-slate-500 mt-2">Permanently delete all local data. This cannot be undone.</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant={showDanger>=2 ? 'danger' : 'secondary'} onClick={clearAllData}>
            {showDanger===0 && 'Clear All Data'}
            {showDanger===1 && 'Confirm Clear (2/3)'}
            {showDanger===2 && 'Final Confirmation (3/3)'}
          </Button>
          {showDanger>0 && <Button variant="ghost" size="sm" onClick={()=>setShowDanger(0)}>Cancel</Button>}
        </div>
      </Card>

      <div className="text-center py-6">
        <p className="text-[12px] text-slate-600">EMI Tracker Pro v1.0 • Offline First • PWA Ready</p>
        <p className="text-[11px] text-slate-700 mt-1">React 19 • Dexie • Recharts • ExcelJS</p>
      </div>
    </div>
  );
}

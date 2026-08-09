import React, { useState, useEffect } from 'react';
import { Users, X, UserPlus, Link, Shield, Award, Clock, BookOpen, Flame, Activity, Copy, Check, AlertCircle, Sparkles, Edit2, UserCheck, Save } from 'lucide-react';
import { db, saveProgressToCloud } from '../lib/db';
import { auth, onAuthUserChanged } from '../lib/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const StudyBuddyHub: React.FC<{
  currentUserStats: {
    hoursLoggedToday: number;
    firstReadPercent: number;
    rev1Percent: number;
    streakDays?: number;
  }
}> = ({ currentUserStats }) => {
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [buddyCodeInput, setBuddyCodeInput] = useState('');
  const [buddyNameInput, setBuddyNameInput] = useState('');
  const [buddies, setBuddies] = useState<any[]>([]);
  const [buddyIds, setBuddyIds] = useState<string[]>([]);
  const [nicknames, setNicknames] = useState<{ [id: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User's own real name state
  const [myName, setMyName] = useState<string>(() => {
    return typeof window !== 'undefined' 
      ? localStorage.getItem('ca_companion_display_name') || auth.currentUser?.displayName || ''
      : auth.currentUser?.displayName || '';
  });
  const [isEditingMyName, setIsEditingMyName] = useState(false);

  // Inline buddy editing
  const [editingBuddyId, setEditingBuddyId] = useState<string | null>(null);
  const [tempNickname, setTempNickname] = useState('');

  // Subscribe to auth state changes
  useEffect(() => {
    const unsub = onAuthUserChanged((u) => {
      setCurrentUser(u);
      if (u) {
        const saved = localStorage.getItem('ca_companion_display_name');
        if (saved) setMyName(saved);
        else if (u.displayName) setMyName(u.displayName);
      }
    });
    return () => unsub();
  }, []);

  // Sync user's stats on mount
  useEffect(() => {
    if (currentUser) {
      saveProgressToCloud();
    }
  }, [currentUser]);

  // Listen for user's saved buddy ID list & custom nicknames
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const userId = currentUser.uid;
    const buddyLinkRef = doc(db, 'users', userId, 'ca_final_state', 'buddies');
    
    const unsubscribeLink = onSnapshot(buddyLinkRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.buddyIds)) {
          setBuddyIds(data.buddyIds);
        } else {
          setBuddyIds([]);
        }
        if (data.nicknames && typeof data.nicknames === 'object') {
          setNicknames(data.nicknames);
        } else {
          setNicknames({});
        }
      } else {
        setBuddyIds([]);
        setNicknames({});
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching buddy links:', err);
      setLoading(false);
    });

    return () => unsubscribeLink();
  }, [currentUser]);

  // Listen for stats of each buddy
  useEffect(() => {
    if (buddyIds.length === 0) {
      setBuddies([]);
      return;
    }
    
    const unsubscribes = buddyIds.map(buddyId => {
      const publicRef = doc(db, 'public_stats', buddyId);
      return onSnapshot(publicRef, (docSnap) => {
        if (docSnap.exists()) {
          const stats = docSnap.data();
          setBuddies(prev => {
            const filtered = prev.filter(b => b.id !== buddyId);
            return [...filtered, { id: buddyId, ...stats }];
          });
        } else {
          setBuddies(prev => {
            const filtered = prev.filter(b => b.id !== buddyId);
            return [...filtered, { 
              id: buddyId, 
              displayName: `Buddy (${buddyId.slice(0, 6)}...)`,
              hoursLoggedToday: 0,
              firstReadPercent: 0,
              rev1Percent: 0,
              
              isPending: true
            }];
          });
        }
      }, (err) => {
        console.warn(`Could not listen to stats for buddy ${buddyId}:`, err);
        setBuddies(prev => {
          const filtered = prev.filter(b => b.id !== buddyId);
          return [...filtered, { 
            id: buddyId, 
            displayName: `Buddy (${buddyId.slice(0, 6)}...)`,
            hoursLoggedToday: 0,
            firstReadPercent: 0,
            rev1Percent: 0,
            
            isPending: true
          }];
        });
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [buddyIds]);

  const handleSaveMyName = async () => {
    const trimmed = myName.trim();
    if (!trimmed) {
      setStatusMsg({ type: 'error', text: 'Kripya apna real name enter karein.' });
      return;
    }

    if (!currentUser) return;

    try {
      localStorage.setItem('ca_companion_display_name', trimmed);
      
      // Update public_stats document
      const publicStatsRef = doc(db, 'public_stats', currentUser.uid);
      await setDoc(publicStatsRef, {
        displayName: trimmed,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      await saveProgressToCloud();

      setIsEditingMyName(false);
      setStatusMsg({ type: 'success', text: `🎉 Real Name updated to "${trimmed}"! Your buddies will see this name.` });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      setStatusMsg({ type: 'error', text: 'Name update karne me issue aaya.' });
    }
  };

  const handleCopyCode = () => {
    if (!currentUser) return;
    navigator.clipboard.writeText(currentUser.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addBuddy = async (codeToAdd?: string) => {
    const code = (codeToAdd || buddyCodeInput).trim();
    const customName = buddyNameInput.trim();

    if (!code) {
      setStatusMsg({ type: 'error', text: 'Kripya ek valid Buddy Code enter karein.' });
      return;
    }

    if (!currentUser) {
      setStatusMsg({ type: 'error', text: 'User authenticated nahi hai. Kripya page refresh karein.' });
      return;
    }

    const userId = currentUser.uid;
    if (code === userId) {
      setStatusMsg({ type: 'error', text: 'Aap apna hi Buddy Code add nahi kar sakte!' });
      return;
    }

    if (buddyIds.includes(code)) {
      setStatusMsg({ type: 'error', text: 'Yeh Study Buddy pehle se aapki list me added hai!' });
      return;
    }

    try {
      const buddyLinkRef = doc(db, 'users', userId, 'ca_final_state', 'buddies');
      const updatedIds = [...buddyIds, code];
      const updatedNicknames = { ...nicknames };
      if (customName) {
        updatedNicknames[code] = customName;
      }

      await setDoc(buddyLinkRef, { 
        buddyIds: updatedIds,
        nicknames: updatedNicknames
      }, { merge: true });
      
      setBuddyIds(updatedIds);
      setNicknames(updatedNicknames);
      setBuddyCodeInput('');
      setBuddyNameInput('');
      setStatusMsg({ type: 'success', text: customName ? `🎉 Linked ${customName} as your Study Buddy!` : '🎉 Study Buddy successfully linked!' });
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to link buddy:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Buddy add karne me error aaya. Kripya firse try karein.' });
    }
  };

  const saveBuddyNickname = async (buddyId: string) => {
    if (!currentUser) return;
    const userId = currentUser.uid;
    const trimmed = tempNickname.trim();

    try {
      const updatedNicknames = { ...nicknames };
      if (trimmed) {
        updatedNicknames[buddyId] = trimmed;
      } else {
        delete updatedNicknames[buddyId];
      }

      const buddyLinkRef = doc(db, 'users', userId, 'ca_final_state', 'buddies');
      await setDoc(buddyLinkRef, { nicknames: updatedNicknames }, { merge: true });

      setNicknames(updatedNicknames);
      setEditingBuddyId(null);
      setStatusMsg({ type: 'success', text: 'Buddy name updated!' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      console.error('Failed to update nickname:', err);
    }
  };

  const removeBuddy = async (idToRemove: string) => {
    if (!currentUser) return;
    const userId = currentUser.uid;
    try {
      const updatedIds = buddyIds.filter(id => id !== idToRemove);
      const updatedNicknames = { ...nicknames };
      delete updatedNicknames[idToRemove];

      const buddyLinkRef = doc(db, 'users', userId, 'ca_final_state', 'buddies');
      await setDoc(buddyLinkRef, { 
        buddyIds: updatedIds,
        nicknames: updatedNicknames
      }, { merge: true });

      setBuddyIds(updatedIds);
      setNicknames(updatedNicknames);
      setStatusMsg({ type: 'success', text: 'Buddy removed.' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      console.error('Failed to remove buddy:', err);
    }
  };

  if (!currentUser) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-slate-700/50 text-center max-w-md mx-auto my-12 space-y-4">
        <Users className="w-12 h-12 text-[#2dd4bf] mx-auto animate-pulse" />
        <h3 className="text-xl font-bold text-slate-100">Study Buddy Accountability</h3>
        <p className="text-sm text-slate-400">Loading your profile session... If this takes a moment, please ensure you are connected to the app.</p>
      </div>
    );
  }

  const myCode = currentUser.uid;
  const myDisplayTitle = myName.trim() || currentUser.displayName || currentUser.email?.split('@')[0] || 'Aspirant';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Users className="w-6 h-6 text-[#2dd4bf]" />
            Study Buddy Accountability
          </h2>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-teal-400" /> Track daily hours, read progress & streak together in real-time.
          </p>
        </div>
        
        <div className="glass-card bg-slate-900/90 p-3.5 rounded-2xl border border-[#2dd4bf]/30 flex items-center justify-between gap-3 w-full md:w-auto shadow-lg">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Buddy Code:</div>
          <div className="font-mono text-[#2dd4bf] font-bold bg-slate-950 px-3 py-1.5 rounded-lg border border-[#2dd4bf]/40 text-xs tracking-wider select-all">
            {myCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/30 text-[#2dd4bf] text-xs font-bold transition-all border border-[#2dd4bf]/40 cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-sm font-semibold animate-fadeIn ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200' 
            : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <Sparkles className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Buddy Form */}
      <div className="glass-panel p-6 rounded-3xl border border-[#2dd4bf]/30 shadow-xl backdrop-blur-md space-y-4">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-[#2dd4bf]" /> Link Friend's Buddy Code
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              value={buddyCodeInput}
              onChange={e => setBuddyCodeInput(e.target.value)}
              placeholder="Friend's Buddy Code (Required)"
              className="w-full bg-slate-900/80 border border-slate-700/60 focus:border-[#2dd4bf] rounded-xl pl-9 pr-4 py-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 font-mono text-xs"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              value={buddyNameInput}
              onChange={e => setBuddyNameInput(e.target.value)}
              placeholder="Friend's Name (e.g. Rohan Sharma)"
              className="w-full bg-slate-900/80 border border-slate-700/60 focus:border-[#2dd4bf] rounded-xl pl-9 pr-4 py-3 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500"
            />
          </div>

          <button 
            onClick={() => addBuddy()}
            disabled={!buddyCodeInput.trim()}
            className="sm:col-span-2 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-black transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-1.5 cursor-pointer text-sm"
          >
            <Link className="w-4 h-4" /> Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Progress Card */}
        <div className="glass-card p-6 rounded-3xl border border-[#2dd4bf]/40 bg-gradient-to-br from-[#1e293b]/90 to-[#0f172a]/90 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#2dd4bf]/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center justify-between mb-6 border-b border-slate-700/50 pb-4">
            <div className="flex-1">
              {isEditingMyName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={myName}
                    onChange={e => setMyName(e.target.value)}
                    placeholder="Enter your real name"
                    autoFocus
                    className="bg-slate-950 border border-[#2dd4bf] text-slate-100 text-sm font-bold rounded-lg px-2.5 py-1 outline-none"
                  />
                  <button
                    onClick={handleSaveMyName}
                    className="bg-[#2dd4bf] text-slate-950 px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 hover:bg-teal-300"
                  >
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button
                    onClick={() => setIsEditingMyName(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-[#2dd4bf]/20 text-[#2dd4bf] flex items-center justify-center text-sm font-black border border-[#2dd4bf]/40 shrink-0">
                    {myDisplayTitle.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                      <span>{myDisplayTitle}</span>
                      <button 
                        onClick={() => setIsEditingMyName(true)}
                        className="text-slate-500 hover:text-[#2dd4bf] transition-colors p-1"
                        title="Edit Your Display Name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </h3>
                    <p className="text-[11px] text-[#2dd4bf] font-medium">Your Profile (Shared with buddies)</p>
                  </div>
                </div>
              )}
            </div>

            {currentUserStats.hoursLoggedToday >= 8 && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-950/90 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1 shrink-0 ml-2">
                <Award className="w-3 h-3" /> Target Met
              </span>
            )}
          </div>
          
          <div className="space-y-4 z-10 relative">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-400" /> Today's Hours</span>
              <span className="font-mono font-bold text-xl tracking-tight text-[#2dd4bf]">{currentUserStats.hoursLoggedToday.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" /> Rev 1 Progress</span>
              <span className="font-mono font-bold text-xl tracking-tight text-slate-100">{currentUserStats.rev1Percent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 flex items-center gap-2"><Flame className="w-4 h-4 text-amber-400" /> Active Streak</span>
              <span className="font-mono font-bold text-xl tracking-tight text-[#2dd4bf]">{currentUserStats.streakDays || 0} Days</span>
            </div>
          </div>
        </div>

        {/* Buddy Cards */}
        {loading ? (
          <div className="glass-card p-6 rounded-3xl border border-slate-700/50 flex items-center justify-center text-slate-400">
            Loading buddies...
          </div>
        ) : buddies.length === 0 ? (
          <div className="glass-card p-6 rounded-3xl border border-dashed border-slate-700/50 flex flex-col items-center justify-center text-center space-y-3 bg-slate-900/30">
            <Users className="w-10 h-10 text-slate-600 mb-1" />
            <p className="text-slate-300 font-bold">No buddies linked yet.</p>
            <p className="text-xs text-slate-400 max-w-xs">Share your Buddy Code above with a CA Final aspirant or paste their code to track study goals together!</p>
          </div>
        ) : (
          buddies.map(buddy => {
            const displayName = nicknames[buddy.id] || buddy.displayName || `Buddy (${buddy.id.slice(0, 6)}...)`;
            const isEditingThisBuddy = editingBuddyId === buddy.id;

            return (
              <div key={buddy.id} className="glass-card p-6 rounded-3xl border border-[#2dd4bf]/30 bg-gradient-to-br from-slate-900/95 to-slate-950/95 relative overflow-hidden shadow-2xl">
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#2dd4bf]/10 rounded-full blur-2xl"></div>
                
                <button 
                  onClick={() => removeBuddy(buddy.id)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-slate-800"
                  title="Remove Buddy"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between mb-6 border-b border-slate-700/50 pb-4 pr-6">
                  {isEditingThisBuddy ? (
                    <div className="flex items-center gap-2 w-full pr-2">
                      <input
                        type="text"
                        value={tempNickname}
                        onChange={e => setTempNickname(e.target.value)}
                        placeholder="Friend's Name"
                        autoFocus
                        className="bg-slate-950 border border-[#2dd4bf] text-slate-100 text-sm font-bold rounded-lg px-2 py-1 outline-none w-full"
                      />
                      <button
                        onClick={() => saveBuddyNickname(buddy.id)}
                        className="bg-[#2dd4bf] text-slate-950 px-2 py-1 rounded-lg text-xs font-bold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBuddyId(null)}
                        className="text-slate-400 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-teal-900/60 text-[#2dd4bf] flex items-center justify-center text-sm font-bold border border-[#2dd4bf]/40 shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{displayName}</span>
                          <button
                            onClick={() => {
                              setEditingBuddyId(buddy.id);
                              setTempNickname(nicknames[buddy.id] || buddy.displayName || '');
                            }}
                            className="text-slate-500 hover:text-[#2dd4bf] transition-colors p-0.5"
                            title="Edit Friend's Name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </h3>
                        <p className="text-[10px] font-mono text-slate-500">ID: {buddy.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  )}

                  {buddy.hoursLoggedToday >= 8 && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-950/90 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1 shrink-0 ml-2">
                      <Award className="w-3 h-3" /> Target Met
                    </span>
                  )}
                </div>
                
                <div className="space-y-4 z-10 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-400" /> Today's Hours</span>
                    <span className="font-mono font-bold text-xl tracking-tight text-[#2dd4bf]">{(buddy.hoursLoggedToday || 0).toFixed(1)}h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" /> Rev 1 Progress</span>
                    <span className="font-mono font-bold text-xl tracking-tight text-slate-100">{buddy.rev1Percent || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400 flex items-center gap-2"><Flame className="w-4 h-4 text-amber-400" /> Active Streak</span>
                    <span className="font-mono font-bold text-xl tracking-tight text-[#2dd4bf]">{buddy.streakDays || 0} Days</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

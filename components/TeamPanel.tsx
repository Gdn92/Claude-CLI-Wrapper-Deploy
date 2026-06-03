'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { wsClient } from '@/lib/ws-client'

const COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500']

export function TeamPanel() {
  const {
    teamPanelOpen, setTeamPanelOpen,
    teamId, setTeamId,
    sessionId, teamSessions,
  } = useStore()
  const [newTeamId, setNewTeamId] = useState('')

  function joinTeam() {
    // Generate random team ID if user left blank
    const id = newTeamId.trim() || `team-${Math.random().toString(36).slice(2, 7)}`
    setTeamId(id)
    wsClient.send('team_join', { teamId: id })
    setNewTeamId('')
  }

  function forwardTo(targetSessionId: string) {
    const content = prompt('Message to forward to this agent:')
    if (!content) return
    wsClient.send('team_forward', { targetSessionId, content })
  }

  function pipeTo(targetSessionId: string) {
    const raw = prompt('Raw input to pipe to pty stdin:')
    if (!raw) return
    wsClient.send('team_pipe', { targetSessionId, raw })
  }

  if (!teamPanelOpen) {
    return (
      <button
        onClick={() => setTeamPanelOpen(true)}
        className="fixed bottom-4 right-4 bg-neutral-800 text-white text-xs px-3 py-2 rounded-full border border-neutral-700 hover:bg-neutral-700 transition-colors shadow-lg z-50"
      >
        Team{teamId ? ` · ${teamId}` : ''}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-64 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl text-xs z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-neutral-300 font-medium">Agent Team</span>
        <button
          onClick={() => setTeamPanelOpen(false)}
          className="text-neutral-500 hover:text-white"
          aria-label="Close team panel"
        >
          x
        </button>
      </div>

      {!teamId ? (
        <div className="p-3 flex gap-2">
          <input
            value={newTeamId}
            onChange={e => setNewTeamId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinTeam()}
            placeholder="Team ID (blank = random)"
            className="flex-1 bg-neutral-800 text-white px-2 py-1 rounded text-xs border border-neutral-700 outline-none focus:border-neutral-500"
          />
          <button
            onClick={joinTeam}
            className="bg-white text-black px-2 py-1 rounded text-xs font-medium hover:bg-neutral-200"
          >
            Join
          </button>
        </div>
      ) : (
        <div className="p-3">
          <div className="text-neutral-500 mb-2">
            Team: <span className="text-neutral-200 font-mono">{teamId}</span>
          </div>
          <div className="space-y-2">
            {teamSessions.map((s, i) => (
              <div key={s.sessionId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLORS[i % COLORS.length]}`} />
                  <span className="text-neutral-300 font-mono truncate max-w-[80px]">
                    {s.sessionId.slice(0, 8)}
                  </span>
                  <span className={s.alive ? 'text-green-400' : 'text-neutral-600'}>
                    {s.alive ? 'running' : 'idle'}
                  </span>
                </div>
                {s.sessionId !== sessionId && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => forwardTo(s.sessionId)}
                      className="text-neutral-500 hover:text-blue-400 transition-colors"
                      title="Forward message"
                    >
                      fwd
                    </button>
                    <button
                      onClick={() => pipeTo(s.sessionId)}
                      className="text-neutral-500 hover:text-orange-400 transition-colors"
                      title="Pipe to stdin"
                    >
                      pipe
                    </button>
                  </div>
                )}
                {s.sessionId === sessionId && (
                  <span className="text-neutral-600 text-xs">you</span>
                )}
              </div>
            ))}
            {teamSessions.length === 0 && (
              <p className="text-neutral-600 leading-relaxed">
                No other sessions yet. Open a new tab and join team <span className="font-mono text-neutral-400">{teamId}</span>.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

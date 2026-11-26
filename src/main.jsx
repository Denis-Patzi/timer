import React from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import '../styles.css'
import './react.css'
import './screen.css'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabase = url && key && !url.includes('your-project') ? createClient(url, key) : null
const symbols = ['⭐', '🌉', '⚓', '🏆']
const fmt = (ms) => { if (ms == null || !Number.isFinite(ms)) return '—'; const c = Math.floor(ms / 10); return `${String(Math.floor(c / 6000)).padStart(2, '0')}:${String(Math.floor(c / 100) % 60).padStart(2, '0')}.${String(c % 100).padStart(2, '0')}` }
const minTime = (team) => team.attempts?.filter((a) => a.time_ms != null).reduce((min, a) => Math.min(min, a.time_ms), Infinity) ?? Infinity

function App() {
  const [teams, setTeams] = React.useState([])
  const [settings, setSettings] = React.useState({ time_limit_seconds: 180, camera_url: '', timer_theme: 'amber' })
  const [selected, setSelected] = React.useState(null)
  const [dialog, setDialog] = React.useState(null)
  const [cameraUrl, setCameraUrl] = React.useState('')
  const [cameraError, setCameraError] = React.useState(false)
  const [connection, setConnection] = React.useState(supabase ? 'Conectando…' : 'Falta configurar Supabase')
  const [error, setError] = React.useState('')
  const current = teams.find((t) => t.id === selected)

  const load = React.useCallback(async () => {
    if (!supabase) return
    const [teamResult, attemptResult, settingResult] = await Promise.all([
      supabase.from('teams').select('*').order('created_at'),
      supabase.from('team_attempts').select('*'),
      supabase.from('competition_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    const failure = teamResult.error || attemptResult.error || settingResult.error
    if (failure) { setConnection('Error de Supabase'); setError(failure.message); return }
    const attempts = attemptResult.data || []
    const nextTeams = (teamResult.data || []).map((team) => ({ ...team, attempts: [1, 2, 3].map((n) => attempts.find((a) => a.team_id === team.id && a.attempt_number === n) || { attempt_number: n, time_ms: null }) }))
    setTeams(nextTeams); setSelected((previous) => nextTeams.some((t) => t.id === previous) ? previous : nextTeams[0]?.id || null)
    if (settingResult.data) { setSettings(settingResult.data); setCameraUrl(settingResult.data.camera_url || '') }
    setConnection('Supabase conectado'); setError('')
  }, [])

  React.useEffect(() => {
    if (!supabase) return
    load()
    const channel = supabase.channel('tracktime-changes').on('postgres_changes', { event: '*', schema: 'public' }, load).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function saveSettings(values) {
    if (!supabase) return
    const { error: saveError } = await supabase.from('competition_settings').upsert({ id: 1, ...values, updated_at: new Date().toISOString() })
    if (saveError) setError(saveError.message)
    else { setSettings((s) => ({ ...s, ...values })); setError('') }
  }
  async function saveTeam(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    const payload = { name: String(form.get('name')).trim(), members: String(form.get('members')).split(',').map((x) => x.trim()).filter(Boolean), badges: dialog?.team?.badges || [] }
    if (!payload.name) return
    const request = dialog?.team ? supabase.from('teams').update(payload).eq('id', dialog.team.id) : supabase.from('teams').insert(payload).select().single()
    const { data, error: saveError } = await request
    if (saveError) { setError(saveError.message); return }
    setDialog(null); await load(); if (data?.id) setSelected(data.id)
  }
  async function deleteTeam(team) {
    if (!confirm(`¿Eliminar el equipo ${team.name} y sus intentos?`)) return
    const { error: deleteError } = await supabase.from('teams').delete().eq('id', team.id)
    if (deleteError) setError(deleteError.message); else await load()
  }
  async function changeBadge(team, badge) {
    const badges = team.badges.includes(badge) ? team.badges.filter((b) => b !== badge) : [...team.badges, badge]
    const { error: saveError } = await supabase.from('teams').update({ badges }).eq('id', team.id)
    if (saveError) setError(saveError.message); else await load()
  }
  async function setAttempt(team, index, time) {
    const { error: saveError } = await supabase.from('team_attempts').upsert({ team_id: team.id, attempt_number: index + 1, time_ms: time }, { onConflict: 'team_id,attempt_number' })
    if (saveError) setError(saveError.message); else await load()
  }
  function openTimer(team, attempt) {
    const target = new URL(location.pathname, location.href)
    target.searchParams.set('display', '1')
    if (team) { target.searchParams.set('team', team.id); target.searchParams.set('attempt', String(attempt)) }
    const win = window.open(target.href, '_blank')
    if (!win) { location.assign(target.href); return }
    if (team) { const channel = new BroadcastChannel('tracktime'); setTimeout(() => { channel.postMessage({ type: 'start', teamId: team.id, attempt }); channel.close() }, 900) }
  }

  if (new URLSearchParams(location.search).has('display')) return <Timer supabase={supabase} />

  return <main className="app-shell"><header className="topbar"><div className="brand"><img src="/logo_castillo.png" alt="Universidad" /><div><p className="eyebrow">UNIVERSIDAD · ROBÓTICA</p><h1>TRACK<span>TIME</span></h1></div></div><div className="event-name"><span className="live-dot" />COMPETENCIA DE SEGUIDORES DE LÍNEA</div><button className="button button-outline" onClick={() => openTimer()}>↗ &nbsp;Abrir pantalla del timer</button></header>
    <div className="connection-line"><span className={connection === 'Supabase conectado' ? 'live-dot' : 'connection-dot'} />{connection}{error && <span className="error-text">{error}</span>}</div>
    <section className="workspace"><aside className="left-column"><section className="card camera-card"><div className="section-heading"><div><p className="eyebrow">01 / VISTA DE PISTA</p><h2>Cámara IP</h2></div><span className={`status ${settings.camera_url && !cameraError ? 'connected' : ''}`}>{settings.camera_url && !cameraError ? 'CONECTADA' : 'SIN SEÑAL'}</span></div><div className="camera-screen"><img src={settings.camera_url || undefined} alt="Vista en vivo de la pista" onLoad={() => setCameraError(false)} onError={() => setCameraError(true)} style={{ display: settings.camera_url && !cameraError ? 'block' : 'none' }} /><div className="camera-empty" style={{ display: settings.camera_url && !cameraError ? 'none' : 'grid' }}><span className="camera-icon">◉</span><strong>Conecta una cámara</strong><small>Stream MJPEG o imagen accesible desde el navegador</small></div><div className="camera-overlay"><span>● <b>LIVE</b></span><span>PISTA 01</span></div></div><label className="camera-label">URL DE CÁMARA / SNAPSHOT</label><div className="input-row"><input value={cameraUrl} onChange={(e) => setCameraUrl(e.target.value)} placeholder="http://192.168.1.50/video.mjpg" /><button className="button button-small" onClick={() => saveSettings({ camera_url: cameraUrl })}>Guardar</button></div><p className="hint">El análisis automático del stream requiere que la cámara permita acceso CORS.</p></section>
      <section className="card teams-card"><div className="section-heading"><div><p className="eyebrow">02 / PARTICIPANTES</p><h2>Equipos <span className="count">{teams.length}</span></h2></div><button className="button button-small" onClick={() => setDialog({})} disabled={!supabase}>＋ Nuevo equipo</button></div><div className="team-list">{teams.length ? teams.map((team) => <button className={`team-row ${team.id === selected ? 'selected' : ''}`} key={team.id} onClick={() => setSelected(team.id)}><span><strong>{team.badges.join(' ')} {team.name}</strong><small>{team.members.length} integrantes</small></span><span className="team-best">{fmt(minTime(team))}</span></button>) : <div className="empty-list">{supabase ? 'Aún no hay equipos registrados.' : 'Configura Supabase para empezar.'}</div>}</div></section></aside>
      <section className="card detail-card">{current ? <><div className="detail-top"><div><p className="eyebrow">FICHA DEL COMPETIDOR</p><h2>{current.badges.join(' ')} {current.name}</h2><div className="team-members">{current.members.join(' · ') || 'Sin integrantes registrados'}</div></div><div className="detail-actions"><button className="icon-button" onClick={() => setDialog({ team: current })}>✎</button><button className="icon-button" onClick={() => deleteTeam(current)}>⌫</button></div></div><div className="attempt-title"><h3>Tiempos de carrera</h3><span>3 OPORTUNIDADES</span></div><div className="attempt-list">{current.attempts.map((attempt, i) => <div className="attempt" key={i}><span className="attempt-number">0{i + 1}</span><span className={`attempt-time ${attempt.time_ms == null ? 'empty' : ''}`}>{attempt.time_ms == null ? 'Sin tiempo' : fmt(attempt.time_ms)}</span><div className="attempt-actions"><button className="icon-button" title="Editar tiempo" onClick={() => { const val = prompt('Tiempo MM:SS.cc; vacío para borrar', fmt(attempt.time_ms)); if (val === null) return; if (!val.trim()) setAttempt(current, i, null); else { const m = val.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/); if (!m) return alert('Usa MM:SS.cc'); setAttempt(current, i, ((+m[1] * 60 + +m[2]) * 1000) + +(m[3] || '0').padEnd(2, '0') * 10) } }}>✎</button><button className="icon-button" title="Borrar tiempo" onClick={() => setAttempt(current, i, null)}>×</button><button className="icon-button" title="Iniciar intento" onClick={() => openTimer(current, i + 1)}>▶</button></div></div>)}</div><div className="best-banner"><span className="best-star">★</span><div><small>MEJOR TIEMPO</small><strong>{fmt(minTime(current))}</strong></div><span className="best-label">RANKING</span></div><div className="setting-grid"><label>LÍMITE POR CARRERA<select value={[120, 180, 300].includes(settings.time_limit_seconds) ? settings.time_limit_seconds : 'custom'} onChange={(e) => e.target.value !== 'custom' && saveSettings({ time_limit_seconds: +e.target.value })}><option value="120">2 minutos</option><option value="180">3 minutos</option><option value="300">5 minutos</option><option value="custom">Personalizado</option></select></label><label>TEMA DEL TIMER<select value={settings.timer_theme} onChange={(e) => saveSettings({ timer_theme: e.target.value })}><option value="amber">LED ámbar</option><option value="ice">Hielo</option><option value="lime">Lima</option><option value="red">Rojo</option></select></label></div>{![120, 180, 300].includes(settings.time_limit_seconds) && <label className="custom-limit">LÍMITE EN MINUTOS<input type="number" min="1" max="60" value={Math.round(settings.time_limit_seconds / 60)} onChange={(e) => saveSettings({ time_limit_seconds: Math.max(1, +e.target.value) * 60 })} /></label>}<div className="badges">Reconocimiento: {symbols.map((badge) => <button className={`badge ${current.badges.includes(badge) ? 'active' : ''}`} key={badge} onClick={() => changeBadge(current, badge)}>{badge}</button>)}</div><div className="timer-launch"><p><strong>Pantalla de competencia</strong>Timer y ranking en vivo</p><button className="button button-small" onClick={() => openTimer()}>↗ Abrir timer</button></div></> : <div className="detail-empty"><span className="symbol">◌</span><strong>Selecciona un equipo</strong><span>Administra integrantes, intentos y reconocimientos</span></div>}</section></section>
    <footer className="footer"><span>TRACKTIME · CONTROL DE COMPETENCIA</span><span>BASE DE DATOS SUPABASE</span></footer>
    {dialog && <div className="modal-backdrop"><form className="team-dialog" onSubmit={saveTeam}><div className="dialog-head"><div><p className="eyebrow">REGISTRO DE COMPETENCIA</p><h2>{dialog.team ? 'Editar equipo' : 'Nuevo equipo'}</h2></div><button type="button" className="icon-button" onClick={() => setDialog(null)}>×</button></div><label>Nombre del equipo<input name="name" required maxLength="48" defaultValue={dialog.team?.name || ''} /></label><label>Integrantes · separados por coma<textarea name="members" rows="3" defaultValue={dialog.team?.members.join(', ') || ''} /></label><div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setDialog(null)}>Cancelar</button><button className="button">Guardar equipo</button></div></form></div>}
  </main>
}

function Timer({ supabase: client }) {
  const [teams, setTeams] = React.useState([]); const [settings, setSettings] = React.useState({ time_limit_seconds: 180, camera_url: '', timer_theme: 'amber' })
  const [running, setRunning] = React.useState(false); const [start, setStart] = React.useState(0); const [elapsed, setElapsed] = React.useState(0); const [active, setActive] = React.useState(null); const [attempt, setAttempt] = React.useState(1); const [status, setStatus] = React.useState('LISTO PARA LA CARRERA')
  const refresh = React.useCallback(async () => { if (!client) return; const [t, a, s] = await Promise.all([client.from('teams').select('*'), client.from('team_attempts').select('*'), client.from('competition_settings').select('*').eq('id', 1).maybeSingle()]); if (!t.error && !a.error) setTeams(t.data.map((team) => ({ ...team, attempts: [1, 2, 3].map((n) => a.data.find((x) => x.team_id === team.id && x.attempt_number === n)?.time_ms ?? null) }))); if (s.data) setSettings(s.data) }, [client])
  React.useEffect(() => { if (!client) return; refresh(); const channel = client.channel('tracktime-display').on('postgres_changes', { event: '*', schema: 'public' }, refresh).subscribe(); return () => client.removeChannel(channel) }, [client, refresh])
  React.useEffect(() => { const bc = new BroadcastChannel('tracktime'); bc.onmessage = (e) => { if (e.data?.type === 'start') { setActive(e.data.teamId); setAttempt(e.data.attempt); setElapsed(0); setStart(performance.now()); setRunning(true); setStatus('EN CARRERA · ESPACIO PARA DETENER') } }; return () => bc.close() }, [])
  const queryStartHandled = React.useRef(false)
  React.useEffect(() => { const params = new URLSearchParams(location.search); const teamId = params.get('team'); if (queryStartHandled.current || !teamId || !teams.some((team) => team.id === teamId)) return; queryStartHandled.current = true; setActive(teamId); setAttempt(Number(params.get('attempt')) || 1); setStart(performance.now()); setElapsed(0); setRunning(true); setStatus('EN CARRERA · ESPACIO PARA DETENER') }, [teams])
  React.useEffect(() => { if (!running) return; let frame; const tick = () => { const ms = performance.now() - start; setElapsed(ms); if (ms >= settings.time_limit_seconds * 1000) finish(true); else frame = requestAnimationFrame(tick) }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame) }, [running, start, settings.time_limit_seconds])
  async function finish(timeout = false) { if (!running) return; const ms = Math.round(performance.now() - start); setElapsed(ms); setRunning(false); setStatus(timeout ? 'LÍMITE ALCANZADO · TIEMPO GUARDADO' : 'META · TIEMPO REGISTRADO'); if (client && active) { const { error: saveError } = await client.from('team_attempts').upsert({ team_id: active, attempt_number: attempt, time_ms: ms }, { onConflict: 'team_id,attempt_number' }); if (saveError) setStatus(`ERROR DE GUARDADO: ${saveError.message}`); else refresh() } }
  React.useEffect(() => { const listener = (e) => { if (e.code === 'Space') { e.preventDefault(); if (running) finish(); else { const id = active || teams[0]?.id; if (!id) return setStatus('REGISTRA UN EQUIPO EN EL PANEL'); setActive(id); setStart(performance.now()); setRunning(true); setStatus('EN CARRERA · ESPACIO PARA DETENER') } } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener) }, [running, active, attempt, teams, start])
  const ranked = teams.filter((t) => t.attempts.some((x) => x != null)).sort((a, b) => Math.min(...a.attempts.filter((x) => x != null)) - Math.min(...b.attempts.filter((x) => x != null)))
  const selectedTeam = teams.find((t) => t.id === active)
  return <main className={`screen ${settings.timer_theme}`}><header className="screen-head"><div className="screen-identity"><img className="screen-seal" src="/logo_castillo.png" alt="Escudo de la universidad"/><span className="screen-brand">TRACK<b>TIME</b></span><img className="screen-event-logo" src="/competencia.jpeg" alt="Afiche de Robo Challenge 2.0"/></div><span className="race-team">{selectedTeam?.name.toUpperCase() || 'COMPETENCIA DE SEGUIDORES DE LÍNEA'}</span><div className="screen-actions"><button className="button button-outline" onClick={() => location.assign(location.pathname)}>← Panel</button><button className="button button-outline" onClick={() => document.documentElement.requestFullscreen?.()}>⛶ Pantalla completa</button></div></header><section className="screen-content"><div className="race"><div className="race-team">{selectedTeam?.name || 'SEGUIDORES DE LÍNEA'}</div><div className="digits">{fmt(elapsed)}</div><div className="race-status">{status}</div><div className="controls"><button onClick={() => { if (running) finish(); else { const id = active || teams[0]?.id; if (!id) return setStatus('REGISTRA UN EQUIPO EN EL PANEL'); setActive(id); setStart(performance.now()); setRunning(true); setStatus('EN CARRERA · ESPACIO PARA DETENER') } }}>{running ? '■  DETENER / META' : '▶  INICIAR'}</button><button className="secondary" onClick={() => { setRunning(false); setElapsed(0); setStatus('TIEMPO REINICIADO') }}>↺  REINICIAR</button></div></div><aside className="side"><div className="leaderboard"><div className="side-title">🏆 &nbsp; MEJORES TIEMPOS</div>{ranked.length ? ranked.slice(0, 8).map((t, i) => <div className="rank" key={t.id}><span className="rank-num">0{i + 1}</span><strong>{t.badges.join(' ')} {t.name}</strong><em>{fmt(Math.min(...t.attempts.filter((x) => x != null)))}</em></div>) : <p className="empty-ranks">Los mejores tiempos aparecerán aquí</p>}</div><div className="preview">{settings.camera_url ? <img src={settings.camera_url} alt="Pista" /> : <div className="placeholder">VISTA DE PISTA<br />Configura cámara desde el panel</div>}<label>● LIVE / PISTA 01</label></div></aside></section><footer className="screen-foot"><span>COMPETENCIA UNIVERSITARIA DE ROBÓTICA</span><span>LÍMITE {fmt(settings.time_limit_seconds * 1000).slice(0, 5)}</span></footer></main>
}

createRoot(document.getElementById('root')).render(<App />)

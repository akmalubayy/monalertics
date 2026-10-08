'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Monitor as MonitorIcon, Clock, Activity } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatRelativeTime } from '@/lib/utils'

interface Monitor {
  id: string
  name: string
  type: string
  target: string
  intervalSeconds: number
  isActive: boolean
  lastStatus: string
  lastCheckedAt: string | null
  sslExpiry?: string | null
  sslIssuer?: string | null
  sslSubject?: string | null
  sslDaysUntilExpiry?: number | null
  domainExpiry?: string | null
  domainRegistrar?: string | null
  domainDaysUntilExpiry?: number | null
}

function statusVariant(s: string): 'up' | 'down' | 'warning' | 'unknown' {
  if (s === 'UP') return 'up'
  if (s === 'DOWN') return 'down'
  if (s === 'WARNING') return 'warning'
  return 'unknown'
}

function statusIcon(s: string) {
  if (s === 'UP') return '✓'
  if (s === 'DOWN') return '✗'
  if (s === 'WARNING') return '⚠'
  return '?'
}

function statusBgColor(s: string): string {
  if (s === 'UP') return 'bg-green-500/10 border-green-500/30'
  if (s === 'DOWN') return 'bg-red-500/10 border-red-500/30'
  if (s === 'WARNING') return 'bg-yellow-500/10 border-yellow-500/30'
  return 'bg-slate-500/10 border-slate-500/30'
}

function statusTextColor(s: string): string {
  if (s === 'UP') return 'text-green-400'
  if (s === 'DOWN') return 'text-red-400'
  if (s === 'WARNING') return 'text-yellow-400'
  return 'text-slate-400'
}

type StatusFilter = 'ALL' | 'UP' | 'DOWN' | 'WARNING' | 'UNKNOWN'

export default function PublicMonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL')

  useEffect(() => {
    loadMonitors()
    const interval = setInterval(loadMonitors, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadMonitors() {
    try {
      const res = await fetch('/api/public/monitors')
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || 'Gagal memuat monitor')
        return
      }
      setMonitors(data.monitors ?? [])
      setError('')
    } catch (err) {
      setError('Gagal memuat data monitor')
    } finally {
      setLoading(false)
    }
  }

  const filteredMonitors = useMemo(() => {
    return monitors.filter((m) => {
      const term = searchTerm.toLowerCase()
      const matchesSearch = (
        m.name.toLowerCase().includes(term) ||
        m.target.toLowerCase().includes(term) ||
        m.type.toLowerCase().includes(term)
      )
      const matchesStatus = selectedStatus === 'ALL' || m.lastStatus === selectedStatus
      return matchesSearch && matchesStatus
    })
  }, [monitors, searchTerm, selectedStatus])

  const stats = useMemo(() => {
    const upCount = monitors.filter((m) => m.lastStatus === 'UP').length
    const downCount = monitors.filter((m) => m.lastStatus === 'DOWN').length
    const warningCount = monitors.filter((m) => m.lastStatus === 'WARNING').length
    const uptime = monitors.length > 0 ? ((upCount / monitors.length) * 100).toFixed(1) : '0'
    return { upCount, downCount, warningCount, total: monitors.length, uptime }
  }, [monitors])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3 mb-3">
            <div>
              <h1 className="text-4xl font-bold text-white">Monalertics Monitor</h1>
              <p className="text-slate-400 text-sm mt-1">Real-time Website & Domain Monitoring Dashboard</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Stats Cards - Clickable */}
        {monitors.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`rounded-lg border transition-all cursor-pointer ${selectedStatus === 'ALL' ? 'border-blue-500 bg-slate-800 ring-2 ring-blue-500' : 'border-slate-800 bg-slate-900 hover:bg-slate-800'}`}
            >
              <div className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-slate-400 mt-1">Total Monitor</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedStatus('UP')}
              className={`rounded-lg border transition-all cursor-pointer ${selectedStatus === 'UP' ? 'border-green-500 bg-green-500/20 ring-2 ring-green-500' : 'border-green-500/30 bg-green-500/10 hover:bg-green-500/15'}`}
            >
              <div className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-400">{stats.upCount}</p>
                  <p className="text-xs text-green-400 mt-1">Online/UP</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedStatus('DOWN')}
              className={`rounded-lg border transition-all cursor-pointer ${selectedStatus === 'DOWN' ? 'border-red-500 bg-red-500/20 ring-2 ring-red-500' : 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15'}`}
            >
              <div className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-400">{stats.downCount}</p>
                  <p className="text-xs text-red-400 mt-1">Offline/DOWN</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedStatus('WARNING')}
              className={`rounded-lg border transition-all cursor-pointer ${selectedStatus === 'WARNING' ? 'border-yellow-500 bg-yellow-500/20 ring-2 ring-yellow-500' : 'border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/15'}`}
            >
              <div className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-400">{stats.warningCount}</p>
                  <p className="text-xs text-yellow-400 mt-1">Warning</p>
                </div>
              </div>
            </button>

            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10">
              <div className="p-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">{stats.uptime}%</p>
                  <p className="text-xs text-blue-400 mt-1">Uptime Rate</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <Input
            type="text"
            placeholder="Cari monitor (nama, domain, tipe)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>

        <Card className="border-slate-800 bg-slate-900 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white text-xl">Monitor Status Dashboard</CardTitle>
            <CardDescription className="text-slate-400">
              {filteredMonitors.length} dari {monitors.length} monitor ditampilkan
              {searchTerm && ` • Hasil pencarian: "${searchTerm}"`}
              {selectedStatus !== 'ALL' && ` • Filter: ${selectedStatus}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredMonitors.length === 0 ? (
              <div className="py-12 text-center">
                <MonitorIcon className="mx-auto h-12 w-12 text-slate-700" />
                <p className="mt-3 text-slate-500">
                  {monitors.length === 0 ? 'Belum ada monitor' : 'Tidak ada hasil pencarian'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-3 text-left font-semibold text-slate-300">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-300">Nama & Target</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-300">Tipe</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-300">SSL Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-300">Domain Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-300">Last Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonitors.map((m) => (
                      <tr
                        key={m.id}
                        className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/50 ${statusBgColor(
                          m.lastStatus
                        )}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${statusTextColor(m.lastStatus)}`}>
                              {statusIcon(m.lastStatus)}
                            </span>
                            <Badge variant={statusVariant(m.lastStatus)} dot className="text-xs">
                              {m.lastStatus}
                            </Badge>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-white">{m.name}</p>
                          <p className="truncate text-slate-400 font-mono text-xs max-w-sm mt-0.5">{m.target}</p>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-block px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                            {m.type}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {m.sslExpiry ? (
                            <div>
                              <p className="text-xs font-bold text-slate-100">
                                {new Date(m.sslExpiry).toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                              </p>
                              <p className={`text-[11px] font-semibold mt-1 ${
                                m.sslDaysUntilExpiry !== null && m.sslDaysUntilExpiry !== undefined && m.sslDaysUntilExpiry <= 14 ? 'text-red-400' :
                                m.sslDaysUntilExpiry !== null && m.sslDaysUntilExpiry !== undefined && m.sslDaysUntilExpiry <= 30 ? 'text-yellow-400' :
                                'text-green-400'
                              }`}>
                                {m.sslDaysUntilExpiry !== null && m.sslDaysUntilExpiry !== undefined ? (
                                  m.sslDaysUntilExpiry < 0
                                    ? `⚠ EXPIRED ${Math.abs(m.sslDaysUntilExpiry)} hari lalu`
                                    : `⏱ ${m.sslDaysUntilExpiry} hari tersisa`
                                ) : ''}
                              </p>
                              {m.sslIssuer && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {m.sslIssuer}
                                  {m.sslSubject && m.sslSubject !== m.target && ` • ${m.sslSubject}`}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">-</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {m.domainExpiry ? (
                            <div>
                              <p className="text-xs font-bold text-slate-100">
                                {new Date(m.domainExpiry).toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                              </p>
                              <p className={`text-[11px] font-semibold mt-1 ${
                                m.domainDaysUntilExpiry !== null && m.domainDaysUntilExpiry !== undefined && m.domainDaysUntilExpiry <= 30 ? 'text-red-400' :
                                m.domainDaysUntilExpiry !== null && m.domainDaysUntilExpiry !== undefined && m.domainDaysUntilExpiry <= 60 ? 'text-yellow-400' :
                                'text-green-400'
                              }`}>
                                {m.domainDaysUntilExpiry !== null && m.domainDaysUntilExpiry !== undefined ? (
                                  m.domainDaysUntilExpiry < 0
                                    ? `⚠ EXPIRED ${Math.abs(m.domainDaysUntilExpiry)} hari lalu`
                                    : `⏱ ${m.domainDaysUntilExpiry} hari tersisa`
                                ) : ''}
                              </p>
                              {m.domainRegistrar && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {m.domainRegistrar}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">-</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-slate-300 text-xs font-medium">
                            {m.lastCheckedAt ? formatRelativeTime(m.lastCheckedAt) : 'Belum dicek'}
                          </p>
                          <div className="flex items-center gap-1 text-slate-500 text-[11px] mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>setiap {Math.round(m.intervalSeconds / 60)}m</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {monitors.length > 0 && (
          <Card className="mt-6 border-slate-800 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white text-sm">Legenda Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-green-400">✓</span>
                  <div>
                    <p className="font-semibold text-green-400">UP</p>
                    <p className="text-xs text-slate-400">Website/Domain aktif & berfungsi normal</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-red-400">✗</span>
                  <div>
                    <p className="font-semibold text-red-400">DOWN</p>
                    <p className="text-xs text-slate-400">Website/Domain tidak merespons atau offline</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-yellow-400">⚠</span>
                  <div>
                    <p className="font-semibold text-yellow-400">WARNING</p>
                    <p className="text-xs text-slate-400">Peringatan SSL/Domain expiry atau masalah</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-slate-400">?</span>
                  <div>
                    <p className="font-semibold text-slate-400">UNKNOWN</p>
                    <p className="text-xs text-slate-400">Status belum ditentukan atau menunggu check</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 border-t border-slate-800 pt-6 text-center">
          <p className="text-xs text-slate-500">
            Monalertics © 2024 | Auto-refresh setiap 30 detik • Last updated: {new Date().toLocaleString('id-ID')}
          </p>
        </div>
      </div>
    </div>
  )
}

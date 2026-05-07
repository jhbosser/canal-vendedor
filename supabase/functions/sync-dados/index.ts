import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MONITOR_URL = Deno.env.get('MONITOR_SEEK_URL')!
const MONITOR_KEY = Deno.env.get('MONITOR_SEEK_SERVICE_KEY')!
const LOCAL_URL   = Deno.env.get('SUPABASE_URL')!
const LOCAL_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PAGE = 500
const HOSTNAME = 'edge-function'

async function fetchVendas(
  monitor: ReturnType<typeof createClient>,
  desde: string,
  ate: string,
) {
  const rows: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await monitor
      .from('vendas_detalhado')
      .select([
        'id','empresa','ps_vendedor','ps_nm_vendedor','ps_dt_saida',
        'ps_nota','ps_cliente','ps_nomcli','valor_liq','ps_desp_venda',
        'ps_ir','ps_contrib_social','ps_pis','ps_custo','ps_icms_efetivo',
        'ps_st','ps_difal','ps_codpro','ps_codfab','ps_qtdpro',
        'ano_mes','updated_at','rentabilidade',
      ].join(','))
      .gte('ps_dt_saida', desde)
      .lte('ps_dt_saida', ate)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`vendas: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...(data as Record<string, unknown>[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function executarSync(local: ReturnType<typeof createClient>, body: any) {
  const hoje = new Date().toISOString().split('T')[0]
  const desde: string = body.desde ?? (() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
  })()
  const ate: string = body.ate ?? hoje

  const monitor = createClient(MONITOR_URL, MONITOR_KEY)

  // Fabricantes
  let fabsSinc = 0
  if (body.fabricantes !== false) {
    const { data: fabs, error: eFab } = await monitor
      .from('fabricantes')
      .select('csi_codfab,csi_nomfab,created_at,updated_at')
    if (eFab) throw new Error(`fabricantes: ${eFab.message}`)
    if (fabs && fabs.length > 0) {
      const { error } = await local
        .from('fabricantes')
        .upsert(fabs, { onConflict: 'csi_codfab' })
      if (error) throw new Error(`upsert fabricantes: ${error.message}`)
      fabsSinc = fabs.length
    }
  }

  // Clientes tabela
  let tabelaSinc = 0
  if (body.clientes_tabela !== false) {
    const PAGE_TAB = 1000
    let fromTab = 0
    while (true) {
      const { data: tab, error: eTab } = await monitor
        .from('clientes_tabela')
        .select('csi_codcli,csi_codtab_atac,csi_nomtab')
        .range(fromTab, fromTab + PAGE_TAB - 1)
      if (eTab) throw new Error(`clientes_tabela: ${eTab.message}`)
      if (!tab || tab.length === 0) break
      const { error } = await local
        .from('clientes_tabela')
        .upsert(tab, { onConflict: 'csi_codcli' })
      if (error) throw new Error(`upsert clientes_tabela: ${error.message}`)
      tabelaSinc += tab.length
      if (tab.length < PAGE_TAB) break
      fromTab += PAGE_TAB
    }
  }

  // Vendas no intervalo
  const vendas = await fetchVendas(monitor, desde, ate)

  const vendaMap = new Map<unknown, Record<string, unknown>>()
  for (const v of vendas) vendaMap.set(v.id, v)
  const vendasUnicas = Array.from(vendaMap.values())

  const { error: eDel } = await local
    .from('vendas_detalhado')
    .delete()
    .gte('ps_dt_saida', desde)
    .lte('ps_dt_saida', ate)
  if (eDel) throw new Error(`delete vendas: ${eDel.message}`)

  for (let i = 0; i < vendasUnicas.length; i += PAGE) {
    const batch = vendasUnicas.slice(i, i + PAGE)
    const { error } = await local
      .from('vendas_detalhado')
      .insert(batch)
    if (error) throw new Error(`insert vendas lote ${i}: ${error.message}`)
  }

  const { error: eRefresh } = await local.rpc('refresh_portfolio_sem_timeout')

  return {
    desde,
    ate,
    fabricantes_sincronizados: fabsSinc,
    clientes_tabela_sincronizados: tabelaSinc,
    vendas_sincronizadas: vendasUnicas.length,
    portfolio_refreshed: eRefresh ? `error: ${eRefresh.message}` : 'ok',
  }
}

Deno.serve(async (req) => {
  const local = createClient(LOCAL_URL, LOCAL_KEY)
  const body = await req.json().catch(() => ({}))
  const execId: string | null = body.exec_id ?? null
  const startedAt = new Date()

  // Marca como running se exec_id foi passado
  if (execId) {
    await local.from('sync_executions').update({
      status: 'running',
      started_at: startedAt.toISOString(),
      hostname: HOSTNAME,
    }).eq('id', execId)
  }

  try {
    const resultado = await executarSync(local, body)
    const finishedAt = new Date()
    const duracao = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000)

    if (execId) {
      await local.from('sync_executions').update({
        status: 'done',
        finished_at: finishedAt.toISOString(),
        duracao_seg: duracao,
      }).eq('id', execId)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        exec_id: execId,
        ...resultado,
        synced_at: finishedAt.toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const finishedAt = new Date()
    const duracao = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000)
    const msg = (e as Error).message
    const stack = (e as Error).stack || ''

    if (execId) {
      await local.from('sync_executions').update({
        status: 'error',
        finished_at: finishedAt.toISOString(),
        duracao_seg: duracao,
        erro: `${msg}\n${stack}`.slice(0, 5000),
      }).eq('id', execId)
    }

    console.error(e)
    return new Response(
      JSON.stringify({ ok: false, exec_id: execId, error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

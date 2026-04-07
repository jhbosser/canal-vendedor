import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MONITOR_URL = Deno.env.get('MONITOR_SEEK_URL')!
const MONITOR_KEY = Deno.env.get('MONITOR_SEEK_SERVICE_KEY')!
const LOCAL_URL   = Deno.env.get('SUPABASE_URL')!
const LOCAL_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PAGE = 500

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

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    // desde/ate: datas no formato YYYY-MM-DD
    // Se não informado: sincroniza os últimos 2 dias (sync diário)
    const hoje = new Date().toISOString().split('T')[0]
    const desde: string = body.desde ?? (() => {
      const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
    })()
    const ate: string = body.ate ?? hoje

    const monitor = createClient(MONITOR_URL, MONITOR_KEY)
    const local   = createClient(LOCAL_URL, LOCAL_KEY)

    // ── Fabricantes ──────────────────────────────────────────────────
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

    // ── Clientes tabela ──────────────────────────────────────────────
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

    // ── Vendas no intervalo ──────────────────────────────────────────
    const vendas = await fetchVendas(monitor, desde, ate)

    // Desduplicar por id (monitor_seek pode retornar o mesmo id em páginas diferentes)
    const vendaMap = new Map<unknown, Record<string, unknown>>()
    for (const v of vendas) vendaMap.set(v.id, v)
    const vendasUnicas = Array.from(vendaMap.values())

    // Espelho exato: apaga o período e re-insere tudo do monitor_seek
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

    // Dispara o refresh em background (não aguarda — evita timeout da edge function)
    const refreshPromise = local.rpc('refresh_portfolio')
      .then(({ error }) => { if (error) console.error('refresh_portfolio:', error.message) })
    // waitUntil mantém o processo vivo para o background task completar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).EdgeRuntime?.waitUntil(refreshPromise)

    return new Response(
      JSON.stringify({
        ok: true,
        desde,
        ate,
        fabricantes_sincronizados: fabsSinc,
        clientes_tabela_sincronizados: tabelaSinc,
        vendas_sincronizadas: vendasUnicas.length,
        portfolio_refreshed: 'triggered',
        synced_at: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

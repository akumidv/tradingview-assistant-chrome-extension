// Single source of truth for metric option lists used in popup selects.
// Format: string = value & label are the same; [value, label] = different label.
const METRICS = {
  DEFAULT_OPT_PARAM: 'Total PnL',
  DEFAULT_FILTER_PARAM: 'Total trades: All',
  GROUPS: [
    {
      header: 'Equity Metrics',
      options: [
        'Total PnL',
        'Max drawdown',
        ['Total trades: All', 'Total trades'],
        'Profitable trades',
        'Profit factor',
      ]
    },
    {
      header: 'Performance',
      options: [
        'Net P&L: All', 'Net P&L %: All',
        'Net P&L: Long', 'Net P&L %: Long',
        'Net P&L: Short', 'Net P&L %: Short',
        'Open P&L', 'Open P&L %',
        'Gross profit: All', 'Gross profit %: All',
        'Gross profit: Long', 'Gross profit %: Long',
        'Gross profit %: Short',
        'Gross loss: All', 'Gross loss %: All',
        'Gross loss: Long', 'Gross loss %: Long',
        'Gross loss: Short', 'Gross loss %: Short',
        'Profit factor: All', 'Profit factor: Long', 'Profit factor: Short',
        'Commission paid: All', 'Commission paid: Long', 'Commission paid: Short',
        'Expected payoff: All', 'Expected payoff: Long', 'Expected payoff: Short',
      ]
    },
    {
      header: 'Benchmark comparison',
      options: [
        'Buy & hold return', 'Buy & hold return %',
        'Buy & hold % gain',
        'Strategy outperformance',
      ]
    },
    {
      header: 'Risk-adjusted performance',
      options: [
        'Sharpe ratio',
        'Sortino ratio',
      ]
    },
    {
      header: 'Trades analysis',
      options: [
        'Total trades: All', 'Total trades: Long', 'Total trades: Short',
        'Total open trades: All', 'Total open trades: Long', 'Total open trades: Short',
        'Winning trades: All', 'Winning trades: Long', 'Winning trades: Short',
        'Losing trades: All', 'Losing trades: Long', 'Losing trades: Short',
        'Percent profitable: All', 'Percent profitable: Long', 'Percent profitable: Short',
        'Avg P&L: All', 'Avg P&L %: All',
        'Avg P&L: Long', 'Avg P&L: Long %',
        'Avg P&L: Short', 'Avg P&L: Short %',
        'Avg winning trade: All', 'Avg winning trade %: All',
        'Avg winning trade: Long', 'Avg winning trade: Long %',
        'Avg winning trade: Short', 'Avg winning trade: Short %',
        'Avg losing trade: All', 'Avg losing trade %: All',
        'Avg losing trade: Long', 'Avg losing trade: Long %',
        'Avg losing trade: Short', 'Avg losing trade: Short %',
        'Ratio avg win / avg loss: All', 'Ratio avg win / avg loss: Long', 'Ratio avg win / avg loss: Short',
        'Largest winning trade: All', 'Largest winning trade: Long', 'Largest winning trade: Short',
        'Largest winning trade percent: All', 'Largest winning trade percent: Long', 'Largest winning trade percent: Short',
        'Largest losing trade: All', 'Largest losing trade: Long', 'Largest losing trade: Short',
        'Largest losing trade percent: All', 'Largest losing trade percent: Long', 'Largest losing trade percent: Short',
        'Avg # bars in trades: All', 'Avg # bars in trades: Long', 'Avg # bars in trades: Short',
        'Avg # bars in winning trades: All', 'Avg # bars in winning trades: Long', 'Avg # bars in winning trades: Short',
        'Avg # bars in losing trades: All', 'Avg # bars in losing trades: Long', 'Avg # bars in losing trades: Short',
      ]
    },
    {
      header: 'Capital efficiency',
      options: [
        'Annualized return (CAGR): All', 'Annualized return (CAGR): Long', 'Annualized return (CAGR): Short',
        'Return on initial capital: All', 'Return on initial capital: Long', 'Return on initial capital: Short',
        'Account size required',
        'Return on account size required: All', 'Return on account size required: Long', 'Return on account size required: Short',
        'Net profit as % of largest loss: All', 'Net profit as % of largest loss: Long', 'Net profit as % of largest loss: Short',
      ]
    },
    {
      header: 'Margin usage',
      options: [
        'Avg margin used',
        'Max margin used',
        'Margin efficiency',
        'Margin calls',
      ]
    },
    {
      header: 'Run-ups',
      options: [
        'Avg equity run-up duration (close-to-close)',
        'Avg equity run-up (close-to-close)',
        'Max equity run-up (close-to-close)',
        'Max equity run-up (intrabar)',
        'Max equity run-up as % of initial capital (intrabar)',
      ]
    },
    {
      header: 'Drawdowns',
      options: [
        'Avg equity drawdown duration (close-to-close)',
        'Avg equity drawdown (close-to-close)',
        'Max equity drawdown (close-to-close)',
        'Max equity drawdown (intrabar)',
        'Max equity drawdown as % of initial capital (intrabar)',
        'Return of max equity drawdown',
      ]
    },
  ]
}

// Flat set of all valid metric values for quick lookup
METRICS.ALL_VALUES = new Set(
  METRICS.GROUPS.flatMap(g => g.options.map(o => Array.isArray(o) ? o[0] : o))
)

METRICS.isValid = (value) => METRICS.ALL_VALUES.has(value)

METRICS.populate = (selectEl) => {
  if (!selectEl) return
  selectEl.innerHTML = ''
  for (const group of METRICS.GROUPS) {
    const header = document.createElement('option')
    header.value = `${group.header}_tab`
    header.textContent = group.header
    header.disabled = true
    selectEl.appendChild(header)
    for (const opt of group.options) {
      const [value, label] = Array.isArray(opt) ? opt : [opt, opt]
      const el = document.createElement('option')
      el.value = value
      el.textContent = label
      selectEl.appendChild(el)
    }
  }
}
